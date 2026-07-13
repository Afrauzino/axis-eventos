import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import PrintOverlay from './PrintOverlay'
import { formatName, getInitials } from '../utils'

// Impressão da LISTA DE CADASTROS com escolha de campos.
// O admin escolhe QUAIS campos saem (CPF, RG, nascimento, cargo, igreja...) e
// filtra por tipo. Campo não preenchido sai VAZIO (ex.: quem não pôs nascimento
// fica em branco). Fonte única: tabela people (todos os campos do cadastro).

type Pessoa = {
  id: string; name: string; photo_url: string | null; role_type: string
  phone: string | null; contact_phone: string | null; church: string | null
  sexo: string | null; birth_date: string | null; cpf: string | null; rg: string | null
  cidade: string | null; estado: string | null; endereco: string | null; bairro: string | null; cep: string | null
  ano_encontro: number | null; cargo: string | null; invite_code: string | null
}

// campos que o usuário pode escolher imprimir (nome é fixo, sempre sai)
const CAMPOS: { key: keyof Pessoa | 'tipo'; label: string; larg?: number }[] = [
  { key: 'cargo',         label: 'Cargo' },
  { key: 'tipo',          label: 'Tipo' },
  { key: 'church',        label: 'Igreja' },
  { key: 'phone',         label: 'Celular' },
  { key: 'contact_phone', label: 'Contato emergência' },
  { key: 'sexo',          label: 'Sexo' },
  { key: 'birth_date',    label: 'Nascimento' },
  { key: 'cpf',           label: 'CPF' },
  { key: 'rg',            label: 'RG' },
  { key: 'cidade',        label: 'Cidade' },
  { key: 'estado',        label: 'UF', larg: 34 },
  { key: 'endereco',      label: 'Endereço' },
  { key: 'bairro',        label: 'Bairro' },
  { key: 'cep',           label: 'CEP' },
  { key: 'ano_encontro',  label: 'Ano enc.' },
  { key: 'invite_code',   label: 'Código' },
]
const PADRAO = new Set(['cargo', 'church', 'phone', 'birth_date', 'cpf'])

function dataBR(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}
function valorCampo(p: Pessoa, key: string): string {
  if (key === 'tipo') return p.role_type === 'worker' ? 'Encontreiro' : 'Encontrista'
  if (key === 'birth_date') return dataBR(p.birth_date)
  const v = (p as any)[key]
  return v === null || v === undefined ? '' : String(v)
}

