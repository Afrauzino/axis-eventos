import { ELEMENTO_PADRAO } from '../tipos'
import { registrarElemento } from './registry'

// Foto vinda do cadastro (props.campo = 'foto'). Na impressão troca por pessoa.

registrarElemento({
  tipo: 'foto',
  nome: 'Foto',
  icone: 'account_circle',
  camposLigaveis: ['foto'],

  criar: () => ({
    ...ELEMENTO_PADRAO, w: 30, h: 30,
    props: { campo: 'foto', redonda: true, raio: 12, borda: 0, corBorda: '#ffffff' },
  }),

  Render: ({ el, dados }) => {
    const p = el.props
    const url = dados?.[p.campo ?? 'foto'] as string | undefined
    const estilo: React.CSSProperties = {
      width: '100%', height: '100%', objectFit: 'cover', background: '#e5e7eb',
      borderRadius: p.redonda ? '50%' : `${p.raio ?? 0}%`,
      border: p.borda ? `${p.borda}mm solid ${p.corBorda}` : undefined,
      boxSizing: 'border-box',
    }
    return url
      ? <img src={url} alt="" style={estilo} />
      : <div style={{ ...estilo, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa0a8' }}>
          <span className="icon" style={{ fontSize: '60%' }}>person</span>
        </div>
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
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={btn(!!p.redonda)} onClick={() => setProps({ redonda: true })}>Redonda</button>
          <button type="button" style={btn(!p.redonda)} onClick={() => setProps({ redonda: false })}>Quadrada</button>
        </div>
        {!p.redonda && (
          <label style={{ fontSize: 13, color: 'var(--text2)' }}>
            Cantos arredondados ({p.raio ?? 0}%)
            <input type="range" min={0} max={50} value={p.raio ?? 0}
              onChange={e => setProps({ raio: Number(e.target.value) })} style={{ width: '100%' }} />
          </label>
        )}
        <label style={{ fontSize: 13, color: 'var(--text2)' }}>
          Borda ({p.borda ?? 0}mm)
          <input type="range" min={0} max={3} step={0.2} value={p.borda ?? 0}
            onChange={e => setProps({ borda: Number(e.target.value) })} style={{ width: '100%' }} />
        </label>
        {!!p.borda && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Cor da borda</span>
            <input type="color" value={p.corBorda} onChange={e => setProps({ corBorda: e.target.value })}
              style={{ width: 32, height: 28, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 1 }} />
          </div>
        )}
      </div>
    )
  },
})
