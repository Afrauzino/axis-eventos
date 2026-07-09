import { registrarFerramenta } from './registry'

const PAPEIS: { nome: string; l: number; a: number }[] = [
  { nome: 'A4 em pé',   l: 210, a: 297 },
  { nome: 'A4 deitada', l: 297, a: 210 },
  { nome: 'Crachá',     l: 90,  a: 130 },
  { nome: 'Cartão',     l: 90,  a: 50  },
  { nome: 'Etiqueta',   l: 60,  a: 80  },
]

// Página: tamanho do papel (presets, personalizado e girar), fundo e páginas.
// (Sangria e marcas de corte entram aqui depois — o tipo Papel já prevê.)

registrarFerramenta({
  id: 'pagina',
  nome: 'Página',
  icone: 'description',
  Painel: ({ doc, paginaAtual, dispatch, setPaginaAtual }) => {
    const pg = doc.paginas[paginaAtual]
    const { largura: L, altura: A } = doc.papel
    const ehPreset = PAPEIS.some(p => p.l === L && p.a === A)

    const num = (v: number, onChange: (n: number) => void) => (
      <input type="number" min={10} max={2000} value={v}
        onChange={e => { const n = Number(e.target.value); if (n >= 10 && n <= 2000) onChange(n) }}
        style={{ width: 76, padding: '7px 8px', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }} />
    )

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Tamanho da folha que você desenha</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, marginBottom: 8 }}>
            {PAPEIS.map(p => {
              const ativo = L === p.l && A === p.a
              return (
                <button key={p.nome} type="button" onClick={() => dispatch({ t: 'papel', patch: { largura: p.l, altura: p.a } })}
                  style={{ padding: '9px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                    border: ativo ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: ativo ? 'var(--primary-light)' : 'white', color: ativo ? 'var(--primary)' : 'var(--text2)' }}>
                  {p.nome}
                </button>
              )
            })}
            <button type="button" onClick={() => dispatch({ t: 'papel', patch: { largura: L, altura: A } })}
              style={{ padding: '9px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                border: !ehPreset ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: !ehPreset ? 'var(--primary-light)' : 'white', color: !ehPreset ? 'var(--primary)' : 'var(--text2)' }}>
              Personalizado
            </button>
          </div>

          {/* Personalizado + girar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Largura</span>
            {num(L, n => dispatch({ t: 'papel', patch: { largura: n } }))}
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Altura</span>
            {num(A, n => dispatch({ t: 'papel', patch: { altura: n } }))}
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>mm</span>
            <button type="button" title="Girar folha (em pé ↔ deitada)"
              onClick={() => dispatch({ t: 'papel', patch: { largura: A, altura: L } })}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}>
              <span className="icon icon-sm">screen_rotation</span> Girar
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
            {L}×{A}mm {L > A ? '(deitada)' : L < A ? '(em pé)' : '(quadrada)'}
          </p>
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>Cor de fundo</span>
          <input type="color" value={pg?.fundo ?? '#ffffff'}
            onChange={e => dispatch({ t: 'documento', patch: { paginas: doc.paginas.map((p, i) => i === paginaAtual ? { ...p, fundo: e.target.value } : p) } })}
            style={{ width: 32, height: 28, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 1 }} />
        </div>

        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Páginas ({doc.paginas.length})</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {doc.paginas.map((p, i) => (
              <button key={p.id} type="button" onClick={() => setPaginaAtual(i)}
                style={{ width: 38, height: 38, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                  border: i === paginaAtual ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: i === paginaAtual ? 'var(--primary-light)' : 'white', color: i === paginaAtual ? 'var(--primary)' : 'var(--text2)' }}>
                {i + 1}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ t: 'pagina.add' })}>+ Página</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ t: 'pagina.duplicar', paginaId: pg.id })}>Duplicar</button>
            {doc.paginas.length > 1 && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                onClick={() => { dispatch({ t: 'pagina.excluir', paginaId: pg.id }); setPaginaAtual(Math.max(0, paginaAtual - 1)) }}>Excluir</button>
            )}
          </div>
        </div>
      </div>
    )
  },
})
