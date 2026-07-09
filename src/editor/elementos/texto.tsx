import { ELEMENTO_PADRAO } from '../tipos'
import { FONTES, fontFamilyDe } from '../fontes'
import { registrarElemento } from './registry'

// Texto. Pode ser fixo OU ligado a um campo do cadastro (props.campo).
// Ex: props.campo='nome' → na impressão vira o nome de cada pessoa.

registrarElemento({
  tipo: 'texto',
  nome: 'Texto',
  icone: 'title',
  camposLigaveis: ['nome', 'equipe', 'igreja', 'funcao'],

  criar: () => ({
    ...ELEMENTO_PADRAO, w: 60, h: 10,
    props: { conteudo: 'Texto', campo: null, fonte: 'Padrão', tam: 5, cor: '#111827', negrito: true, italico: false, sublinhado: false, alinhar: 'center' },
  }),

  Render: ({ el, dados }) => {
    const p = el.props
    const texto = p.campo ? (dados?.[p.campo] ?? `{{${p.campo}}}`) : (p.conteudo ?? '')
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center',
        justifyContent: p.alinhar === 'left' ? 'flex-start' : p.alinhar === 'right' ? 'flex-end' : 'center',
        textAlign: p.alinhar, overflow: 'hidden',
      }}>
        <span style={{
          fontSize: `${p.tam}mm`, color: p.cor, lineHeight: 1.2,
          fontFamily: fontFamilyDe(p.fonte),
          fontWeight: p.negrito ? 800 : 400,
          fontStyle: p.italico ? 'italic' : 'normal',
          textDecoration: p.sublinhado ? 'underline' : 'none',
          wordBreak: 'break-word',
        }}>{texto}</span>
      </div>
    )
  },

  Painel: ({ el, setProps }) => {
    const p = el.props
    const btn = (ativo: boolean) => ({
      border: ativo ? '2px solid var(--primary)' : '1px solid var(--border)',
      background: ativo ? 'var(--primary-light)' : 'white',
      color: ativo ? 'var(--primary)' : 'var(--text2)',
      borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
    })
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!p.campo && (
          <input className="form-input" value={p.conteudo ?? ''} placeholder="Escreva o texto"
            onChange={e => setProps({ conteudo: e.target.value })} />
        )}
        <label style={{ fontSize: 13, color: 'var(--text2)' }}>
          Fonte
          <select value={p.fonte ?? 'Padrão'} onChange={e => setProps({ fonte: e.target.value })}
            style={{ width: '100%', marginTop: 4, padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 8,
              fontFamily: fontFamilyDe(p.fonte), fontSize: 14, background: 'white' }}>
            {FONTES.map(f => (
              <option key={f} value={f} style={{ fontFamily: fontFamilyDe(f) }}>{f}</option>
            ))}
          </select>
        </label>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={{ ...btn(!!p.negrito), fontWeight: 800 }} onClick={() => setProps({ negrito: !p.negrito })}>B</button>
          <button type="button" style={{ ...btn(!!p.italico), fontStyle: 'italic' }} onClick={() => setProps({ italico: !p.italico })}>I</button>
          <button type="button" style={{ ...btn(!!p.sublinhado), textDecoration: 'underline' }} onClick={() => setProps({ sublinhado: !p.sublinhado })}>U</button>
          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
          {(['left', 'center', 'right'] as const).map(a => (
            <button key={a} type="button" style={btn(p.alinhar === a)} onClick={() => setProps({ alinhar: a })}>
              <span className="icon icon-sm">{a === 'left' ? 'format_align_left' : a === 'right' ? 'format_align_right' : 'format_align_center'}</span>
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
          <input type="color" value={p.cor} onChange={e => setProps({ cor: e.target.value })}
            style={{ width: 32, height: 28, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 1 }} />
        </div>
        <label style={{ fontSize: 13, color: 'var(--text2)' }}>
          Tamanho da letra ({p.tam}mm)
          <input type="range" min={2} max={30} step={0.5} value={p.tam}
            onChange={e => setProps({ tam: Number(e.target.value) })} style={{ width: '100%' }} />
        </label>
      </div>
    )
  },
})
