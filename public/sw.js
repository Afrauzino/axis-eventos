// Service Worker do AXIS — network-first (nunca serve versão velha quando online).
// Não intercepta o Supabase (outra origem) nem chamadas não-GET.
const CACHE = 'axis-runtime-v14'

// Chave pública VAPID (mesma do app) — pra reassinar sozinho se o navegador trocar.
const VAPID_PUBLIC = 'BBGfLWywD_AmYo_c2gkEdN9tlZbThxbnJW4ya6zKy5kOkRnZXKOZNDVLVRdzhgdM7uHa5LneNpRW2_YjDHxDlMY'
function b64ToBytes(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Só mexe em recursos da própria origem (deixa Supabase/YouTube passarem direto)
  if (url.origin !== self.location.origin) return

  event.respondWith((async () => {
    try {
      const fresh = await fetch(req)
      const cache = await caches.open(CACHE)
      cache.put(req, fresh.clone())
      return fresh
    } catch {
      const cached = await caches.match(req)
      if (cached) return cached
      if (req.mode === 'navigate') {
        const shell = await caches.match('/index.html')
        if (shell) return shell
      }
      throw new Error('offline')
    }
  })())
})

// ===== Web Push — notificação com o app FECHADO =====
self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch { d = { body: event.data && event.data.text() } }
  const title = d.title || 'AXIS Eventos'
  const options = {
    body: d.body || '',
    badge: '/axis-badge.png',  // só o ícone pequeno branco (barra de status) — sem logo grande do lado
    icon: '/transparente.png', // ícone grande TRANSPARENTE → o Android não inventa um monograma "A"
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// O navegador pode TROCAR a assinatura sozinho (rotação). Sem isto, o push morre
// calado até a pessoa reabrir o app. Aqui reassinamos na hora e avisamos qualquer
// aba aberta pra regravar no servidor (a aba tem o login pra passar na RLS).
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToBytes(VAPID_PUBLIC),
      })
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of all) { try { c.postMessage({ type: 'push-resubscribe', sub: sub.toJSON() }) } catch {} }
    } catch (e) {}
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) { if ('focus' in c) { try { c.navigate(url) } catch {} ; return c.focus() } }
    if (self.clients.openWindow) return self.clients.openWindow(url)
  })())
})
