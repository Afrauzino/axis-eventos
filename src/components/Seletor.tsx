import { useState } from 'react'

// Seletor no padrão AXIS (substitui o <select> nativo cinza).
// - Poucas opções (<=3, sem descrição) → botões lado a lado.
// - Senão → campo com a cor do sistema que abre a LISTA DE BAIXO (bottom-sheet).
export type Opcao = { value: string; label: string; emoji?: string; descricao?: string }

type Props = {
  value: string
  onChange: (v: string) => void
  opcoes: Opcao[]
  titulo?: string
  placeholder?: string
  disabled?: boolean
  inline?: boolean          // força botões lado a lado
  sheet?: boolean           // força lista de baixo
  compact?: boolean         // gatilho pequeno (p/ usar inline em cards/listas)
}

export default function Seletor({ value, onChange, opcoes, titulo = 'Selecione', placeholder = 'Selecione...', disabled, inline, sheet, compact }: Props) {
  const [aberto, setAberto] = useState(false)
  const atual = opcoes.find(o => o.value === value)
  const usarBotoes = inline ?? (!sheet && opcoes.length <= 3 && !opcoes.some(o => o.descricao))

  if (usarBotoes) {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {opcoes.map(o => {
          const sel = o.value === value
          return (
            <button key={o.value} type="button" disabled={disabled} onClick={() => onChange(o.value)}
              style={{ flex: '1 1 0', minWidth: 84, padding: '10px 8px', borderRadius: 9, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                border: sel ? '2px solid var(--primary)' : '1px solid var(--border)', background: sel ? 'var(--primary-light)' : 'white', color: sel ? 'var(--primary-dark)' : 'var(--text2)' }}>
              {o.emoji ? o.emoji + ' ' : ''}{o.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => !disabled && setAberto(true)}
        style={compact
          ? { maxWidth: 150, border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg)', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.6 : 1 }
          : { width: '100%', border: '1.5px solid var(--primary)', borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'white', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.6 : 1 }}>
        <span style={{ fontSize: compact ? 11 : 14, fontWeight: compact ? 600 : 400, color: atual ? 'var(--text)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {atual ? `${atual.emoji ? atual.emoji + ' ' : ''}${atual.label}` : placeholder}
        </span>
        <span className="icon icon-sm" style={{ color: 'var(--primary)', flexShrink: 0, fontSize: compact ? 16 : undefined }}>expand_more</span>
      </button>

      {aberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setAberto(false)}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 16px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 14px' }} />
            <p style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, padding: '0 4px' }}>{titulo}</p>
            {opcoes.map(o => {
              const sel = o.value === value
              return (
                <button key={o.value} type="button" onClick={() => { onChange(o.value); setAberto(false) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    border: sel ? '2px solid var(--primary)' : '1px solid var(--border)', background: sel ? 'var(--primary-light)' : 'white' }}>
                  {o.emoji && <span style={{ fontSize: 18 }}>{o.emoji}</span>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: sel ? 700 : 600, color: sel ? 'var(--primary-dark)' : 'var(--text)' }}>{o.label}</p>
                    {o.descricao && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{o.descricao}</p>}
                  </div>
                  {sel && <span className="icon icon-sm" style={{ color: 'var(--primary)' }}>check</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
