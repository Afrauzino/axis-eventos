// Edge Function: admin-delete-user
// Exclui DE VERDADE uma conta (perfil + login auth.users), com service_role.
// Regras: só ADMIN pode chamar; NUNCA exclui outro admin.
// Deploy: supabase functions deploy admin-delete-user
// (SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são injetados pelo Supabase.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url         = Deno.env.get('SUPABASE_URL')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader  = req.headers.get('Authorization') ?? ''

    // 1) Quem está chamando? (usa o JWT do usuário logado)
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: uErr } = await userClient.auth.getUser()
    if (uErr || !user) return json({ error: 'Não autenticado' }, 401)

    const admin = createClient(url, serviceKey)

    // 2) O chamador é admin?
    const { data: me } = await admin.from('profiles').select('user_role').eq('user_id', user.id).maybeSingle()
    if (me?.user_role !== 'admin') return json({ error: 'Apenas administradores podem excluir contas.' }, 403)

    // 3) Alvo (por user_id ou por person_id)
    const { target_user_id, target_person_id } = await req.json().catch(() => ({}))
    let targetUserId: string | null = target_user_id ?? null
    if (!targetUserId && target_person_id) {
      const { data: pe } = await admin.from('people').select('user_id').eq('id', target_person_id).maybeSingle()
      targetUserId = pe?.user_id ?? null
    }
    if (!targetUserId) return json({ error: 'Alvo sem conta (user_id). Nada para excluir aqui.' }, 400)

    // 4) NUNCA excluir admin
    if (targetUserId === user.id) return json({ error: 'Você não pode excluir a própria conta.' }, 400)
    const { data: tgt } = await admin.from('profiles').select('user_role').eq('user_id', targetUserId).maybeSingle()
    if (tgt?.user_role === 'admin') return json({ error: 'Administradores não podem ser excluídos.' }, 403)

    // 5) Exclui de verdade: perfil + login (os dados de pessoa são limpos pelo app antes de chamar)
    await admin.from('profiles').delete().eq('user_id', targetUserId)
    const { error: delErr } = await admin.auth.admin.deleteUser(targetUserId)
    if (delErr) return json({ error: 'Erro ao excluir login: ' + delErr.message }, 500)

    return json({ ok: true })
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500)
  }
})
