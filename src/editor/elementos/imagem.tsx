import { useState } from 'react'
import { ELEMENTO_PADRAO } from '../tipos'
import { escolherImagem } from '../arquivo'
import { registrarElemento } from './registry'

// Imagem do aparelho (galeria/câmera). Duas formas de inserir:
//  • Imagem        → livre, você posiciona e redimensiona
//  • Imagem de fundo → nasce do tamanho da folha e vai pro fundo

registrarElemento({
  tipo: 'imagem',
  nome: 'Imagem',
  icone: 'image',
  pedeImagem: true,

  presets: [
    {
      nome: 'Imagem de fundo',
      icone: 'wallpaper',
      aoFundo: true,
      aplicar: papel => ({ x: 0, y: 0, w: papel.largura, h: papel.altura, props: { ajuste: 'cover', raio: 0 } }),
    },
  ],

  criar: () => ({
    ...ELEMENTO_PADRAO, w: 40, h: 40,
    props: { url: '', ajuste: 'cover' as 'contain' | 'cover' | 'fill', raio: 0 },
  }),

  Render: ({ el }) => {
    const p = el.props
    if (!p.url) {
      return (
        <div style={{ width: '100%', height: '100%', border: '1px dashed #c9ccd1', borderRadius: `${p.raio}%`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa0a8', background: '#fafafa' }}>
          <span className="icon" style={{ fontSize: '50%' }}>image</span>
        </div>
      )
    }
    return <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: p.ajuste, borderRadius: `${p.raio}%`, display: 'block' }} />
  },

  Painel: ({ el, setProps, subirImagem }) => <PainelImagem el={el} setProps={setProps} subirImagem={subirImagem} />,
})

function PainelImagem({ el, setProps, subirImagem }: any) {
  const [subindo, setSubindo] = useState(false)
  const p = el.props

  async function trocar() {
    if (!subirImagem) return
    const f = await escolherImagem()
    if (!f) return
    setSubindo(true)
    const url = await subirImagem(f)
    setSubindo(false)
    if (url) setProps({ url })
  }

  const btn = (ativo: boolean) => ({
    border: ativo ? '2px solid var(--primary)' : '1px solid var(--border)',
    background: ativo ? 'var(--primary-light)' : 'white',
    color: ativo ? 'var(--primary)' : 'var(--text2)',
    borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="btn btn-ghost btn-full" disabled={subindo} onClick={trocar}
        style={{ border: '1px dashed var(--primary)', color: 'var(--primary)' }}>
        <span className="icon icon-sm">photo_camera</span> {subindo ? 'Enviando...' : p.url ? 'Trocar imagem' : 'Escolher imagem'}
      </button>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" style={btn(p.ajuste === 'cover')} onClick={() => setProps({ ajuste: 'cover' })}>Preencher</button>
        <button type="button" style={btn(p.ajuste === 'fill')} onClick={() => setProps({ ajuste: 'fill' })}>Esticar</button>
        <button type="button" style={btn(p.ajuste === 'contain')} onClick={() => setProps({ ajuste: 'contain' })}>Caber inteira</button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: -4 }}>
        {p.ajuste === 'cover'
          ? 'Preenche a folha e corta o que sobra (não distorce).'
          : p.ajuste === 'fill'
            ? 'Estica pra preencher tudo, sem bordas (pode distorcer um pouco).'
            : 'Mostra a imagem inteira — pode sobrar borda.'}
      </p>

      <label style={{ fontSize: 13, color: 'var(--text2)' }}>
        Cantos arredondados ({p.raio}%)
        <input type="range" min={0} max={50} value={p.raio} onChange={e => setProps({ raio: Number(e.target.value) })} style={{ width: '100%' }} />
      </label>
    </div>
  )
}
