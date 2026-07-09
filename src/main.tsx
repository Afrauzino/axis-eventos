import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { aplicarCorLocal } from './lib/tema'

// Aplica a cor guardada no aparelho ANTES de renderizar (evita o "piscar" da cor)
aplicarCorLocal()

// Auto-recuperação: depois de um deploy, o celular pode ter um index.html velho
// em cache apontando para pedaços (chunks) de JS que já não existem → tela branca.
// Ao detectar essa falha, recarrega UMA vez para pegar a versão nova.
function recarregarUmaVez() {
  try {
    const agora = Date.now()
    const ultimo = Number(sessionStorage.getItem('axis_reload_chunk') || '0')
    if (agora - ultimo > 15000) {
      sessionStorage.setItem('axis_reload_chunk', String(agora))
      location.reload()
    }
  } catch { location.reload() }
}
const ehErroDeChunk = (m: string) => /Loading chunk|dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically/i.test(m || '')
window.addEventListener('vite:preloadError', (e: any) => { e?.preventDefault?.(); recarregarUmaVez() })
window.addEventListener('error', (e: any) => { if (ehErroDeChunk(e?.message)) recarregarUmaVez() })
window.addEventListener('unhandledrejection', (e: any) => { if (ehErroDeChunk(String(e?.reason?.message ?? e?.reason ?? ''))) recarregarUmaVez() })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)

// #2 — PWA: registra o service worker (instalável como app). Só em produção (https/localhost).
// O SW é network-first: sempre pega a versão nova quando online. Por isso NÃO
// recarregamos no controllerchange (evita o "piscar" da tela antiga). A recarga
// só acontece via a rede de segurança acima, quando um pedaço realmente falha.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      try { reg.update() } catch {}
    }).catch(() => {})
  })
}
