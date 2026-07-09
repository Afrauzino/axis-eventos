import { useState } from 'react'
import { registrarFerramenta } from './registry'
import { criarElemento, listarElementos } from '../elementos'
import { escolherImagem } from '../arquivo'
import type { CtxEditor, DefElemento, PresetElemento } from '../tipos'

// "Adicionar" — lista automaticamente TODOS os tipos registrados
// e as variações (presets) que cada tipo declarar.
// Registrou um QR Code? Ele aparece aqui sozinho.

registrarFerramenta({
  id: 'adicionar',
  nome: 'Adicionar',
  icone: 'add_box',
  Painel: ctx => <PainelAdicionar ctx={ctx} />,
})

function PainelAdicionar({ ctx }: { ctx: CtxEditor }) {
  const { doc, paginaAtual, dispatch, selecionar, subirImagem } = ctx
  const [ocupado, setOcupado] = useState(false)

  async function inserir(def: DefElemento, preset?: PresetElemento) {
    if (ocupado) return

    // Tipos que pedem imagem: abre a galeria/câmera ANTES de inserir
    let url = ''
    if (def.pedeImagem) {
      if (!subirImagem) return
      const f = await escolherImagem()
      if (!f) return
      setOcupado(true)
      url = (await subirImagem(f)) ?? ''
      setOcupado(false)
      if (!url) return
    }

    const el = criarElemento(def.tipo, { x: doc.papel.largura / 2 - 20, y: doc.papel.altura / 2 - 20 })
    if (!el) return

    if (preset) {
      const patch = preset.aplicar(doc.papel)
      const props = { ...el.props, ...((patch as any).props ?? {}) }
      Object.assign(el, patch, { props })
    }
    if (url) el.props = { ...el.props, url }

    dispatch({ t: 'add', paginaId: doc.paginas[paginaAtual].id, el })
    if (preset?.aoFundo) dispatch({ t: 'ordem', ids: [el.id], para: 'fundo' })
    selecionar([el.id])
  }

  const botao = (chave: string, icone: string, nome: string, onClick: () => void) => (
    <button key={chave} type="button" disabled={ocupado} onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 12px',
        border: '1px dashed var(--border)', borderRadius: 12, background: 'white',
        cursor: ocupado ? 'default' : 'pointer', opacity: ocupado ? 0.5 : 1,
        fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--text2)', textAlign: 'left',
      }}>
      <span className="icon" style={{ color: 'var(--primary)' }}>{icone}</span>
      {nome}
    </button>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
      {listarElementos().flatMap(def => [
        botao(def.tipo, def.icone, def.nome, () => inserir(def)),
        ...(def.presets ?? []).map(pr =>
          botao(def.tipo + ':' + pr.nome, pr.icone ?? def.icone, pr.nome, () => inserir(def, pr)),
        ),
      ])}
      {ocupado && <p style={{ gridColumn: '1/-1', fontSize: 12, color: 'var(--muted)' }}>Enviando imagem...</p>}
    </div>
  )
}
