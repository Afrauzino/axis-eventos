import { supabase } from './supabase'
import { carregarConfig } from './tema'

// Web Push — faz o aparelho "assinar" pra receber notificação com o app FECHADO.
// A chave PÚBLICA pode ficar aqui (é pública mesmo). A privada fica só na Edge Function.
const VAPID_PUBLIC = 'BBGfLWywD_AmYo_c2gkEdN9tlZbThxbnJW4ya6zKy5kOkRnZXKOZNDVLVRdzhgdM7uHa5LneNpRW2_YjDHxDlMY'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushSuportado(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// Grava/reamarra a assinatura DESTE aparelho ao usuário logado. Usa a função
// SECURITY DEFINER (sql/68) que apaga o dono antigo do mesmo endpoint e grava pro
// atual — resolve o caso de várias contas no mesmo celular. Se a função ainda não
// existe (antes de rodar o sql/68), cai no upsert antigo pra não travar.
async function salvarAssinatura(userId: string, j: any): Promise<boolean> {
  if (!j?.keys?.p256dh || !j?.keys?.auth) return false
  const ua = navigator.userAgent.slice(0, 200)
  const { error } = await supabase.rpc('salvar_push_assinatura', {
    p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: ua,
  })
  if (error) {
    // fallback pré-migração (funciona pra 1ª assinatura do mesmo usuário)
    await supabase.from('push_subscriptions').upsert({
      user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: ua,
    }, { onConflict: 'endpoint' })
  }
  return true
}

// Auto-cura: o navegador às vezes TROCA a assinatura sozinho (rotação). O SW avisa
// (postMessage 'push-resubscribe'); aqui a gente regrava pra conta logada na hora.
let ouvinteResubOn = false
function garantirOuvinteResub() {
  if (ouvinteResubOn || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  ouvinteResubOn = true
  navigator.serviceWorker.addEventListener('message', async (e: any) => {
    if (e?.data?.type !== 'push-resubscribe' || !e.data.sub) return
    try {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      if (uid) await salvarAssinatura(uid, e.data.sub)
    } catch {}
  })
}

// Assina o push deste aparelho e salva no Supabase. Idempotente (upsert por endpoint).
export async function ativarPush(userId: string): Promise<boolean> {
  try {
    if (!pushSuportado() || !userId) return false
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission()
      if (p !== 'granted') return false
    }
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
    }
    const j: any = sub.toJSON()
    if (!j?.keys?.p256dh || !j?.keys?.auth) return false
    await salvarAssinatura(userId, j)
    garantirOuvinteResub()
    return true
  } catch (e) {
    console.warn('push: não foi possível ativar', e)
    return false
  }
}

// Dispara uma notificação Web Push (chama a Edge Function 'enviar-push').
// Ex.: enviarPush({ notify_admins:true, title:'Nova inscrição', body:'...', url:'/admin' })
export async function enviarPush(opts: { user_ids?: string[]; person_ids?: string[]; notify_admins?: boolean; incluir_autor?: boolean; alerta?: { event_id: string; target_type: string; target_team_ids?: string[] }; title: string; body: string; url?: string; tag?: string }): Promise<any> {
  try { const { data } = await supabase.functions.invoke('enviar-push', { body: { url: '/', ...opts } }); return data } catch (e) { return { error: String(e) } }
}

// Teste de 1 toque: assina o aparelho, mostra uma notificação LOCAL (prova de exibição)
// e manda um push do SERVIDOR pra você mesmo. Retorna onde parou, pra diagnosticar.
export async function testarPush(userId: string): Promise<{ ok: boolean; etapa: 'suporte' | 'assinar' | 'enviar'; localOk: boolean; detalhe?: any }> {
  if (!pushSuportado()) return { ok: false, etapa: 'suporte', localOk: false }
  const assinou = await ativarPush(userId)
  if (!assinou) return { ok: false, etapa: 'assinar', localOk: false }
  // 1) Prova LOCAL: o próprio aparelho mostra uma notificação agora (sem servidor).
  let localOk = false
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification('🔔 Teste do AXIS (local)', { body: 'Se você vê isso, o aparelho exibe notificações.', icon: '/axis-192.png', badge: '/axis-192.png', tag: 'teste-local' })
    localOk = true
  } catch {}
  // 2) Prova SERVIDOR: push de verdade (Edge Function) pra você mesmo.
  const r = await enviarPush({ user_ids: [userId], incluir_autor: true, title: '🔔 Teste do AXIS (servidor)', body: 'O push do servidor chegou!', url: '/' })
  return { ok: !!(r && r.enviados > 0), etapa: 'enviar', localOk, detalhe: r }
}

