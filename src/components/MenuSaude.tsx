import { useNavigate, useLocation } from 'react-router-dom'

// Menu vertical da Saúde (sem engrenagem) — igual ao padrão novo da Cozinha.
const ITENS = [
  { rota: '/saude',             emoji: '🩺', label: 'Atendimentos' },
  { rota: '/saude/ficha',       emoji: '📋', label: 'Fichas Médicas' },
  { rota: '/saude/medicamentos',emoji: '💊', label: 'Medicamentos' },
  { rota: '/saude/config',      emoji: '🔧', label: 'Configuração' },
]

export default function MenuSaude() {
  const nav = useNavigate()
  const loc = useLocation()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {ITENS.map(it => {
        const on = loc.pathname === it.rota
        return (
          <button key={it.rota} onClick={() => { if (!on) nav(it.rota) }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 12, border: on ? '1.5px solid var(--primary)' : '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontSize: 15, fontWeight: on ? 800 : 600, background: on ? 'var(--primary-light)' : 'white', color: on ? 'var(--primary-dark)' : 'var(--text)', boxShadow: 'var(--shadow-sm)' }}>
            <span style={{ fontSize: 20 }}>{it.emoji}</span>
            <span style={{ flex: 1 }}>{it.label}</span>
            <span className="icon icon-sm" style={{ color: on ? 'var(--primary)' : 'var(--muted-light)' }}>chevron_right</span>
          </button>
        )
      })}
    </div>
  )
}
