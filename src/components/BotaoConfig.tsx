import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useChrome } from '../lib/chrome'

// ⚙️ do topo (ao lado do sino). Mostra o que a página registrou:
// busca + filtros + imprimir + configurações da tela. Abre de baixo.
export default function BotaoConfig() {
  const { chrome } = useChrome()
  const [aberto, setAberto] = useState(false)
  const loc = useLocation()
  useEffect(() => { setAberto(false) }, [loc.pathname]) // fecha o menu ao trocar de página

  const temAlgo = !!chrome && ((chrome.navegacao?.length ?? 0) > 0 || !!chrome.busca || (chrome.grupos?.length ?? 0) > 0 || (chrome.impressoes?.length ?? 0) > 0 || (chrome.configs?.length ?? 0) > 0)
  if (!temAlgo || !chrome) return null

  const padrao = chrome.padraoFiltro ?? 'todos'
  const ativos = (chrome.grupos ?? []).filter(g => (chrome.valores?.[g.chave] ?? padrao) !== padrao).length

  const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, fontFamily: 'inherit', position: 'relative' }
  const icon: React.CSSProperties = { fontFamily: "'Material Symbols Outlined'", fontSize: 22, color: 'white', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24", lineHeight: 1, userSelect: 'none' } as any

  return (
    <>
      <button onClick={() => setAberto(true)} style={iconBtn} aria-label="Opções da página">
        <span style={icon}>settings</span>
        {ativos > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, background: '#E8821A', borderRadius: 99, fontSize: 10, fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid var(--primary)' }}>{ativos}</span>
        )}
      </button>

      {aberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 600, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setAberto(false)}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 16px 24px', maxWidth: 480, width: '100%', margin: '0 auto', maxHeight: '82vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 14px' }} />

            {/* Navegação (sub-abas da tela) */}
            {(chrome.navegacao?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 16 }}>
                {chrome.navegacao!.map((g, gi) => (
                  <div key={gi} style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>{g.titulo}</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {g.itens.map((it, ii) => (
                        <button key={ii} onClick={() => { setAberto(false); it.onClick() }}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, border: it.ativo ? '2px solid var(--primary)' : '1px solid var(--border)', background: it.ativo ? 'var(--primary-light)' : 'white', color: it.ativo ? 'var(--primary-dark)' : 'var(--text2)' }}>
                          {it.icone && <span className="icon icon-sm" style={{ color: it.ativo ? 'var(--primary)' : 'var(--muted)' }}>{it.icone}</span>}
                          {it.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div style={{ height: 1, background: 'var(--border)', margin: '2px 0 16px' }} />
              </div>
            )}

            {/* Busca */}
            {chrome.busca && (
              <div className="search-bar" style={{ marginBottom: 16 }}>
                <span className="icon icon-sm" style={{ color: 'var(--muted-light)' }}>search</span>
                <input placeholder={chrome.busca.placeholder ?? 'Buscar...'} value={chrome.busca.value} onChange={e => chrome.busca!.onChange(e.target.value)} />
                {chrome.busca.value && <button onClick={() => chrome.busca!.onChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-light)', padding: 0, fontFamily: 'inherit' }}><span className="icon icon-sm">close</span></button>}
              </div>
            )}

            {/* Filtros */}
            {(chrome.grupos?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="icon icon-sm" style={{ color: 'var(--primary)' }}>filter_list</span><span style={{ fontSize: 13, fontWeight: 700 }}>Filtros</span></div>
                  {ativos > 0 && <button onClick={() => chrome.grupos!.forEach(g => chrome.onFiltro?.(g.chave, padrao))} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Limpar</button>}
                </div>
                {chrome.grupos!.map(g => (
                  <div key={g.chave} style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{g.label}</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {g.opcoes.map(o => {
                        const sel = (chrome.valores?.[g.chave] ?? padrao) === o.value
                        return (
                          <button key={o.value} onClick={() => chrome.onFiltro?.(g.chave, o.value)}
                            style={{ padding: '8px 14px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, border: sel ? '2px solid var(--primary)' : '1px solid var(--border)', background: sel ? 'var(--primary-light)' : 'white', color: sel ? 'var(--primary-dark)' : 'var(--text2)' }}>
                            {o.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Imprimir */}
            {(chrome.impressoes?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span className="icon icon-sm" style={{ color: 'var(--primary)' }}>print</span><span style={{ fontSize: 13, fontWeight: 700 }}>Imprimir</span></div>
                {chrome.impressoes!.map((it, i) => (
                  <button key={i} disabled={it.disabled} onClick={() => { setAberto(false); it.onClick() }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 10, marginBottom: 6, cursor: it.disabled ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', border: '1px solid var(--border)', background: 'white', opacity: it.disabled ? 0.5 : 1 }}>
                    <span className="icon" style={{ color: 'var(--primary)' }}>{it.icon ?? 'print'}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{it.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Configurações da tela */}
            {(chrome.configs?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span className="icon icon-sm" style={{ color: 'var(--primary)' }}>tune</span><span style={{ fontSize: 13, fontWeight: 700 }}>Configurações</span></div>
                {chrome.configs!.map((it, i) => (
                  <button key={i} onClick={() => { setAberto(false); it.onClick() }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', border: '1px solid var(--border)', background: 'white' }}>
                    <span className="icon" style={{ color: 'var(--text2)' }}>{it.icon ?? 'settings'}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{it.label}</span>
                  </button>
                ))}
              </div>
            )}

            <button className="btn btn-ghost btn-full" style={{ marginTop: 6 }} onClick={() => setAberto(false)}>Fechar</button>
          </div>
        </div>
      )}
    </>
  )
}
