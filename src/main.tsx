import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { aplicarCorLocal } from './lib/tema'

// Aplica a cor guardada no aparelho ANTES de renderizar (evita o "piscar" da cor)
aplicarCorLocal()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)

// #2 — PWA: registra o service worker (instalável como app). Só em produção (https/localhost).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
