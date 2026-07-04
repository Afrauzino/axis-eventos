import { useEffect, useState } from 'react'

// #2 — Botão "Instalar aplicativo".
// Android/Chrome: usa o evento beforeinstallprompt (instalação em 1 toque quando o navegador oferece).
// Se o navegador não oferecer o pop-up (ou for iPhone), mostra o passo a passo curtinho.
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

function jaInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
}
function ehIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
}
function ehAndroid() {
  return /android/i.test(navigator.userAgent)
}

export default function InstallPWA({ variant = 'card' }: { variant?: 'card' | 'inline' }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)
  const [instalado, setInstalado] = useState(jaInstalado())
  const [ajuda, setAjuda] = useState<null | 'ios' | 'android'>(null)

  useEffect(() => {
    if (instalado) return
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent) }
    const onInstalled = () => setInstalado(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [instalado])

  if (instalado) return null
  // Mostra em celular (Android/iPhone) ou quando o navegador já ofereceu o pop-up. No PC sem pop-up, esconde.
  if (!deferred && !ehIOS() && !ehAndroid()) return null

  async function instalar() {
    if (deferred) {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      if (outcome === 'accepted') setInstalado(true)
      setDeferred(null)
    } else if (ehIOS()) {
      setAjuda(v => v === 'ios' ? null : 'ios')
    } else {
      setAjuda(v => v === 'android' ? null : 'android')
    }
  }

  const wrap: React.CSSProperties = variant === 'inline'
    ? { marginTop: 10 }
    : { background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: 14, marginBottom: 16 }

  return (
    <div style={wrap}>
      <button
        onClick={instalar}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 12, padding: '12px 16px',
          fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        <span className="icon icon-sm">install_mobile</span>
        Instalar aplicativo
      </button>
      {ajuda === 'ios' && (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, textAlign: 'center' }}>
          No iPhone: toque em <b>Compartilhar</b> <span style={{ fontSize: 15 }}>⬆️</span> e depois em
          <b> "Adicionar à Tela de Início"</b>.
        </div>
      )}
      {ajuda === 'android' && (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, textAlign: 'center' }}>
          No Android: toque no menu <b>⋮</b> do navegador e escolha
          <b> "Instalar aplicativo"</b> (ou "Adicionar à tela inicial").
        </div>
      )}
    </div>
  )
}
