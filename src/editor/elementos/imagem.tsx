import { ELEMENTO_PADRAO } from '../tipos'
import { registrarElemento } from './registry'

// Imagem fixa (logo, PNG, fundo). URL vem do storage.

registrarElemento({
  tipo: 'imagem',
  nome: 'Imagem',
  icone: 'image',

  criar: () => ({
    ...ELEMENTO_PADRAO, w: 40, h: 40,
    props: { url: '', ajuste: 'contain' as 'contain' | 'cover', raio: 0 },
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

  Painel: ({ el, setProps }) => {
    const p = el.props
    const btn = (ativo: boolean) => ({
      border: ativo ? '2px solid var(--primary)' : '1px solid var(--border)',
      background: ativo ? 'var(--primary-light)' : 'white',
      color: ativo ? 'var(--primary)' : 'var(--text2)',
      borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
    })
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input className="form-input" value={p.url ?? ''} placeholder="Cole o endereço da imagem (URL)"
          onChange={e => setProps({ url: e.target.value })} />
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={btn(p.ajuste === 'contain')} onClick={() => setProps({ ajuste: 'contain' })}>Caber inteira</button>
          <button type="button" style={btn(p.ajuste === 'cover')} onClick={() => setProps({ ajuste: 'cover' })}>Preencher</button>
        </div>
        <label style={{ fontSize: 13, color: 'var(--text2)' }}>
          Cantos arredondados ({p.raio}%)
          <input type="range" min={0} max={50} value={p.raio} onChange={e => setProps({ raio: Number(e.target.value) })} style={{ width: '100%' }} />
        </label>
      </div>
    )
  },
})
