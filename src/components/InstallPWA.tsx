import { useEffect, useState } from 'react'

// #2 — Botão "Instalar aplicativo".
// Android/Chrome: usa o evento beforeinstallprompt (instalação em 1 toque).
// iPhone/Safari: mostra o passo a passo (Compartilhar → Adicionar à Tela de Início).
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

function jaInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
}
function ehIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
}

export default function InstallPWA({ variant = 'card' }: { variant?: 'card' | 'inline' }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)
  const [instalado, setInstalado] = useState(jaInstalado())
  const [ajudaIOS, setAjudaIOS] = useState(false)

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
  // Sem prompt disponível e não é iOS → navegador não suporta instalar; não mostra nada.
  if (!deferred && !ehIOS()) return null

  async function instalar() {
    if (deferred) {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      if (outcome === 'accepted') setInstalado(true)
      setDeferred(null)
    } else if (ehIOS()) {
      setAjudaIOS(v => !v)
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
      {ajudaIOS && (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, textAlign: 'center' }}>
          No iPhone: toque em <b>Compartilhar</b> <span style={{ fontSize: 15 }}>⬆️</span> e depois em
          <b> “Adicionar à Tela de Início”</b>.
        </div>
      )}
    </div>
  )
}
