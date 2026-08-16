// Supabase Edge Function: invitar-docente
// Handles secure teacher user creation without exposing service_role key to browser client.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No se proporcionó token de autorización (JWT)" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract JWT token without 'Bearer ' prefix
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token de autorización no válido o vacío" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client for checking requester identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuario no autenticado o token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if requester is superadmin in perfiles table
    const { data: perfil, error: perfilError } = await userClient
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (perfilError || perfil?.rol !== "superadmin") {
      return new Response(JSON.stringify({ error: "Acceso denegado: Se requiere rol de superadmin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service Role Client for admin user creation
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const {
      email,
      password,
      nombre_completo,
      ci,
      ci_exp,
      rda,
      especialidad,
      nivel,
      sede_id,
      programa_id,
      horario_id,
      puede_publicar,
      grupo_ids, // array of UUIDs (string[])
    } = body;

    if (!email || !password || !nombre_completo) {
      return new Response(JSON.stringify({ error: "Email, contraseña y nombre completo son obligatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Create User in Supabase Auth via admin api
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nombre_completo,
        rda: rda || "",
        rol: "docente",
      },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: `Error en Supabase Auth: ${createError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!newUser || !newUser.user) {
      return new Response(JSON.stringify({ error: "No se pudo crear el usuario en Supabase Auth" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Insert Profile in perfiles table using valid schema columns only
    const documentCi = ci ? String(ci).trim() : (ci_exp ? String(ci_exp).trim() : null);

    const profilePayload: Record<string, any> = {
      id: newUser.user.id,
      nombre_completo: nombre_completo.trim(),
      ci: documentCi,
      rda: rda ? String(rda).trim() : null,
      especialidad: especialidad ? String(especialidad).trim() : null,
      nivel: nivel ? String(nivel).trim() : null,
      sede_id: sede_id || null,
      programa_id: programa_id || null,
      horario_id: horario_id || null,
      rol: "docente",
      activo: true,
      puede_publicar: Boolean(puede_publicar),
      updated_at: new Date().toISOString(),
    };

    const { data: newProfile, error: profileInsertError } = await adminClient
      .from("perfiles")
      .insert(profilePayload)
      .select()
      .single();

    if (profileInsertError) {
      // Rollback Auth user to prevent orphan users
      try {
        await adminClient.auth.admin.deleteUser(newUser.user.id);
      } catch (rollbackErr) {
        console.error("Error al eliminar el usuario huérfano de Auth:", rollbackErr);
      }

      return new Response(
        JSON.stringify({
          error: `Fallo al crear perfil en public.perfiles: ${profileInsertError.message}. Se eliminó el usuario recién creado en Auth.`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Create independent rows in public.asignaciones_docentes for each selected group
    let createdAsignaciones: any[] = [];
    if (Array.isArray(grupo_ids) && grupo_ids.length > 0) {
      // Fetch details of selected groups to extract carrera_especialidad or nombre for 'materia' column
      const { data: gruposData, error: gruposFetchError } = await adminClient
        .from("grupos")
        .select("id, nombre, carrera_especialidad, nivel")
        .in("id", grupo_ids);

      if (gruposFetchError) {
        return new Response(
          JSON.stringify({
            error: `El usuario y perfil fueron creados con éxito (Docente ID: ${newUser.user.id}), pero ocurrió un error al consultar los grupos seleccionados: ${gruposFetchError.message}. Debe asignar los grupos manualmente.`,
            user: newUser.user,
            profile: newProfile,
            asignaciones_error: gruposFetchError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const gruposMap = new Map((gruposData || []).map((g: any) => [g.id, g]));

      const asignacionesPayload = grupo_ids.map((gid: string) => {
        const gInfo = gruposMap.get(gid);
        // Column 'materia' is NOT NULL in public.asignaciones_docentes schema
        const materiaVal = gInfo?.carrera_especialidad || gInfo?.nombre || especialidad || 'Docencia General';
        return {
          docente_id: newUser.user.id,
          grupo_id: gid,
          materia: materiaVal,
        };
      });

      const { data: asigData, error: asigInsertError } = await adminClient
        .from("asignaciones_docentes")
        .insert(asignacionesPayload)
        .select();

      if (asigInsertError) {
        return new Response(
          JSON.stringify({
            error: `El usuario y perfil fueron creados con éxito (Docente ID: ${newUser.user.id}), pero falló la asignación de los grupos en public.asignaciones_docentes: ${asigInsertError.message}.`,
            user: newUser.user,
            profile: newProfile,
            asignaciones_error: asigInsertError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      createdAsignaciones = asigData || [];
    }

    return new Response(
      JSON.stringify({
        message: "Docente registrado con éxito en Auth, perfiles y asignaciones de grupos",
        user: newUser.user,
        profile: newProfile,
        asignaciones: createdAsignaciones,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Error interno del servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

