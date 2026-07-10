import { useEffect, useState } from 'react'
import { pushSuportado, ativarPush } from '../lib/push'
import type { Profile } from '../App'

// Banner que garante o pedido de permissão de notificação num TOQUE do usuário
// (pedir automático no load costuma ser ignorado no APK/Chrome). Reassina o
// aparelho também — importante depois de reinstalar o app.
const KEY = 'axis_notif_banner_dismiss'

export default function AtivarNotificacoes({ profile }: { profile: Profile }) {
  const [perm, setPerm] = useState<'default' | 'granted' | 'denied' | 'no'>('no')
  const [ocupado, setOcupado] = useState(false)
  const [fechado, setFechado] = useState(false)

  useEffect(() => {
    if (!pushSuportado()) { setPerm('no'); return }
    setPerm(Notification.permission as any)
    if (Notification.permission === 'granted') ativarPush(profile.user_id)  // reassina este aparelho
    try { setFechado(localStorage.getItem(KEY) === '1') } catch {}
  }, [profile.user_id])

  async function ativar() {
    setOcupado(true)
    const ok = await ativarPush(profile.user_id)  // pede permissão (no toque) + assina
    setOcupado(false)
    setPerm(typeof Notification !== 'undefined' ? (Notification.permission as any) : 'no')
    if (ok) fechar()
  }
  function fechar() { try { localStorage.setItem(KEY, '1') } catch {} ; setFechado(true) }

  if (perm === 'no' || perm === 'granted' || fechado) return null

  const bloqueado = perm === 'denied'
  return (
    <div style={{ margin: '0 16px 12px', background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 24, flexShrink: 0 }}>🔔</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary-dark)' }}>{bloqueado ? 'Notificações bloqueadas' : 'Ative as notificações'}</p>
        <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>
          {bloqueado
            ? 'Ative em Configurações do Android → Apps → AXIS → Notificações.'
            : 'Receba avisos de escala, mural, alertas e aniversários no celular.'}
        </p>
      </div>
      {!bloqueado && (
        <button onClick={ativar} disabled={ocupado} style={{ flexShrink: 0, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {ocupado ? '...' : 'Ativar'}
        </button>
      )}
      <button onClick={fechar} aria-label="Fechar" style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
    </div>
  )
}
