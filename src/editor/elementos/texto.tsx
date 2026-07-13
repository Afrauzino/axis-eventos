import { ELEMENTO_PADRAO } from '../tipos'
import { FONTES, fontFamilyDe } from '../fontes'
import { registrarElemento } from './registry'

// Texto. Pode ser fixo OU ligado a um campo do cadastro (props.campo).
// Ex: props.campo='nome' → na impressão vira o nome de cada pessoa.

const PARTICULAS = new Set(['de', 'da', 'das', 'do', 'dos', 'e', 'di', 'du', 'del', 'della', 'van', 'von', 'y', 'la', 'le'])

/** Corta o nome nos N primeiros. As preposições grudam no nome seguinte,
 *  então "Clarice Gonçalves Pereira da Silva" com 4 termina em "…da Silva",
 *  nunca num "da" solto. Com 0 (ou nada) devolve o nome inteiro. */
export function primeirosNomes(nome: string, quantos: number): string {
  if (!quantos || quantos <= 0) return nome
  const grupos: string[] = []
  let pendente = ''
  for (const palavra of nome.trim().split(/\s+/).filter(Boolean)) {
    if (PARTICULAS.has(palavra.toLowerCase())) { pendente = pendente ? `${pendente} ${palavra}` : palavra; continue }
    grupos.push(pendente ? `${pendente} ${palavra}` : palavra)
    pendente = ''
  }
  if (pendente) {
    if (grupos.length) grupos[grupos.length - 1] += ` ${pendente}`
    else grupos.push(pendente)
  }
  return grupos.slice(0, quantos).join(' ')
}

registrarElemento({
  tipo: 'texto',
  nome: 'Texto',
  icone: 'title',
  camposLigaveis: ['nome', 'funcao', 'cargo', 'equipe', 'igreja', 'celular', 'contato', 'sexo', 'nascimento', 'cpf', 'rg', 'cidade', 'estado', 'endereco', 'bairro', 'cep', 'ano', 'codigo'],

  criar: () => ({
    ...ELEMENTO_PADRAO, w: 60, h: 10,
    props: { conteudo: 'Texto', campo: null, nomes: 0, fonte: 'Padrão', tam: 5, cor: '#111827', negrito: true, italico: false, sublinhado: false, alinhar: 'center' },
  }),

  Render: ({ el, dados }) => {
    const p = el.props
    let texto = p.campo ? (dados?.[p.campo] ?? `{{${p.campo}}}`) : (p.conteudo ?? '')
    if (p.campo === 'nome' && p.nomes > 0) texto = primeirosNomes(String(texto), p.nomes)
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

        {/* Só faz sentido pro nome da pessoa: quantos nomes puxar do cadastro */}
        {p.campo === 'nome' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 5 }}>Quantos nomes</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([0, 1, 2, 3, 4] as const).map(n => (
                <button key={n} type="button" style={btn((p.nomes ?? 0) === n)} onClick={() => setProps({ nomes: n })}>
                  {n === 0 ? 'Completo' : n}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
              Ex.: “Clarice Gonçalves Pereira da Silva” com <b>2</b> vira “Clarice Gonçalves”.
            </p>
          </div>
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
