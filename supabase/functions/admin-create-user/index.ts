// supabase/functions/admin-create-user/index.ts
//
// Crea un usuario nuevo (auth + perfil) desde el panel de Admin.
// Solo puede ser invocada por un usuario que ya es admin: se valida
// el JWT de quien llama antes de usar la service_role key.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Cliente con el JWT de quien llama, para verificar que es admin.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser()

    if (!caller) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Solo un administrador puede crear usuarios' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, password, full_name, role } = await req.json()

    if (!email || !password || !full_name) {
      return new Response(JSON.stringify({ error: 'Faltan datos obligatorios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Cliente admin con service_role key: única forma de crear usuarios por API.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (createError || !created.user) {
      return new Response(JSON.stringify({ error: createError?.message ?? 'No se pudo crear el usuario' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // El trigger handle_new_user ya crea el profile con role 'driver' por defecto.
    // Si se pidió 'admin', lo actualizamos.
    if (role === 'admin') {
      await adminClient.from('profiles').update({ role: 'admin' }).eq('id', created.user.id)
    }

    return new Response(JSON.stringify({ success: true, user_id: created.user.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
