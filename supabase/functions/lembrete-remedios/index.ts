// Edge Function: lembrete-remedios
// Roda a cada poucos minutos (pg_cron). Acha doses que vão vencer em ~10 min,
// e avisa no celular a EQUIPE responsável (events.med_equipe_id). Marca push_em
// pra não repetir. Autentica por um segredo simples (CRON_SECRET).
//
// Secrets necessários (Edge Functions -> Secrets):
//   CRON_SECRET  (um texto qualquer que você inventa; o mesmo vai no agendamento)
//   VAPID_PUBLIC, VAPID_PRIVATE  (já existem)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  (injetados pelo Supabase)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-cron-secret, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

function horaBR(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) } catch { return '' }
}

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
    const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC')!
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE')!
    webpush.setVapidDetails('mailto:afrauzino@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE)
    const admin = createClient(url, serviceKey)

    const agora = Date.now()
    const min = new Date(agora - 3 * 60000).toISOString()   // até 3 min atrás (folga)
    const max = new Date(agora + 11 * 60000).toISOString()  // até 11 min à frente (~10 min antes)

    // Doses vencendo, ainda não entregues e ainda não avisadas
    const { data: doses } = await admin.from('med_agenda')
      .select('id,event_id,person_id,nome,dosagem,horario')
      .eq('entregue', false).is('push_em', null)
      .gte('horario', min).lte('horario', max)
    if (!doses || doses.length === 0) return json({ ok: true, doses: 0 })

    // Agrupa por evento
    const porEvento = new Map<string, any[]>()
    for (const d of doses) {
      if (!d.event_id) continue
      const arr = porEvento.get(d.event_id) ?? []
      arr.push(d)
      porEvento.set(d.event_id, arr)
    }

    let enviados = 0
    const marcar: string[] = []

    for (const [eventId, lista] of porEvento) {
      // Equipe responsável desse evento
      const { data: ev } = await admin.from('events').select('med_equipe_id').eq('id', eventId).maybeSingle()
      if (!ev?.med_equipe_id) continue  // sem equipe definida → não avisa (e não marca, avisa quando definir)

      const { data: pt } = await admin.from('people_teams').select('person_id').eq('team_id', ev.med_equipe_id)
      const personIds = [...new Set((pt ?? []).map((x: any) => x.person_id).filter(Boolean))]
      if (!personIds.length) continue
      const { data: pe } = await admin.from('people').select('user_id').in('id', personIds).not('user_id', 'is', null)
      const userIds = [...new Set((pe ?? []).map((p: any) => p.user_id).filter(Boolean))]
      if (!userIds.length) continue
      const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', userIds)
      if (!subs || !subs.length) { for (const d of lista) marcar.push(d.id); continue }

      // Nome de cada pessoa das doses
      const pids = [...new Set(lista.map(d => d.person_id).filter(Boolean))]
      const { data: nomes } = await admin.from('people').select('id,name').in('id', pids)
      const nomeDe: Record<string, string> = {}
      for (const n of nomes ?? []) nomeDe[n.id] = n.name

      for (const d of lista) {
        const quem = nomeDe[d.person_id] ?? 'Participante'
        const payload = JSON.stringify({
          title: 'Hora do remédio',
          body: `${quem} — ${d.nome}${d.dosagem ? ` (${d.dosagem})` : ''} às ${horaBR(d.horario)}`,
          url: '/saude/medicamentos',
          tag: 'remedio-' + d.id,
        })
        for (const s of subs) {
          try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); enviados++ }
          catch (e: any) { const c = e?.statusCode; if (c === 404 || c === 410) { try { await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint) } catch {} } }
        }
        marcar.push(d.id)
      }
    }

    if (marcar.length) await admin.from('med_agenda').update({ push_em: new Date().toISOString() }).in('id', marcar)
    return json({ ok: true, doses: doses.length, avisadas: marcar.length, enviados })
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500)
  }
})
