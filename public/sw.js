// Service Worker do AXIS — network-first (nunca serve versão velha quando online).
// Não intercepta o Supabase (outra origem) nem chamadas não-GET.
// v16: só guarda respostas OK; app shell ('/') pra navegação offline; poda o cache.
const CACHE = 'axis-runtime-v16'
const SHELL = ['/', '/index.html']
const MAX_ITENS = 200   // poda: assets com hash velho iam acumulando pra sempre

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

self.addEventListener('install', (event) => {
  // Guarda o app shell (index.html) pra abrir offline em QUALQUER rota do SPA.
  // Falha aqui não pode travar a instalação do SW (senão o push para de funcionar).
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE)
      await Promise.all(SHELL.map(async (u) => {
        const res = await fetch(u, { cache: 'reload' })
        if (res.ok) await cache.put(u, res)
      }))
    } catch {}
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

async function podar(cache) {
  const keys = await cache.keys()
  const sobra = keys.length - MAX_ITENS
  if (sobra <= 0) return
  // keys() vem na ordem de inserção → apaga os mais antigos (nunca o shell)
  const velhos = keys.filter(k => !SHELL.includes(new URL(k.url).pathname)).slice(0, sobra)
  await Promise.all(velhos.map(k => cache.delete(k)))
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Só mexe em recursos da própria origem (deixa Supabase/YouTube passarem direto)
  if (url.origin !== self.location.origin) return

  event.respondWith((async () => {
    try {
      const fresh = await fetch(req)
      const tipo = fresh.headers.get('content-type') || ''
      // /assets/* que volta como HTML = chunk que não existe mais (a Vercel devolve
      // o index.html). NUNCA guardar isso — e se houver a versão boa no cache, usa ela.
      const chunkFantasma = url.pathname.startsWith('/assets/') && tipo.includes('text/html')
      if (chunkFantasma) {
        const cached = await caches.match(req)
        return cached || fresh
      }
      // Só guarda resposta OK da própria origem (nada de 404/500/redirect opaco)
      if (fresh.ok && fresh.type === 'basic' && !fresh.redirected) {
        const copia = fresh.clone()
        const copiaShell = req.mode === 'navigate' ? fresh.clone() : null
        event.waitUntil((async () => {
          const cache = await caches.open(CACHE)
          await cache.put(req, copia)
          // navegação OK = index.html atual → atualiza o shell do offline
          if (copiaShell) await cache.put('/', copiaShell)
          await podar(cache)
        })().catch(() => {}))
      }
      return fresh
    } catch {
      const cached = await caches.match(req)
      if (cached) return cached
      if (req.mode === 'navigate') {
        // rotas do SPA (/impressao, /admin…) caem no app shell
        const shell = (await caches.match('/')) || (await caches.match('/index.html'))
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
    badge: '/axis-push-badge.png', // A branco em fundo transparente (silhueta da barra de status)
    icon: '/axis-push-icon.png',   // logo AXIS (quadrado escuro) no corpo da notificação
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
