import { useNavigate, useLocation } from 'react-router-dom'
import { NAV_GROUPS } from '../lib/navGroups'

// Barra de sub-abas no topo da página, idêntica ao padrão de Administração.
// Mostra os itens do grupo e destaca a rota atual.
export default function SubTabs({ group }: { group: keyof typeof NAV_GROUPS }) {
  const nav = useNavigate()
  const loc = useLocation()
  const items = NAV_GROUPS[group]
  if (!items) return null
  return (
    <div className="tabs" style={{ overflowX: 'auto' }}>
      {items.map(it => (
        <button
          key={it.rota}
          className={`tab ${loc.pathname === it.rota ? 'active' : ''}`}
          style={{ whiteSpace: 'nowrap' }}
          onClick={() => { if (loc.pathname !== it.rota) nav(it.rota) }}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
