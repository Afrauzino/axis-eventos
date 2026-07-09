import { useNavigate, useLocation } from 'react-router-dom'

// Menu da Saúde — abas em UMA linha que rola pro lado (sem engrenagem).
// Começa em Medicamentos.
const ITENS = [
  { rota: '/saude/medicamentos',label: 'Medicamentos' },
  { rota: '/saude',             label: 'Atendimentos' },
  { rota: '/saude/ficha',       label: 'Fichas Médicas' },
  { rota: '/saude/config',      label: 'Configuração' },
]

export default function MenuSaude() {
  const nav = useNavigate()
  const loc = useLocation()
  return (
    <div className="tabs mb-4" style={{ flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
      {ITENS.map(it => {
        const on = loc.pathname === it.rota
        return (
          <button key={it.rota} className={`tab ${on ? 'active' : ''}`} onClick={() => { if (!on) nav(it.rota) }} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
