// Service Worker do AXIS — network-first (nunca serve versão velha quando online).
// Não intercepta o Supabase (outra origem) nem chamadas não-GET.
const CACHE = 'axis-runtime-v10'

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
    icon: '/axis-192.png',
    badge: '/axis-192.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
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
