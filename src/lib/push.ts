import { supabase } from './supabase'

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
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
      user_agent: navigator.userAgent.slice(0, 200),
    }, { onConflict: 'endpoint' })
    return true
  } catch (e) {
    console.warn('push: não foi possível ativar', e)
    return false
  }
}

// Dispara uma notificação Web Push (chama a Edge Function 'enviar-push').
// Ex.: enviarPush({ notify_admins:true, title:'Nova inscrição', body:'...', url:'/admin' })
export async function enviarPush(opts: { user_ids?: string[]; notify_admins?: boolean; title: string; body: string; url?: string; tag?: string }): Promise<void> {
  try { await supabase.functions.invoke('enviar-push', { body: { url: '/', ...opts } }) } catch {}
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
