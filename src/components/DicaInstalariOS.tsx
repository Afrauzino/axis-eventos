import { useEffect, useState } from 'react'

// iPhone não tem botão de "instalar" — precisa "Compartilhar → Adicionar à Tela
// de Início". Esta dica aparece SÓ no iPhone/iPad no Safari (fora do app já
// instalado). Fechar vale para a sessão. Também é o passo que libera as
// notificações no iOS (Web Push no iPhone só funciona com o app instalado).
const KEY = 'axis_ios_hint'

function ehIOS(): boolean {
  try {
    const ua = navigator.userAgent || ''
    const iphone = /iPad|iPhone|iPod/.test(ua)
    const ipadDesktop = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1
    return iphone || ipadDesktop
  } catch { return false }
}
function jaInstalado(): boolean {
  try { return (navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches } catch { return false }
}

export default function DicaInstalariOS() {
  const [mostrar, setMostrar] = useState(false)
  useEffect(() => {
    try {
      const fechou = sessionStorage.getItem(KEY) === '1'
      if (ehIOS() && !jaInstalado() && !fechou) setMostrar(true)
    } catch {}
  }, [])
  if (!mostrar) return null
  function fechar() { try { sessionStorage.setItem(KEY, '1') } catch {}; setMostrar(false) }
  return (
    <div style={{ margin: '0 16px 12px', background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 24, flexShrink: 0 }}>📲</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary-dark)' }}>Instale o AXIS no seu iPhone</p>
        <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>
          Toque em <b>Compartilhar</b> <span style={{ fontFamily: "'Material Symbols Outlined'", fontSize: 14, verticalAlign: 'middle' }}>ios_share</span> (embaixo) e depois em <b>Adicionar à Tela de Início</b>. Assim o app abre em tela cheia e passa a receber notificações.
        </p>
      </div>
      <button onClick={fechar} aria-label="Fechar" style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
    </div>
  )
}
