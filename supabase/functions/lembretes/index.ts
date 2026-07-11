// Edge Function: lembretes
// Roda a cada 5 min (pg_cron). Lê os HORÁRIOS do cronograma e das escalas e
// avisa "começa em breve" (~10 min antes). Marca push_em pra não repetir.
// Respeita as REGRAS de notificação (configuracoes.notif_regras): só dispara
// o que o admin deixou ligado. Autentica por CRON_SECRET (o mesmo dos remédios).
//
// Secrets: CRON_SECRET, VAPID_PUBLIC, VAPID_PRIVATE (já existem).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-cron-secret, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const horaBR = (iso: string) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) } catch { return '' } }

// Chave de SERVIÇO (bypassa RLS): prefere a NOVA (sb_secret_...) e cai na legada.
// A legada (SUPABASE_SERVICE_ROLE_KEY) foi deprecada e perdeu acesso na migração.
function chaveServico(): string {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS') || ''
  if (raw) { const m = raw.match(/sb_secret_[A-Za-z0-9_\-]+/); if (m) return m[0]; try { const p = JSON.parse(raw); if (typeof p === 'string' && p) return p } catch { /* ignore */ } }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const secret = Deno.env.get('CRON_SECRET') ?? ''
    const auth = req.headers.get('Authorization') ?? req.headers.get('x-cron-secret') ?? ''
    if (!secret || (auth !== `Bearer ${secret}` && auth !== secret)) return json({ error: 'não autorizado' }, 401)

    const url        = Deno.env.get('SUPABASE_URL')!
    const serviceKey = chaveServico()
    webpush.setVapidDetails('mailto:afrauzino@gmail.com', Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!)
    const admin = createClient(url, serviceKey)

    // Regras ligadas/desligadas (mesma config da tela Administração → Notificações)
    const { data: cfg } = await admin.from('configuracoes').select('valor').eq('chave', 'notif_regras').maybeSingle()
    let regras: Record<string, boolean> = {}
    try { regras = JSON.parse((cfg?.valor as string) ?? '{}') } catch {}
    const on = (k: string, def: boolean) => (typeof regras[k] === 'boolean' ? regras[k] : def)

    const agora = Date.now()
    const min = new Date(agora - 3 * 60000).toISOString()    // 3 min de folga pra trás
    const max = new Date(agora + 11 * 60000).toISOString()   // ~10 min à frente

    // ---- helpers de envio ----
    const subsCache = new Map<string, any[]>()  // userId -> subs (evita reconsultar)
    async function subsDeUsers(userIds: string[]): Promise<any[]> {
      const faltam = userIds.filter(u => !subsCache.has(u))
      if (faltam.length) {
        const { data } = await admin.from('push_subscriptions').select('*').in('user_id', faltam)
        for (const u of faltam) subsCache.set(u, [])
        for (const s of data ?? []) { const arr = subsCache.get(s.user_id) ?? []; arr.push(s); subsCache.set(s.user_id, arr) }
      }
      return userIds.flatMap(u => subsCache.get(u) ?? [])
    }
    async function usersDePeople(personIds: string[]): Promise<string[]> {
      const ids = [...new Set(personIds.filter(Boolean))]
      if (!ids.length) return []
      const { data } = await admin.from('people').select('user_id').in('id', ids).not('user_id', 'is', null)
      return [...new Set((data ?? []).map((p: any) => p.user_id).filter(Boolean))]
    }
    let enviados = 0
    async function enviar(userIds: string[], payloadObj: any) {
      const subs = await subsDeUsers([...new Set(userIds)])
      if (!subs.length) return
      const payload = JSON.stringify(payloadObj)
      for (const s of subs) {
        try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); enviados++ }
        catch (e: any) { const c = e?.statusCode; if (c === 404 || c === 410) { try { await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint) } catch {} } }
      }
    }

    // ================= CRONOGRAMA =================
    const { data: itens } = await admin.from('cronograma_eventos')
      .select('id,event_id,titulo,local,hora_inicio,theater_id,ministracao_id,status')
      .is('push_em', null).gte('hora_inicio', min).lte('hora_inicio', max)
    const marcarCron: string[] = []
    for (const it of itens ?? []) {
      if (it.status === 'concluido' || it.status === 'em_andamento') continue
      let mandou = false
      const hora = horaBR(it.hora_inicio)

      // Próximo item pra TODOS
      if (on('cron_proximo', false) && it.event_id) {
        const { data: pe } = await admin.from('people').select('user_id').eq('event_id', it.event_id).not('user_id', 'is', null)
        const uids = [...new Set((pe ?? []).map((p: any) => p.user_id).filter(Boolean))]
        if (uids.length) { await enviar(uids, { title: '⏰ Começa em breve', body: `${it.titulo}${hora ? ' às ' + hora : ''}${it.local ? ' · ' + it.local : ''}`, url: '/cronograma', tag: 'cron-' + it.id }); mandou = true }
      }
      // Teatro do elenco
      if (on('teatro_breve', true) && it.theater_id) {
        const { data: el } = await admin.from('teatro_elenco').select('person_id').eq('theater_id', it.theater_id)
        const uids = await usersDePeople((el ?? []).map((e: any) => e.person_id))
        if (uids.length) { await enviar(uids, { title: '🎭 Seu teatro começa em breve', body: `${it.titulo}${hora ? ' às ' + hora : ''}`, url: '/minhas-atividades', tag: 'teatro-' + it.id }); mandou = true }
      }
      // Ministração do ministrante
      if (on('min_breve', true) && it.ministracao_id) {
        const { data: mi } = await admin.from('ministrações').select('ministrante_id').eq('id', it.ministracao_id).maybeSingle()
        const uids = await usersDePeople([(mi as any)?.ministrante_id].filter(Boolean))
        if (uids.length) { await enviar(uids, { title: '🎤 Sua ministração começa em breve', body: `${it.titulo}${hora ? ' às ' + hora : ''}`, url: '/minhas-atividades', tag: 'min-' + it.id }); mandou = true }
      }
      if (mandou) marcarCron.push(it.id)
    }
    if (marcarCron.length) await admin.from('cronograma_eventos').update({ push_em: new Date().toISOString() }).in('id', marcarCron)

    // ================= ESCALAS =================
    const marcarEsc: string[] = []
    if (on('escala_breve', true)) {
      const { data: escs } = await admin.from('escalas')
        .select('id,person_id,title,location,start_time,status')
        .is('push_em', null).gte('start_time', min).lte('start_time', max)
      for (const e of escs ?? []) {
        if (e.status === 'concluido' || e.status === 'cancelado' || !e.person_id) continue
        const uids = await usersDePeople([e.person_id])
        if (uids.length) {
          const hora = horaBR(e.start_time)
          await enviar(uids, { title: '📋 Sua escala começa em breve', body: `${e.title}${hora ? ' às ' + hora : ''}${e.location ? ' · ' + e.location : ''}`, url: '/minhas-atividades', tag: 'escala-' + e.id })
          marcarEsc.push(e.id)
        }
      }
      if (marcarEsc.length) await admin.from('escalas').update({ push_em: new Date().toISOString() }).in('id', marcarEsc)
    }

    // ================= VALOR A PAGAR (10 dias antes do evento, 1x) =================
    let finCobrados = 0
    if (on('fin_a_pagar', false)) {
      const DIA = 86400000
      const { data: evs } = await admin.from('events')
        .select('id,name,start_date,valor_encontrista,valor_encontreiro')
        .not('start_date', 'is', null)
      for (const ev of evs ?? []) {
        const falta = new Date(ev.start_date).getTime() - agora
        if (!(falta > 0 && falta <= 10 * DIA)) continue                 // só dentro dos 10 dias antes
        const flagKey = 'fin_cobranca_' + ev.id
        const { data: fl } = await admin.from('configuracoes').select('valor').eq('chave', flagKey).maybeSingle()
        if ((fl as any)?.valor === '1') continue                         // já cobrou esse evento
        const valEnc = Number(ev.valor_encontrista) || 0
        const valTrab = Number(ev.valor_encontreiro) || 0
        if (valEnc <= 0 && valTrab <= 0) continue                        // sem valores definidos
        const [{ data: ppl }, { data: pags }] = await Promise.all([
          admin.from('people').select('id,user_id,role_type').eq('event_id', ev.id).not('user_id', 'is', null),
          admin.from('financeiro').select('person_id,valor,status').eq('event_id', ev.id),
        ])
        const pagoPor: Record<string, number> = {}
        for (const p of pags ?? []) if (p.status === 'pago' && p.person_id) pagoPor[p.person_id] = (pagoPor[p.person_id] || 0) + (Number(p.valor) || 0)
        for (const p of ppl ?? []) {
          const esperado = p.role_type === 'encounterer' ? valEnc : valTrab
          if (esperado <= 0 || !p.user_id) continue
          const dev = esperado - (pagoPor[p.id] || 0)
          if (dev <= 0.009) continue
          await enviar([p.user_id], { title: '💰 Falta acertar sua inscrição', body: `O encontro está chegando. Ainda falta pagar R$ ${dev.toFixed(2).replace('.', ',')}.`, url: '/', tag: 'fin-' + ev.id })
          finCobrados++
        }
        await admin.from('configuracoes').upsert({ chave: flagKey, valor: '1' }, { onConflict: 'chave' })
      }
    }

    return json({ ok: true, cron: marcarCron.length, escalas: marcarEsc.length, fin: finCobrados, enviados })
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500)
  }
})
