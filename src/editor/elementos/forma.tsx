import { ELEMENTO_PADRAO } from '../tipos'
import { registrarElemento } from './registry'

// Formas básicas (retângulo, elipse, linha). Base pra efeitos/bordas futuras.

registrarElemento({
  tipo: 'forma',
  nome: 'Forma',
  icone: 'square',

  criar: () => ({
    ...ELEMENTO_PADRAO, w: 40, h: 20,
    props: { forma: 'retangulo' as 'retangulo' | 'elipse' | 'linha', preenchimento: '#E5E7EB', borda: 0, corBorda: '#111827', raio: 2 },
  }),

  Render: ({ el }) => {
    const p = el.props
    if (p.forma === 'linha') {
      return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
        <div style={{ width: '100%', height: `${Math.max(p.borda, 0.3)}mm`, background: p.corBorda }} />
      </div>
    }
    return <div style={{
      width: '100%', height: '100%', background: p.preenchimento,
      borderRadius: p.forma === 'elipse' ? '50%' : `${p.raio}mm`,
      border: p.borda ? `${p.borda}mm solid ${p.corBorda}` : undefined,
      boxSizing: 'border-box',
    }} />
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
          {(['retangulo', 'elipse', 'linha'] as const).map(f => (
            <button key={f} type="button" style={btn(p.forma === f)} onClick={() => setProps({ forma: f })}>
              {f === 'retangulo' ? 'Retângulo' : f === 'elipse' ? 'Elipse' : 'Linha'}
            </button>
          ))}
        </div>
        {p.forma !== 'linha' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Preenchimento</span>
            <input type="color" value={p.preenchimento} onChange={e => setProps({ preenchimento: e.target.value })}
              style={{ width: 32, height: 28, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 1 }} />
          </div>
        )}
        <label style={{ fontSize: 13, color: 'var(--text2)' }}>
          Espessura da borda ({p.borda}mm)
          <input type="range" min={0} max={4} step={0.2} value={p.borda} onChange={e => setProps({ borda: Number(e.target.value) })} style={{ width: '100%' }} />
        </label>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>Cor da borda</span>
          <input type="color" value={p.corBorda} onChange={e => setProps({ corBorda: e.target.value })}
            style={{ width: 32, height: 28, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 1 }} />
        </div>
        {p.forma === 'retangulo' && (
          <label style={{ fontSize: 13, color: 'var(--text2)' }}>
            Cantos ({p.raio}mm)
            <input type="range" min={0} max={20} step={0.5} value={p.raio} onChange={e => setProps({ raio: Number(e.target.value) })} style={{ width: '100%' }} />
          </label>
        )}
      </div>
    )
  },
})
