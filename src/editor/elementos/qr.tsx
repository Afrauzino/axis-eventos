import { QRCodeSVG } from 'qrcode.react'
import { ELEMENTO_PADRAO } from '../tipos'
import { registrarElemento } from './registry'

// QR Code. Pode ser FIXO (um link/texto igual pra todos) OU ligado a um campo
// do cadastro (ex.: 'codigo' → o código de acesso de cada pessoa). Na impressão
// "Repetir por pessoa", cada crachá sai com o QR daquela pessoa — dá pra fazer
// check-in lendo com a câmera. Vira SVG, então imprime nítido em qualquer tamanho.
// Ligar/desligar o campo é na ferramenta "Dados" (igual ao texto).

const NIVEIS = [
  { v: 'L', nome: 'Baixa' },
  { v: 'M', nome: 'Média' },
  { v: 'Q', nome: 'Alta' },
  { v: 'H', nome: 'Máxima' },
] as const

registrarElemento({
  tipo: 'qr',
  nome: 'QR Code',
  icone: 'qr_code_2',
  camposLigaveis: ['codigo', 'nome', 'cpf', 'rg', 'celular', 'contato', 'igreja', 'equipe'],

  criar: () => ({
    ...ELEMENTO_PADRAO, w: 25, h: 25,
    props: { campo: 'codigo', conteudo: '', cor: '#111827', fundo: '#ffffff', nivel: 'M', margem: 2 },
  }),

  Render: ({ el, dados }) => {
    const p = el.props
    const bruto = p.campo ? dados?.[p.campo] : p.conteudo
    const valor = bruto != null && String(bruto).trim() !== ''
      ? String(bruto)
      : (p.campo ? `{{${p.campo}}}` : '')

    // Sem valor (texto fixo em branco): mostra um marcador, não um QR vazio.
    if (!valor) {
      return (
        <div style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#f1f3f5', color: '#adb5bd', borderRadius: 4,
        }}>
          <span className="icon" style={{ fontSize: '55%' }}>qr_code_2</span>
        </div>
      )
    }

    // viewBox quadrado + width/height 100%: o navegador mantém o QR quadrado e
    // centralizado mesmo se a caixa não for quadrada (não distorce, então lê sempre).
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <QRCodeSVG
          value={valor}
          level={(p.nivel ?? 'M') as 'L' | 'M' | 'Q' | 'H'}
          marginSize={p.margem ?? 0}
          fgColor={p.cor ?? '#111827'}
          bgColor={p.fundo ?? '#ffffff'}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    )
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
        {!p.campo ? (
          <input className="form-input" value={p.conteudo ?? ''} placeholder="Cole um link ou digite um texto"
            onChange={e => setProps({ conteudo: e.target.value })} />
        ) : (
          <p style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--primary-light)', padding: '8px 10px', borderRadius: 8 }}>
            Ligado ao campo <b>{p.campo}</b>. Cada pessoa sai com o QR do dado dela.
            Pra trocar o campo (ou deixar fixo), use <b>Dados</b>.
          </p>
        )}

        <div>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>Correção de erro</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {NIVEIS.map(n => (
              <button key={n.v} type="button" style={btn((p.nivel ?? 'M') === n.v)} onClick={() => setProps({ nivel: n.v })}>
                {n.nome}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
            Mais alta = lê mesmo pequeno, borrado ou riscado (fica um pouco mais “cheio”).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>Cor</span>
          <input type="color" value={p.cor ?? '#111827'} onChange={e => setProps({ cor: e.target.value })}
            style={{ width: 32, height: 28, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 1 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>Fundo</span>
          <input type="color" value={p.fundo ?? '#ffffff'} onChange={e => setProps({ fundo: e.target.value })}
            style={{ width: 32, height: 28, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 1 }} />
        </div>

        <label style={{ fontSize: 13, color: 'var(--text2)' }}>
          Margem em volta ({p.margem ?? 0})
          <input type="range" min={0} max={6} step={1} value={p.margem ?? 0}
            onChange={e => setProps({ margem: Number(e.target.value) })} style={{ width: '100%' }} />
        </label>
      </div>
    )
  },
})
