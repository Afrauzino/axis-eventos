import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// PORTÃO — regra atual:
//  • CELULAR: sem obrigação nenhuma (usa navegador/PWA à vontade).
//  • PC: obriga o app — MENOS no PRIMEIRO ACESSO. Enquanto a pessoa não está
//    logada (criando/entrando na conta), o navegador é liberado. Assim que ela
//    salva o cadastro / loga, o PC passa a exigir o app instalado.
// App instalado (standalone), localhost (dev) e ?web=1 sempre passam.
let promptInstalar: any = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: any) => { e.preventDefault(); promptInstalar = e })
}

function ehStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true
      || document.referrer.startsWith('android-app://')
  } catch { return false }
}
function ehLocal(): boolean {
  const h = location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')
}
function temBypass(): boolean {
  try {
    if (new URLSearchParams(location.search).get('web') === '1') localStorage.setItem('axis_web_ok', '1')
    return localStorage.getItem('axis_web_ok') === '1'
  } catch { return false }
}

const botao: React.CSSProperties = { background: 'white', color: '#0b5', border: 'none', borderRadius: 99, padding: '14px 26px', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', boxShadow: '0 6px 20px rgba(0,0,0,0.25)', marginBottom: 14 }
const dica: React.CSSProperties = { fontSize: 13, opacity: 0.9, maxWidth: 340, lineHeight: 1.5 }

function ehMobile(): boolean {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent) || window.innerWidth < 820
}

export default function PortaoApp() {
  const [bloquear, setBloquear] = useState(false)
  useEffect(() => {
    // Só faz sentido no PC, fora do app, e só depois de logado (cadastro salvo).
    const avaliar = (logado: boolean) =>
      setBloquear(!ehMobile() && !ehStandalone() && !ehLocal() && !temBypass() && logado)
    supabase.auth.getSession().then(({ data }) => avaliar(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => avaliar(!!session))
    return () => { try { sub.subscription.unsubscribe() } catch {} }
  }, [])
  if (!bloquear) return null

  const ua = navigator.userAgent
  const android = /android/i.test(ua)
  const ios = /iphone|ipad|ipod/i.test(ua)
  const mobile = android || ios || window.innerWidth < 820

  async function instalarPWA() {
    if (!promptInstalar) return
    promptInstalar.prompt()
    try { await promptInstalar.userChoice } catch {}
    promptInstalar = null
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'var(--primary, #00A99D)', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center' }}>
      <img src="/axis-192.png" alt="AXIS" style={{ width: 88, height: 88, borderRadius: 22, marginBottom: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }} />
      <p style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Use o app do AXIS</p>
      <p style={{ fontSize: 15, opacity: 0.92, maxWidth: 360, lineHeight: 1.5, marginBottom: 26 }}>
        {android ? 'Pra continuar, baixe e instale o aplicativo AXIS no seu celular.'
          : ios ? 'Pra continuar, instale o AXIS na sua Tela de Início.'
            : 'Pra continuar, instale o aplicativo AXIS no seu computador.'}
      </p>

      {android && (
        <>
          <a href="/AXIS.apk" download style={botao}>
            <span className="icon icon-sm" style={{ color: '#0b5' }}>download</span> Baixar o app (APK)
          </a>
          <p style={dica}>Depois de baixar, toque no arquivo pra instalar. Se pedir, permita <b>instalar apps de fontes desconhecidas</b>. Depois abra pelo ícone do AXIS.</p>
        </>
      )}
      {ios && !android && (
        <p style={{ ...dica, fontSize: 14 }}>Toque no botão <b>Compartilhar</b> do navegador e escolha <b>Adicionar à Tela de Início</b>. Depois abra pelo ícone do AXIS.</p>
      )}
      {!mobile && (
        <>
          <button onClick={instalarPWA} style={botao}>
            <span className="icon icon-sm" style={{ color: '#0b5' }}>install_desktop</span> Instalar o app
          </button>
          <p style={dica}>No Chrome/Edge: clique no ícone de <b>instalar</b> na barra de endereço (ou menu ⋮ → <b>Instalar AXIS</b>). Depois abra pelo ícone do app.</p>
        </>
      )}
    </div>
  )
}
