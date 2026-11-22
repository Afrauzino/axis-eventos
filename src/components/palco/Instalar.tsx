import { useEffect, useState } from 'react'
import { vidroChip, vidroPainel } from './vidro'

// Instalar o link do Palco ↔ Mesa como APP (tela inicial), no Android e no iOS.
// • Troca o manifesto da página por um próprio do link (api/palco-manifest): o app
//   instalado abre DIRETO naquele pedal/monitor, separado do app AXIS principal.
// • Android/Chrome: botão "Instalar" abre a instalação nativa (beforeinstallprompt).
// • iPhone/iPad: a Apple não deixa instalar por botão — mostramos o passo a passo
//   (Compartilhar → Adicionar à Tela de Início). Funciona no Safari.

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

// captura cedo (o evento pode vir antes do React montar o botão)
let promptGuardado: BIPEvent | null = null
const ouvintes = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptGuardado = e as BIPEvent; ouvintes.forEach(f => f()) })
  window.addEventListener('appinstalled', () => { promptGuardado = null; ouvintes.forEach(f => f()) })
}

const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const instalado = () => window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || (navigator as any).standalone === true

function meta(nome: string, valor: string) {
  let m = document.querySelector(`meta[name="${nome}"]`) as HTMLMetaElement | null
  if (!m) { m = document.createElement('meta'); m.name = nome; document.head.appendChild(m) }
  m.content = valor
}

/** Liga o manifesto próprio do link + metas do iOS (nome do ícone, barra escura). */
export function useManifestPalco(tipo: 'ped' | 'mesa' | 'cel', token: string | null, nome?: string | null) {
  useEffect(() => {
    if (!token) return
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
    if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link) }
    const q = new URLSearchParams({ tipo, t: token, ...(nome ? { n: nome } : {}) })
    link.href = `/api/palco-manifest?${q}`
    meta('apple-mobile-web-app-capable', 'yes')
    meta('mobile-web-app-capable', 'yes')
    meta('apple-mobile-web-app-status-bar-style', 'black-translucent')
    meta('apple-mobile-web-app-title', tipo === 'ped' ? (nome || 'Pedal') : tipo === 'mesa' ? 'Mesa' : 'Palco')
    meta('theme-color', '#05070d')
  }, [tipo, token, nome])
}

export function BotaoInstalar() {
  const [, forcar] = useState(0)
  const [ajuda, setAjuda] = useState(false)
  useEffect(() => { const f = () => forcar(x => x + 1); ouvintes.add(f); return () => { ouvintes.delete(f) } }, [])
  if (instalado()) return null

  async function instalar() {
    if (promptGuardado) {
      const p = promptGuardado
      try { await p.prompt(); await p.userChoice } catch {}
      promptGuardado = null; forcar(x => x + 1)
    } else setAjuda(true)
  }

  const ios = ehIOS()
  return (
    <>
      <button onClick={instalar} style={vidroChip}>📲 Instalar</button>
      {ajuda && (
        <div onClick={() => setAjuda(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...vidroPainel(.72), borderRadius: 24, padding: 20, width: '100%', maxWidth: 420, color: '#f8fafc', marginBottom: 'env(safe-area-inset-bottom)' }}>
            <p style={{ fontSize: 19, fontWeight: 900, marginBottom: 12 }}>📲 Instalar como app</p>
            {ios ? (
              <ol style={{ paddingLeft: 20, lineHeight: 1.7, fontSize: 16 }}>
                <li>Abra este link no <b>Safari</b></li>
                <li>Toque em <b>Compartilhar</b> <span style={{ fontSize: 18 }}>⎋</span> (quadrado com seta pra cima)</li>
                <li>Escolha <b>Adicionar à Tela de Início</b></li>
                <li>Toque em <b>Adicionar</b></li>
              </ol>
            ) : (
              <ol style={{ paddingLeft: 20, lineHeight: 1.7, fontSize: 16 }}>
                <li>Abra este link no <b>Chrome</b></li>
                <li>Toque no menu <b>⋮</b> (canto de cima)</li>
                <li>Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b></li>
              </ol>
            )}
            <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 10 }}>O ícone abre direto nesta tela, em tela cheia, sem login.</p>
            <button onClick={() => setAjuda(false)} style={{ ...vidroChip, width: '100%', marginTop: 14, padding: 12, fontSize: 15 }}>Entendi</button>
          </div>
        </div>
      )}
    </>
  )
}
