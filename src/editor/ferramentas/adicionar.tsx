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

  // Tira horizontal (estilo Canva): compacta, rola pro lado, ocupa pouca altura.
  const botao = (chave: string, icone: string, nome: string, onClick: () => void) => (
    <button key={chave} type="button" disabled={ocupado} onClick={onClick}
      style={{
        flex: '0 0 auto', width: 66, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '9px 4px', border: '1px solid var(--border)', borderRadius: 10, background: 'white',
        cursor: ocupado ? 'default' : 'pointer', opacity: ocupado ? 0.5 : 1, fontFamily: 'inherit',
      }}>
      <span className="icon" style={{ color: 'var(--primary)', fontSize: 22 }}>{icone}</span>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text2)', lineHeight: 1.1, textAlign: 'center' }}>{nome}</span>
    </button>
  )

  return (
    <>
      <div className="ed-tira" style={{ display: 'flex', gap: 7, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {listarElementos().flatMap(def => [
          botao(def.tipo, def.icone, def.nome, () => inserir(def)),
          ...(def.presets ?? []).map(pr =>
            botao(def.tipo + ':' + pr.nome, pr.icone ?? def.icone, pr.nome, () => inserir(def, pr)),
          ),
        ])}
      </div>
      {ocupado && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Enviando imagem...</p>}
    </>
  )
}
