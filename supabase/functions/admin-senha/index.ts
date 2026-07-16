// Edge Function: admin-senha
// Gera uma NOVA SENHA para a conta de outra pessoa, com service_role.
// Existe porque trocar a senha de outro usuário exige a chave de serviço — o app
// no navegador NÃO pode (e não deve) fazer isso.
//
// Regras (as mesmas do admin-delete-user):
//   - só ADMIN/PASTOR (ou is_admin) pode chamar;
//   - NUNCA troca a senha de outro admin (senão um admin derruba o outro);
//   - a senha é gerada AQUI no servidor e devolvida UMA vez pro admin repassar.
//
// Deploy: supabase functions deploy admin-senha
//   (ou Dashboard -> Edge Functions -> Deploy new function -> nome: admin-senha)
// Não precisa de Secret novo: usa as chaves que o Supabase já injeta.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const ehAdmin = (p: any) => p?.is_admin === true || p?.user_role === 'admin' || p?.user_role === 'pastor'

function chaveServico(): string {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS') || ''
  if (raw) { const m = raw.match(/sb_secret_[A-Za-z0-9_\-]+/); if (m) return m[0]; try { const p = JSON.parse(raw); if (typeof p === 'string' && p) return p } catch { /* ignore */ } }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
}

// Senha fácil de ditar no WhatsApp: sem 0/O/1/I/l (que a pessoa erra ao digitar).
function gerarSenha(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const num = '23456789'
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  let s = ''
  for (let i = 0; i < 6; i++) s += abc[bytes[i] % abc.length]
  for (let i = 0; i < 3; i++) s += num[bytes[6 + i] % num.length]
  return s   // ex.: KXTBRM472  (9 caracteres, acima do mínimo de 6 do Supabase)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url        = Deno.env.get('SUPABASE_URL')!
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = chaveServico()
    if (!serviceKey) return json({ error: 'Chave de serviço não configurada nos Secrets.' }, 500)
    const authHeader = req.headers.get('Authorization') ?? ''

    // 1) Quem está chamando?
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: uErr } = await userClient.auth.getUser()
    if (uErr || !user) return json({ error: 'Não autenticado' }, 401)

    const admin = createClient(url, serviceKey)

    // 2) É admin mesmo?
    const { data: me } = await admin.from('profiles').select('user_role, is_admin').eq('user_id', user.id).maybeSingle()
    if (!ehAdmin(me)) return json({ error: 'Apenas administradores podem gerar senha.' }, 403)

    // 3) Alvo
    const { target_user_id, solicitacao_id } = await req.json().catch(() => ({}))
    if (!target_user_id) return json({ error: 'Faltou o target_user_id.' }, 400)

    // 4) Um admin não troca a senha de outro admin
    const { data: tgt } = await admin.from('profiles').select('user_role, is_admin').eq('user_id', target_user_id).maybeSingle()
    if (!tgt) return json({ error: 'Conta não encontrada.' }, 404)
    if (ehAdmin(tgt) && target_user_id !== user.id) {
      return json({ error: 'Não dá pra trocar a senha de outro administrador.' }, 403)
    }

    // 5) Troca a senha
    const senha = gerarSenha()
    const { error: upErr } = await admin.auth.admin.updateUserById(target_user_id, { password: senha })
    if (upErr) return json({ error: 'Erro ao trocar a senha: ' + upErr.message }, 500)

    // 6) Se veio de um pedido de recuperação, marca como atendido
    if (solicitacao_id) {
      await admin.from('senha_solicitacoes')
        .update({ status: 'atendido', atendido_por: user.id, atendido_em: new Date().toISOString() })
        .eq('id', solicitacao_id)
    }

    return json({ ok: true, senha })
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500)
  }
})