// ===== Diagnóstico completo (roda no próprio aparelho) =====
// Checa TODOS os elos do push e diz, em português claro, onde está quebrado.
export type PassoDiag = { id: string; label: string; status: 'ok' | 'warn' | 'fail' | 'info'; detalhe?: string }
export type ResultadoDiag = { passos: PassoDiag[]; veredito: string; vereditoStatus: 'ok' | 'warn' | 'fail' }

export async function diagnosticoPush(userId: string): Promise<ResultadoDiag> {
  const passos: PassoDiag[] = []
  const add = (p: PassoDiag) => { passos.push(p) }

  // 1) Suporte
  if (!pushSuportado()) {
    add({ id: 'suporte', label: 'Suporte a notificações', status: 'fail', detalhe: 'Este navegador/aparelho não tem Web Push.' })
    return { passos, veredito: 'Seu navegador/aparelho não suporta notificações. Use o app AXIS instalado (APK) no celular.', vereditoStatus: 'fail' }
  }
  add({ id: 'suporte', label: 'Suporte a notificações', status: 'ok' })

  // 2) App instalado?
  const standalone = (() => { try { return window.matchMedia('(display-mode: standalone)').matches } catch { return false } })()
  add({ id: 'app', label: 'Rodando como app instalado', status: standalone ? 'ok' : 'warn', detalhe: standalone ? undefined : 'Você está no navegador. Pra receber com o app FECHADO, use o app instalado (APK).' })

  // 3) Permissão
  if (Notification.permission === 'default') { try { await Notification.requestPermission() } catch {} }
  if (Notification.permission === 'denied') {
    add({ id: 'perm', label: 'Permissão de notificação', status: 'fail', detalhe: 'BLOQUEADA no aparelho.' })
    return { passos, veredito: 'As notificações estão BLOQUEADAS. Vá em Config. do Android → Apps → AXIS → Notificações → Permitir. Depois rode o diagnóstico de novo.', vereditoStatus: 'fail' }
  }
  add({ id: 'perm', label: 'Permissão de notificação', status: Notification.permission === 'granted' ? 'ok' : 'warn', detalhe: Notification.permission === 'granted' ? undefined : 'Ainda não concedida.' })

  // 4) Service Worker
  let reg: ServiceWorkerRegistration | null = null
  try { reg = await navigator.serviceWorker.ready } catch {}
  add({ id: 'sw', label: 'Motor de background (Service Worker)', status: reg?.active ? 'ok' : 'fail', detalhe: reg?.active ? undefined : 'Não está ativo. Feche e reabra o app.' })

  // 5) Assinatura neste aparelho (cria se faltar)
  let sub = reg ? await reg.pushManager.getSubscription() : null
  if (!sub) { try { await ativarPush(userId) } catch {}; sub = reg ? await reg.pushManager.getSubscription() : null }
  add({ id: 'sub_local', label: 'Assinatura deste aparelho', status: sub ? 'ok' : 'fail', detalhe: sub ? undefined : 'Não consegui criar. Toque em "Reativar neste aparelho".' })

  // 6) Assinatura salva no servidor (e amarrada a VOCÊ)
  let servidorTem = false, totalServidor = 0
  try {
    const { data } = await supabase.from('push_subscriptions').select('endpoint').eq('user_id', userId)
    totalServidor = (data ?? []).length
    servidorTem = !!(sub && (data ?? []).some((r: any) => r.endpoint === sub!.endpoint))
  } catch {}
  add({
    id: 'sub_serv', label: 'Assinatura salva no servidor (pra você)',
    status: servidorTem ? 'ok' : 'fail',
    detalhe: servidorTem ? `${totalServidor} aparelho(s) ligado(s) à sua conta.`
      : (totalServidor > 0 ? 'Há assinatura, mas de outra conta neste aparelho. Toque em "Reativar" pra trazer pra você.' : 'Nenhuma assinatura sua. Toque em "Reativar neste aparelho".'),
  })

  // 7) Regras (o filtro que pode estar suprimindo tudo)
  try {
    const raw = await carregarConfig('notif_regras')
    if (!raw) add({ id: 'regras', label: 'Regras de notificação', status: 'ok', detalhe: 'Usando o padrão (a maioria ligada).' })
    else {
      let map: Record<string, boolean> = {}
      try { map = JSON.parse(raw) } catch {}
      const chaves = Object.keys(map)
      const ligadas = chaves.filter(k => map[k]).length
      if (chaves.length > 0 && ligadas === 0) add({ id: 'regras', label: 'Regras de notificação', status: 'fail', detalhe: 'TODAS desligadas! Nenhum evento vira push. Vá em Administração → Notificações → Regras e ligue.' })
      else if (ligadas > 0 && ligadas <= 3) add({ id: 'regras', label: 'Regras de notificação', status: 'warn', detalhe: `Só ${ligadas} regra(s) ligada(s). Quase tudo está desligado em Notificações → Regras.` })
      else add({ id: 'regras', label: 'Regras de notificação', status: 'ok', detalhe: `${ligadas} regra(s) ligada(s).` })
    }
  } catch {}

  // 8) Notificação LOCAL (o aparelho consegue exibir?)
  let localOk = false
  try {
    if (reg) { await reg.showNotification('🔔 Diagnóstico AXIS (local)', { body: 'Se você VÊ isto, o aparelho exibe notificações.', icon: '/axis-192.png', badge: '/axis-192.png', tag: 'diag-local' }); localOk = true }
  } catch {}
  add({ id: 'local', label: 'O aparelho exibe notificações', status: localOk ? 'ok' : 'fail', detalhe: localOk ? 'Confira a bandeja/topo da tela agora.' : 'Não exibiu. É a permissão do Android (Config → Apps → AXIS → Notificações).' })

  // 9) Push do SERVIDOR (app fechado)
  let enviados = 0, falhas = 0, semAlvos = false, erroServ: string | undefined
  try {
    const rr: any = await enviarPush({ user_ids: [userId], incluir_autor: true, title: '🔔 Diagnóstico AXIS (servidor)', body: 'O push do SERVIDOR chegou! 🎉', url: '/', tag: 'diag-serv' })
    enviados = rr?.enviados ?? 0; falhas = rr?.falhas ?? 0; semAlvos = !!rr?.semAlvos; if (rr?.error) erroServ = String(rr.error)
  } catch (e) { erroServ = String(e) }
  add({
    id: 'servidor', label: 'Push do servidor entregue', status: enviados > 0 ? 'ok' : 'fail',
    detalhe: enviados > 0 ? `Enviado para ${enviados} aparelho(s).`
      : erroServ ? ('Erro no servidor: ' + erroServ)
      : semAlvos ? 'O servidor não achou assinatura sua (reative).'
      : `Não entregou (falhas: ${falhas}). Confira a Edge Function enviar-push / chaves VAPID.`,
  })

  // ===== Veredito =====
  const regraFail = passos.find(p => p.id === 'regras' && p.status === 'fail')
  if (regraFail) return { passos, veredito: '⚠️ O culpado é as REGRAS: estão TODAS desligadas, então nenhum evento vira push (o teste passa porque ignora as regras). Vá em Administração → Notificações → Regras e ligue o que quer receber.', vereditoStatus: 'fail' }
  if (enviados > 0 && localOk) return { passos, veredito: '✅ Tudo certo neste aparelho! O push do servidor chegou e o aparelho exibe. Se com o app FECHADO ainda não vê na bandeja, confira Config. do Android → Apps → AXIS → Notificações (deixe ligado, sem "silenciar").', vereditoStatus: 'ok' }
  if (enviados > 0 && !localOk) return { passos, veredito: 'O servidor entregou, mas o aparelho não exibiu a local — é a permissão do Android. Config. → Apps → AXIS → Notificações → Permitir.', vereditoStatus: 'warn' }
  if (enviados === 0 && sub) return { passos, veredito: '❌ Sua assinatura não está no servidor (ou é de outra conta neste celular). Toque em "Reativar neste aparelho" e rode de novo. Se persistir, falta REPUBLICAR a Edge Function enviar-push.', vereditoStatus: 'fail' }
  return { passos, veredito: '❌ Não consegui assinar este aparelho. Verifique a permissão de notificação do Android e tente "Reativar".', vereditoStatus: 'fail' }
}

// Desativa (remove a assinatura deste aparelho)
export async function desativarPush(userId: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      const ep = sub.endpoint
      await sub.unsubscribe()
      await supabase.from('push_subscriptions').delete().eq('endpoint', ep).eq('user_id', userId)
    }
  } catch {}
}
