// Edge Function: enviar-push
// Envia uma notificação Web Push (app fechado) para todos os aparelhos de 1+ pessoas.
// Chamada pelo app quando algo acontece (nova inscrição, marcaram no mural, etc.).
// Env vars necessárias no Supabase (Edge Functions -> Secrets):
//   VAPID_PUBLIC, VAPID_PRIVATE  (as chaves geradas)
//   (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já são injetados)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url        = Deno.env.get('SUPABASE_URL')!
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC')!
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE')!

    // Só quem está logado pode disparar
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Não autenticado' }, 401)

    webpush.setVapidDetails('mailto:afrauzino@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE)

    const { user_ids, person_ids, notify_admins, alerta, title, body, url: link, tag } = await req.json().catch(() => ({}))
    const admin = createClient(url, serviceKey)

    const alvos = new Set<string>(Array.isArray(user_ids) ? user_ids.filter(Boolean) : [])
    // Alvos por pessoa (people.id) — resolve pro user_id (escala, ministração, teatro, remédio…)
    if (Array.isArray(person_ids) && person_ids.length) {
      const { data } = await admin.from('people').select('user_id').in('id', person_ids.filter(Boolean)).not('user_id', 'is', null)
      for (const p of data ?? []) if (p.user_id) alvos.add(p.user_id)
    }
    // "avisar os admins": a função resolve sozinha (o cliente não precisa ler a lista)
    if (notify_admins) {
      const { data: adm } = await admin.from('profiles').select('user_id').or('is_admin.eq.true,user_role.in.(admin,pastor)')
      for (const a of adm ?? []) if (a.user_id) alvos.add(a.user_id)
    }
    // Alerta: resolve o público-alvo pelo evento (todos / encontreiros / encontristas / equipe)
    if (alerta?.event_id && alerta?.target_type) {
      const tt = alerta.target_type as string
      const addPeople = (rows: any[] | null) => { for (const p of rows ?? []) if (p?.user_id) alvos.add(p.user_id) }
      if (tt === 'all') {
        const { data } = await admin.from('people').select('user_id').eq('event_id', alerta.event_id).not('user_id', 'is', null)
        addPeople(data)
      } else if (tt === 'worker' || tt === 'encounterer') {
        const { data } = await admin.from('people').select('user_id').eq('event_id', alerta.event_id).eq('role_type', tt).not('user_id', 'is', null)
        addPeople(data)
      } else if (tt === 'team' || tt === 'multiple') {
        const teamIds = Array.isArray(alerta.target_team_ids) ? alerta.target_team_ids.filter(Boolean) : []
        if (teamIds.length) {
          const { data: pt } = await admin.from('people_teams').select('person_id').in('team_id', teamIds)
          const personIds = [...new Set((pt ?? []).map((x: any) => x.person_id).filter(Boolean))]
          if (personIds.length) {
            const { data: pe } = await admin.from('people').select('user_id').in('id', personIds).not('user_id', 'is', null)
            addPeople(pe)
          }
        }
      }
    }
    // Não notificar quem disparou (o próprio autor do alerta)
    if (user?.id) alvos.delete(user.id)
    if (alvos.size === 0) return json({ ok: true, enviados: 0, falhas: 0, semAlvos: true })
    const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', [...alvos])

    const payload = JSON.stringify({ title: title || 'AXIS Eventos', body: body || '', url: link || '/', tag: tag || undefined })
    let enviados = 0, falhas = 0
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        enviados++
      } catch (e: any) {
        falhas++
        const code = e?.statusCode
        if (code === 404 || code === 410) { // assinatura morta -> limpa
          try { await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint) } catch {}
        }
      }
    }
    return json({ ok: true, enviados, falhas })
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500)
  }
})