export default function ImprimirCadastros({ onClose }: { onClose: () => void }) {
  const { evento } = useEvento()
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Set<string>>(new Set(PADRAO))
  const [foto, setFoto] = useState(false)
  const [filtro, setFiltro] = useState<'todos' | 'encontrista' | 'encontreiro'>('todos')
  const [formato, setFormato] = useState<'tabela' | 'tirinhas'>('tabela')
  const [colunas, setColunas] = useState(2)
  const [imprimir, setImprimir] = useState(false)

  useEffect(() => {
    if (!evento?.id) return
    supabase.from('people')
      .select('id,name,photo_url,role_type,phone,contact_phone,church,sexo,birth_date,cpf,rg,cidade,estado,endereco,bairro,cep,ano_encontro,cargo,invite_code')
      .eq('event_id', evento.id).order('name')
      .then(({ data }) => { setPessoas((data ?? []) as Pessoa[]); setLoading(false) })
  }, [evento?.id])

  const filtradas = pessoas.filter(p =>
    filtro === 'todos' ? true : filtro === 'encontreiro' ? p.role_type === 'worker' : p.role_type !== 'worker')
  const campos = CAMPOS.filter(c => sel.has(c.key as string))

  function toggle(k: string) {
    setSel(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })
  }

  // ===== A FOLHA IMPRESSA =====
  if (imprimir) {
    return (
      <PrintOverlay titulo={`Cadastros — ${filtradas.length} pessoa(s)`} onClose={() => setImprimir(false)}>
        <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 4px' }}>Cadastros — {evento?.name ?? ''}</h2>
        <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 12px' }}>
          {filtro === 'todos' ? 'Todos' : filtro === 'encontreiro' ? 'Encontreiros' : 'Encontristas'} · {filtradas.length} pessoa(s)
        </p>
        {formato === 'tirinhas' ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colunas}, 1fr)`, gap: 8 }}>
            {filtradas.map(p => (
              <div key={p.id} style={{ border: '1px solid #d1d5db', borderRadius: 10, padding: '8px 10px', breakInside: 'avoid', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                {foto && (
                  <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>{getInitials(p.name)}</span>}
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>{formatName(p.name)}</p>
                  {campos.map(c => {
                    const v = valorCampo(p, c.key as string)
                    return v ? <p key={c.key as string} style={{ fontSize: 10.5, margin: '2px 0 0', lineHeight: 1.25 }}><span style={{ color: '#6b7280' }}>{c.label}:</span> {v}</p> : null
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              {foto && <th style={thS(38)}></th>}
              <th style={thS()}>Nome</th>
              {campos.map(c => <th key={c.key as string} style={thS(c.larg)}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtradas.map(p => (
              <tr key={p.id} style={{ breakInside: 'avoid' }}>
                {foto && (
                  <td style={tdS}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280' }}>{getInitials(p.name)}</span>}
                    </div>
                  </td>
                )}
                <td style={{ ...tdS, fontWeight: 700 }}>{formatName(p.name)}</td>
                {campos.map(c => <td key={c.key as string} style={tdS}>{valorCampo(p, c.key as string)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </PrintOverlay>
    )
  }

  // ===== CONFIGURAÇÃO (escolher campos + filtro) =====
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 350, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 20px 24px', maxHeight: '92vh', overflowY: 'auto', maxWidth: 560, width: '100%', margin: '0 auto' }}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 16px' }} />
        <p style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Imprimir cadastros</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>Escolha os campos que vão sair. O que a pessoa não preencheu sai em branco.</p>

        {/* Filtro de tipo */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {([['todos', 'Todos'], ['encontrista', 'Encontristas'], ['encontreiro', 'Encontreiros']] as const).map(([k, lb]) => (
            <button key={k} onClick={() => setFiltro(k)}
              style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                border: filtro === k ? '2px solid var(--primary)' : '1px solid var(--border)', background: filtro === k ? 'var(--primary-light)' : 'white', color: filtro === k ? 'var(--primary)' : 'var(--text)' }}>
              {lb}
            </button>
          ))}
        </div>

        {/* Formato: tabela ou tirinhas (cards) */}
        <div style={{ display: 'flex', gap: 6, marginBottom: formato === 'tirinhas' ? 10 : 16 }}>
          {([['tabela', 'Tabela'], ['tirinhas', 'Tirinhas (card)']] as const).map(([k, lb]) => (
            <button key={k} onClick={() => setFormato(k)}
              style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                border: formato === k ? '2px solid var(--primary)' : '1px solid var(--border)', background: formato === k ? 'var(--primary-light)' : 'white', color: formato === k ? 'var(--primary)' : 'var(--text)' }}>{lb}</button>
          ))}
        </div>
        {formato === 'tirinhas' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Colunas</span>
            {[1, 2, 3].map(n => (
              <button key={n} onClick={() => setColunas(n)}
                style={{ width: 34, height: 34, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
                  border: colunas === n ? '2px solid var(--primary)' : '1px solid var(--border)', background: colunas === n ? 'var(--primary-light)' : 'white', color: colunas === n ? 'var(--primary)' : 'var(--text)' }}>{n}</button>
            ))}
          </div>
        )}

        <div className="section-label mb-2">Campos</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <ChkCampo label="Foto" on={foto} onClick={() => setFoto(v => !v)} />
          {CAMPOS.map(c => <ChkCampo key={c.key as string} label={c.label} on={sel.has(c.key as string)} onClick={() => toggle(c.key as string)} />)}
        </div>

        <button className="btn btn-primary btn-full" disabled={loading || (campos.length === 0 && !foto)}
          onClick={() => setImprimir(true)}>
          <span className="icon icon-sm">print</span> {loading ? 'Carregando...' : `Gerar (${filtradas.length} pessoa(s))`}
        </button>
        <button className="btn btn-ghost btn-full" onClick={onClose} style={{ marginTop: 8 }}>Fechar</button>
      </div>
    </div>
  )
}

function ChkCampo({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        border: on ? '1px solid var(--primary)' : '1px solid var(--border)', background: on ? 'var(--primary-light)' : 'white' }}>
      <span className="icon icon-sm" style={{ color: on ? 'var(--primary)' : 'var(--muted-light)' }}>{on ? 'check_box' : 'check_box_outline_blank'}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
    </button>
  )
}

const thS = (larg?: number): React.CSSProperties => ({ border: '1px solid #d1d5db', background: '#111827', color: 'white', padding: '5px 6px', textAlign: 'left', fontSize: 10.5, fontWeight: 800, width: larg })
const tdS: React.CSSProperties = { border: '1px solid #d1d5db', padding: '4px 6px', verticalAlign: 'middle' }
