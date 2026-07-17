import { useEffect, useState } from 'react'
import { registrarFerramenta } from './registry'

// Medidas em mm. A descrição mostra em cm (como o pessoal fala).
const PAPEIS: { nome: string; desc: string; l: number; a: number }[] = [
  { nome: 'Crachá em pé',   desc: '5,4 × 8,6 cm',  l: 54,  a: 86  },
  { nome: 'Crachá deitado', desc: '8,6 × 5,4 cm',  l: 86,  a: 54  },
  { nome: 'A4 em pé',       desc: '21 × 29,7 cm',  l: 210, a: 297 },
  { nome: 'A4 deitada',     desc: '29,7 × 21 cm',  l: 297, a: 210 },
]

// IMPORTANTE: o Painel é CHAMADO como função (Editor: ativa.Painel(ctx)), então
// NÃO pode usar hooks direto nele. O estado do "Personalizar" vive neste
// componente separado, que é renderizado como JSX (aí os hooks são válidos).
function SecaoTamanho({ doc, dispatch }: { doc: any; dispatch: (a: any) => void }) {
  const { largura: L, altura: A } = doc.papel
  const ehPreset = PAPEIS.some(p => p.l === L && p.a === A)

  const [perso, setPerso] = useState(!ehPreset)
  const [lStr, setLStr] = useState(String(L))
  const [aStr, setAStr] = useState(String(A))
  // Quando o papel muda por fora (tocou num preset, girou), sincroniza os campos.
  useEffect(() => { setLStr(String(L)); setAStr(String(A)) }, [L, A])

  const aplicar = (ls: string, as: string) => {
    const nl = Number(ls), na = Number(as)
    const patch: any = {}
    if (ls.trim() !== '' && nl >= 10 && nl <= 2000) patch.largura = Math.round(nl)
    if (as.trim() !== '' && na >= 10 && na <= 2000) patch.altura = Math.round(na)
    if (Object.keys(patch).length) dispatch({ t: 'papel', patch })
  }
  // Campo editável de verdade: texto local (dá pra APAGAR e digitar). Só grava quando é válido.
  const campo = (val: string, set: (s: string) => void, outra: string, ehLarg: boolean) => (
    <input type="number" inputMode="numeric" min={10} max={2000} value={val} placeholder="mm"
      onChange={e => { const s = e.target.value; set(s); aplicar(ehLarg ? s : outra, ehLarg ? outra : s) }}
      onBlur={() => { if (val.trim() === '' || Number(val) < 10) { ehLarg ? setLStr(String(L)) : setAStr(String(A)) } }}
      style={{ width: 84, padding: '8px 9px', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 14 }} />
  )

  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Tamanho da folha que você desenha</p>
      <div className="ed-tira" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2, marginBottom: 8 }}>
        {PAPEIS.map(p => {
          const ativo = !perso && L === p.l && A === p.a
          return (
            <button key={p.nome} type="button" onClick={() => { setPerso(false); dispatch({ t: 'papel', patch: { largura: p.l, altura: p.a } }) }}
              style={{ flex: '0 0 auto', width: 96, padding: '7px 8px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                border: ativo ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: ativo ? 'var(--primary-light)' : 'white' }}>
              <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: ativo ? 'var(--primary)' : 'var(--text2)', lineHeight: 1.2 }}>{p.nome}</span>
              <span style={{ display: 'block', fontSize: 9.5, color: 'var(--muted)', marginTop: 1 }}>{p.desc}</span>
            </button>
          )
        })}
        <button type="button" onClick={() => setPerso(true)}
          style={{ flex: '0 0 auto', width: 96, padding: '7px 8px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            border: perso ? '2px solid var(--primary)' : '1px dashed var(--border)',
            background: perso ? 'var(--primary-light)' : 'white' }}>
          <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: perso ? 'var(--primary)' : 'var(--text2)', lineHeight: 1.2 }}>Personalizar</span>
          <span style={{ display: 'block', fontSize: 9.5, color: 'var(--muted)', marginTop: 1 }}>tamanho livre</span>
        </button>
      </div>

      {perso && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Largura</span>
          {campo(lStr, setLStr, aStr, true)}
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Altura</span>
          {campo(aStr, setAStr, lStr, false)}
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>mm</span>
          <button type="button" title="Girar folha (em pé ↔ deitada)"
            onClick={() => dispatch({ t: 'papel', patch: { largura: A, altura: L } })}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}>
            <span className="icon icon-sm">screen_rotation</span> Girar
          </button>
        </div>
      )}
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
        {L}×{A}mm {L > A ? '(deitada)' : L < A ? '(em pé)' : '(quadrada)'}
      </p>
    </div>
  )
}

// Página: tamanho do papel (presets + Personalizar), fundo e páginas.
registrarFerramenta({
  id: 'pagina',
  nome: 'Página',
  icone: 'description',
  Painel: ({ doc, paginaAtual, dispatch, setPaginaAtual }) => {
    const pg = doc.paginas[paginaAtual]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SecaoTamanho doc={doc} dispatch={dispatch} />

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
