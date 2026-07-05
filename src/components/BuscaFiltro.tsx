import { useState } from 'react'

// Busca + filtro no padrão AXIS (item 7): barra de busca + botão ⚙️ pequeno ao
// lado; o filtro abre DE BAIXO (bottom-sheet) e um numerozinho mostra quantos
// filtros estão ativos. Substitui os filtros horizontais/verticais antigos.
export type FiltroGrupo = { chave: string; label: string; opcoes: { value: string; label: string }[] }

type Props = {
  busca: string
  onBusca: (v: string) => void
  placeholder?: string
  grupos?: FiltroGrupo[]
  valores?: Record<string, string>
  onFiltro?: (chave: string, value: string) => void
  padrao?: string   // valor que conta como "sem filtro" (não soma no contador). Padrão 'todos'.
}

export default function BuscaFiltro({ busca, onBusca, placeholder = 'Buscar...', grupos = [], valores = {}, onFiltro, padrao = 'todos' }: Props) {
  const [aberto, setAberto] = useState(false)
  const ativos = grupos.filter(g => (valores[g.chave] ?? padrao) !== padrao).length

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div className="search-bar" style={{ flex: 1, marginBottom: 0 }}>
          <span className="icon icon-sm" style={{ color: 'var(--muted-light)' }}>search</span>
          <input placeholder={placeholder} value={busca} onChange={e => onBusca(e.target.value)} />
          {busca && <button onClick={() => onBusca('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-light)', padding: 0, fontFamily: 'inherit' }}><span className="icon icon-sm">close</span></button>}
        </div>
        {grupos.length > 0 && (
          <button onClick={() => setAberto(true)} aria-label="Filtros"
            style={{ position: 'relative', width: 44, flexShrink: 0, background: 'var(--primary)', border: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>
            <span className="icon">tune</span>
            {ativos > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, background: '#E8821A', color: 'white', fontSize: 9, fontWeight: 800, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid white' }}>{ativos}</span>
            )}
          </button>
        )}
      </div>

      {aberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setAberto(false)}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 16px 24px', maxHeight: '75vh', overflowY: 'auto', maxWidth: 480, width: '100%', margin: '0 auto' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 14px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 15, fontWeight: 800 }}>Filtros</p>
              {ativos > 0 && <button onClick={() => grupos.forEach(g => onFiltro?.(g.chave, padrao))} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Limpar</button>}
            </div>
            {grupos.map(g => (
              <div key={g.chave} style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>{g.label}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {g.opcoes.map(o => {
                    const sel = (valores[g.chave] ?? padrao) === o.value
                    return (
                      <button key={o.value} onClick={() => onFiltro?.(g.chave, o.value)}
                        style={{ padding: '8px 14px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, border: sel ? '2px solid var(--primary)' : '1px solid var(--border)', background: sel ? 'var(--primary-light)' : 'white', color: sel ? 'var(--primary-dark)' : 'var(--text2)' }}>
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <button className="btn btn-primary btn-full" onClick={() => setAberto(false)}>Ver resultados</button>
          </div>
        </div>
      )}
    </>
  )
}
