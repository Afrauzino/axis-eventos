import { useEffect, useState } from 'react'

// Estado + Cidade padronizados (base IBGE). Escolher da lista evita erros de
// digitação (ex.: "lençois pta", "LP" → "Lençóis Paulista"). A base é carregada
// sob demanda (import dinâmico) pra não pesar o bundle inicial.

type Dados = { UFS: { sigla: string; nome: string }[]; CIDADES_POR_UF: Record<string, string[]> }

export default function SeletorCidade({ estado, cidade, onChange, disabled, obrigatorio }: {
  estado: string | null
  cidade: string | null
  onChange: (estado: string, cidade: string) => void
  disabled?: boolean
  obrigatorio?: boolean
}) {
  const [d, setD] = useState<Dados | null>(null)
  useEffect(() => {
    let vivo = true
    import('../lib/cidadesBR').then(m => { if (vivo) setD({ UFS: m.UFS, CIDADES_POR_UF: m.CIDADES_POR_UF }) })
    return () => { vivo = false }
  }, [])

  const uf = estado ?? ''
  const cidades = (d && uf) ? (d.CIDADES_POR_UF[uf] ?? []) : []
  const foraDaLista = !!cidade && !!uf && cidades.length > 0 && !cidades.includes(cidade)

  const sel: React.CSSProperties = {
    width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--border)',
    fontFamily: 'inherit', fontSize: 14, background: 'white', color: 'var(--text)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label className="form-label">Estado {obrigatorio && <span className="req">*</span>}</label>
        <select style={sel} value={uf} disabled={disabled} onChange={e => onChange(e.target.value, '')}>
          <option value="">{d ? 'Selecione o estado' : 'Carregando...'}</option>
          {(d?.UFS ?? []).map(u => <option key={u.sigla} value={u.sigla}>{u.nome} ({u.sigla})</option>)}
        </select>
      </div>
      <div>
        <label className="form-label">Cidade {obrigatorio && <span className="req">*</span>}</label>
        <select style={{ ...sel, opacity: uf ? 1 : 0.6 }} value={cidade ?? ''} disabled={disabled || !uf}
          onChange={e => onChange(uf, e.target.value)}>
          <option value="">{uf ? 'Selecione a cidade' : 'Escolha o estado primeiro'}</option>
          {cidades.map(c => <option key={c} value={c}>{c}</option>)}
          {/* dado antigo que não bate com a lista: mostra pra não sumir na edição */}
          {foraDaLista && <option value={cidade!}>{cidade} (fora da lista)</option>}
        </select>
      </div>
    </div>
  )
}
