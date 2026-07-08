import { useNavigate, useLocation } from 'react-router-dom'

// Menu da Saúde (abas horizontais, padrão do Correio) — sem engrenagem.
const ITENS = [
  { rota: '/saude',             label: 'Atendimentos' },
  { rota: '/saude/ficha',       label: 'Fichas Médicas' },
  { rota: '/saude/medicamentos',label: 'Medicamentos' },
  { rota: '/saude/config',      label: 'Configuração' },
]

export default function MenuSaude() {
  const nav = useNavigate()
  const loc = useLocation()
  return (
    <div className="tabs mb-4" style={{ flexWrap: 'wrap' }}>
      {ITENS.map(it => {
        const on = loc.pathname === it.rota
        return (
          <button key={it.rota} className={`tab ${on ? 'active' : ''}`} onClick={() => { if (!on) nav(it.rota) }}>
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
