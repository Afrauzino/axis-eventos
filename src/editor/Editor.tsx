// ─────────────────────────────────────────────────────────────
// Shell do editor: topo (desfazer/refazer/salvar) + canvas +
// barra inferior (montada pelo registro) + painel da ferramenta.
// A tela fica limpa: cada botão abre só o painel dele.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import type { Documento, Elemento, SubirImagem } from './tipos'
import { useEditor } from './store'
import Canvas from './Canvas'
import { listarFerramentas } from './ferramentas'
import './elementos'   // registra os tipos de elemento

type Props = {
  inicial: Documento
  dados?: Record<string, any>          // pessoa de exemplo pra prévia
  onSalvar?: (doc: Documento) => void
  onImprimir?: (doc: Documento) => void
  subirImagem?: SubirImagem            // a tela decide onde guardar a imagem
}

export default function Editor({ inicial, dados, onSalvar, onImprimir, subirImagem }: Props) {
  const ed = useEditor(inicial)
  const [ferramenta, setFerramenta] = useState<string | null>(null)

  const ferramentas = listarFerramentas()
  const ativa = ferramentas.find(f => f.id === ferramenta)
  const temSelecao = ed.selecao.length > 0

  /** Aplica um patch em toda a seleção (usado pelo canvas ao arrastar/redimensionar). */
  const moverSelecao = (patch: Partial<Elemento>) => ed.dispatch({ t: 'patch', ids: ed.selecao, patch })

  const ctx = {
    doc: ed.doc, paginaAtual: ed.paginaAtual, selecao: ed.selecao,
    dispatch: ed.dispatch, selecionar: ed.selecionar, setPaginaAtual: ed.setPaginaAtual,
    desfazer: ed.desfazer, refazer: ed.refazer,
    podeDesfazer: ed.podeDesfazer, podeRefazer: ed.podeRefazer,
    subirImagem,
  }

  const btnTopo = (icone: string, titulo: string, onClick: () => void, ativo = true) => (
    <button type="button" title={titulo} onClick={onClick} disabled={!ativo}
      style={{ background: 'none', border: 'none', cursor: ativo ? 'pointer' : 'default', opacity: ativo ? 1 : 0.35,
        color: 'var(--text2)', display: 'flex', alignItems: 'center', padding: 6, fontFamily: 'inherit' }}>
      <span className="icon">{icone}</span>
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: '#f1f2f4' }}>

      {/* Topo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'white', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {btnTopo('undo', 'Desfazer', ed.desfazer, ed.podeDesfazer)}
        {btnTopo('redo', 'Refazer', ed.refazer, ed.podeRefazer)}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 6 }}>
          Página {ed.paginaAtual + 1}/{ed.doc.paginas.length}
        </span>
        {onImprimir && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onImprimir(ed.doc)}>
            <span className="icon icon-sm">print</span> Imprimir
          </button>
        )}
        {onSalvar && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onSalvar(ed.doc)}>Salvar</button>
        )}
      </div>

      {/* Canvas */}
      <Canvas
        doc={ed.doc} paginaAtual={ed.paginaAtual}
        selecao={ed.selecao} selecionar={ed.selecionar}
        moverSelecao={moverSelecao} dados={dados}
      />

      {/* Painel da ferramenta ativa */}
      {ativa && (
        <div style={{ background: 'white', borderTop: '1px solid var(--border)', padding: '12px 14px 10px', maxHeight: '42vh', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{ativa.nome}</span>
            <button type="button" onClick={() => setFerramenta(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', fontFamily: 'inherit' }}>
              <span className="icon icon-sm">close</span>
            </button>
          </div>
          {ativa.Painel(ctx)}
        </div>
      )}

      {/* Barra inferior — montada pelo REGISTRO de ferramentas */}
      <div style={{ display: 'flex', gap: 2, padding: '6px 4px', background: '#fafafa', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {ferramentas.map(f => {
          const bloqueada = f.precisaSelecao && !temSelecao
          const on = ferramenta === f.id
          return (
            <button key={f.id} type="button" disabled={bloqueada}
              onClick={() => setFerramenta(on ? null : f.id)}
              style={{ flex: 1, background: 'none', border: 'none', cursor: bloqueada ? 'default' : 'pointer',
                opacity: bloqueada ? 0.35 : 1, color: on ? 'var(--primary)' : 'var(--muted)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 0', fontFamily: 'inherit' }}>
              <span className="icon">{f.icone}</span>
              <span style={{ fontSize: 9.5, fontWeight: on ? 800 : 600 }}>{f.nome}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
