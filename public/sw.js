// Service Worker do AXIS — network-first (nunca serve versão velha quando online).
// Não intercepta o Supabase (outra origem) nem chamadas não-GET.
const CACHE = 'axis-runtime-v8'

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
