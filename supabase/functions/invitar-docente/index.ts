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
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No se proporcionó token de autorización (JWT)" }), {
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
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
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
      puede_publicar: puede_publicar === true,
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

    return new Response(
      JSON.stringify({
        message: "Docente registrado con éxito en Auth y perfiles",
        user: newUser.user,
        profile: newProfile,
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

