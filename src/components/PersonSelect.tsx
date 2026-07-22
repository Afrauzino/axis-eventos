import { useState, useRef, useEffect } from 'react'
import { getInitials } from '../utils'

type Pessoa = { id: string; name: string; apelido?: string | null; photo_url?: string | null }

type Props = {
  pessoas: Pessoa[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  label?: string
  required?: boolean
}

export default function PersonSelect({ pessoas, value, onChange, placeholder = 'Selecionar pessoa...', label, required }: Props) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca]   = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selecionada = pessoas.find(p => p.id === value)
  const filtradas   = pessoas.filter(p =>
    !busca || p.name.toLowerCase().includes(busca.toLowerCase())
  )

  useEffect(() => {
    function clickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', clickFora)
    return () => document.removeEventListener('mousedown', clickFora)
  }, [])

  function selecionar(id: string) {
    onChange(id)
    setAberto(false)
    setBusca('')
  }

  function limpar() {
    onChange('')
    setAberto(false)
    setBusca('')
  }

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: label ? 0 : 0 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}>
          {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
        </label>
      )}

      {/* Botao trigger */}
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
          border: `1.5px solid ${aberto ? 'var(--primary)' : 'var(--border)'}`,
          background: aberto ? 'white' : 'var(--bg)', fontFamily: 'inherit',
          transition: 'border-color 0.15s',
          boxShadow: aberto ? '0 0 0 3px rgba(0,169,157,0.12)' : 'none',
        }}
      >
        {selecionada ? (
          <>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', overflow: 'hidden', flexShrink: 0 }}>
              {selecionada.photo_url
                ? <img src={selecionada.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : getInitials(selecionada.name)
              }
            </div>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text)', textAlign: 'left' }}>{selecionada.name}</span>
            <button type="button" onClick={e => { e.stopPropagation(); limpar() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-light)', padding: 0, lineHeight: 1, fontFamily: 'inherit' }}>
              <span className="icon icon-sm">close</span>
            </button>
          </>
        ) : (
          <>
            <span className="icon icon-sm" style={{ color: 'var(--muted-light)' }}>person_search</span>
            <span style={{ flex: 1, fontSize: 14, color: 'var(--muted-light)', textAlign: 'left' }}>{placeholder}</span>
            <span className="icon icon-sm" style={{ color: 'var(--muted-light)' }}>expand_more</span>
          </>
        )}
      </button>

      {/* Dropdown */}
      {aberto && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'white', border: '1.5px solid var(--border)', borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 500, overflow: 'hidden',
        }}>
          {/* Campo de busca */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="icon icon-sm" style={{ color: 'var(--muted-light)' }}>search</span>
            <input
             
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome..."
              style={{ border: 'none', outline: 'none', fontSize: 14, color: 'var(--text)', background: 'transparent', width: '100%', fontFamily: 'inherit' }}
            />
          </div>

          {/* Lista */}
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {/* Opcao vazia */}
            <button type="button" onClick={limpar} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="icon icon-sm" style={{ color: 'var(--muted-light)' }}>person_off</span>
              </div>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum</span>
            </button>

            {filtradas.length === 0 ? (
              <p style={{ padding: '12px 14px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
                Nenhum resultado para "{busca}"
              </p>
            ) : filtradas.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => selecionar(p.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: p.id === value ? 'var(--primary-light)' : 'none',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', overflow: 'hidden', flexShrink: 0 }}>
                  {p.photo_url
                    ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : getInitials(p.name)
                  }
                </div>
                <span style={{ fontSize: 14, fontWeight: p.id === value ? 700 : 400, color: p.id === value ? 'var(--primary-dark)' : 'var(--text)' }}>
                  {p.name}{p.apelido && <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 5 }}>“{p.apelido}”</span>}
                </span>
                {p.id === value && <span className="icon icon-sm" style={{ color: 'var(--primary)', marginLeft: 'auto' }}>check</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
