// Edge Function: koinonia-inscricao
// A PORTA do Koinonia para dentro do AXIS. Só o servidor do Koinonia chama
// (a edge function `axis-inscricao` de lá) — nunca o navegador de ninguém.
//
// Proteção: cabeçalho `x-axis-segredo`. O sha256 dele tem que bater com
// integracao_chaves.hash (nome = 'koinonia', sql/99). O segredo em si só
// existe no Koinonia; aqui fica só o hash. Publicar com verify_jwt DESLIGADO
// (quem chama não tem login do AXIS).
//
// Ações (POST { acao, ... }):
//   eventos                 -> eventos com inscrição aberta no Koinonia
//   previa   {event_id, role_type, nome}  -> termo, valor, parcelas, Pix, responsáveis
//   inscrever {dados, assinatura, foto?}  -> cria a ficha + aceite assinado (sql/99)
//   situacao {person_ids}   -> status de cada inscrição (pendente / inscrito / ...)
//
// A assinatura (PNG) vai pro bucket PRIVADO `assinaturas/{event}/{person}.png`
// ANTES de gravar — é o que o _inscricao_registrar_aceite (sql/98) confere.
// Se a gravação recusar, os arquivos subidos são apagados.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-axis-segredo',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

// Mesmo cuidado do enviar-push: a chave legada pode ter perdido acesso ao
// schema public na migração de API keys do Supabase — usa a que conseguir ler.
function extrairSecret(): string {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS') || ''
  const m = raw.match(/sb_secret_[A-Za-z0-9_\-]+/)
  if (m) return m[0]
  try { const p = JSON.parse(raw); if (typeof p === 'string' && p) return p } catch { /* ignore */ }
  return ''
}
async function adminServico(url: string) {
  const cands = [Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', extrairSecret()].filter(Boolean)
  for (const key of cands) {
    const admin = createClient(url, key, { auth: { persistSession: false } })
    const { error } = await admin.from('integracao_chaves').select('nome').limit(1)
    if (!error) return admin
  }
  return null
}

async function sha256hex(t: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')
}
function iguais(a: string, b: string) {          // comparação em tempo constante
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
function dataUrlParaBytes(d: string): { bytes: Uint8Array; tipo: string } | null {
  const m = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/.exec(d || '')
  if (!m) return null
  const bin = atob(m[3])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { bytes, tipo: m[1] }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Avisa admin e pastor (mesma regra 'insc_nova' do cadastro pelo link).
async function avisarAdmins(admin: any, titulo: string, corpo: string) {
  try {
    const { data: cfg } = await admin.from('configuracoes').select('valor').eq('chave', 'notif_regras').maybeSingle()
    try { if (cfg?.valor && JSON.parse(cfg.valor)?.insc_nova === false) return } catch { /* regra ilegível = ligada */ }
    const pub = Deno.env.get('VAPID_PUBLIC'), priv = Deno.env.get('VAPID_PRIVATE')
    if (!pub || !priv) return
    webpush.setVapidDetails('mailto:afrauzino@gmail.com', pub, priv)
    const { data: adm } = await admin.from('profiles').select('user_id').or('is_admin.eq.true,user_role.in.(admin,pastor)')
    const ids = (adm ?? []).map((a: any) => a.user_id).filter(Boolean)
    if (!ids.length) return
    const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', ids)
    const payload = JSON.stringify({ title: titulo, body: corpo, url: '/admin', tag: 'aprov' })
    for (const s of subs ?? []) {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload) }
      catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) { try { await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint) } catch { /* ignore */ } }
      }
    }
  } catch { /* aviso nunca derruba a inscrição */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const admin = await adminServico(url)
    if (!admin) return json({ error: 'Chave de serviço sem acesso ao banco.' }, 500)

    // ---- quem está chamando é mesmo o Koinonia?
    const segredo = req.headers.get('x-axis-segredo') || ''
    const { data: chave } = await admin.from('integracao_chaves').select('hash').eq('nome', 'koinonia').maybeSingle()
    if (!segredo || !chave?.hash || !iguais(await sha256hex(segredo), chave.hash)) return json({ error: 'Não autorizado.' }, 401)

    const body = await req.json().catch(() => ({}))
    const acao = body?.acao

    if (acao === 'eventos') {
      const { data, error } = await admin.rpc('inscricoes_koinonia_abertas')
      if (error) return json({ error: error.message }, 500)
      return json({ eventos: data ?? [] })
    }

    if (acao === 'previa') {
      const { event_id, role_type, nome } = body
      if (!UUID.test(event_id || '')) return json({ error: 'Evento inválido.' }, 400)
      const { data, error } = await admin.rpc('inscricao_previa_koinonia', { p_event: event_id, p_role: role_type, p_nome: nome || '' })
      if (error) return json({ error: error.message }, 500)
      if (!data) return json({ error: 'Evento não encontrado.' }, 404)
      return json({ previa: data })
    }

    if (acao === 'situacao') {
      const ids = (Array.isArray(body.person_ids) ? body.person_ids : []).filter((x: string) => UUID.test(x || '')).slice(0, 200)
      if (!ids.length) return json({ situacao: [] })
      const { data, error } = await admin.from('people').select('id,status,desistente,user_id,invite_code').in('id', ids)
      if (error) return json({ error: error.message }, 500)
      return json({ situacao: (data ?? []).map((p: any) => ({
        person_id: p.id, status: p.desistente ? 'desistente' : p.status, tem_conta: !!p.user_id, invite_code: p.invite_code,
      })) })
    }

    if (acao === 'inscrever') {
      const dados = body.dados || {}
      if (!UUID.test(dados.event_id || '')) return json({ error: 'Evento inválido.' }, 400)
      const assin = dataUrlParaBytes(body.assinatura)
      if (!assin || assin.tipo !== 'image/png') return json({ error: 'Assinatura inválida.' }, 400)
      if (assin.bytes.length < 400 || assin.bytes.length > 600_000) return json({ error: 'Assinatura inválida.' }, 400)

      const personId = crypto.randomUUID()
      const pathAssin = `${dados.event_id}/${personId}.png`
      const subidos: { bucket: string; path: string }[] = []
      const limpar = async () => { for (const s of subidos) { try { await admin.storage.from(s.bucket).remove([s.path]) } catch { /* ignore */ } } }

      const up = await admin.storage.from('assinaturas').upload(pathAssin, assin.bytes, { contentType: 'image/png', upsert: false })
      if (up.error) return json({ error: 'Não consegui guardar a assinatura: ' + up.error.message }, 500)
      subidos.push({ bucket: 'assinaturas', path: pathAssin })

      // Foto: o Koinonia guarda como data URL; aqui vira arquivo no bucket `pessoas`
      // (o mesmo do cadastro pelo AXIS). Se já for um endereço https, usa direto.
      let photoUrl: string | null = null
      const foto = typeof body.foto === 'string' ? body.foto : ''
      if (/^https:\/\//.test(foto)) photoUrl = foto
      else if (foto) {
        const f = dataUrlParaBytes(foto)
        if (f && f.bytes.length <= 3_000_000) {
          const ext = f.tipo === 'image/png' ? 'png' : f.tipo === 'image/webp' ? 'webp' : 'jpg'
          const pathFoto = `koinonia/${personId}.${ext}`
          const uf = await admin.storage.from('pessoas').upload(pathFoto, f.bytes, { contentType: f.tipo, upsert: true })
          if (!uf.error) {
            subidos.push({ bucket: 'pessoas', path: pathFoto })
            photoUrl = admin.storage.from('pessoas').getPublicUrl(pathFoto).data.publicUrl
          }
        }
      }

      const { data: r, error } = await admin.rpc('receber_inscricao_koinonia', {
        p: { ...dados, person_id: personId, photo_url: photoUrl },
      })
      if (error) { await limpar(); return json({ error: error.message }, 500) }
      if (r?.status !== 'ok') { await limpar(); return json(r) }

      await avisarAdmins(admin, 'Nova inscrição (Koinonia)',
        `${dados.nome} se inscreveu como ${dados.role_type === 'worker' ? 'encontreiro' : 'encontrista'} — toque para aprovar`)
      return json(r)
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500)
  }
})
