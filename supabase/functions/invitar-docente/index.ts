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
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No se proporcionó token de autorización" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client for checking requester identity
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuario no autenticado" }), {
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
      return new Response(JSON.stringify({ error: "Acceso denegado: Se requiere rol de Director/Superadmin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service Role Client for admin user creation
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { email, password, nombre_completo, rda, especialidad, nivel, sede_id, programa_id, horario_id, puede_publicar } = body;

    if (!email || !password || !nombre_completo) {
      return new Response(JSON.stringify({ error: "Email, contraseña y nombre completo son obligatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Create User in Supabase Auth
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre_completo }
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Insert Profile in perfiles table
    const { data: newProfile, error: profileInsertError } = await adminClient
      .from("perfiles")
      .insert({
        id: newUser.user.id,
        nombre_completo,
        rda,
        especialidad,
        nivel,
        sede_id: sede_id || null,
        programa_id: programa_id || null,
        horario_id: horario_id || null,
        rol: "docente",
        activo: true,
        puede_publicar: puede_publicar || false
      })
      .select()
      .single();

    if (profileInsertError) {
      return new Response(JSON.stringify({ error: `Usuario creado pero fallo al crear perfil: ${profileInsertError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: "Docente registrado con éxito", user: newUser.user, profile: newProfile }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Error interno del servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
