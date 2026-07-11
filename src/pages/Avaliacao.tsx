import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import { toast } from '../components/Toast'
import type { Profile } from '../App'

// Categorias fixas da avaliação (chave = coluna nota_<chave> em avaliacoes)
export const AVAL_CATS = [
  { key: 'recepcao',    label: 'Recepção',                emoji: '🤝', cor: '#00A99D' },
  { key: 'alimentacao', label: 'Alimentação',             emoji: '🍽️', cor: '#DD6B20' },
  { key: 'organizacao', label: 'Organização',             emoji: '📋', cor: '#6B46C1' },
  { key: 'alojamento',  label: 'Alojamento',              emoji: '🛏️', cor: '#3182CE' },
  { key: 'equipe',      label: 'Equipe de encontreiros',  emoji: '🛡️', cor: '#38A169' },
  { key: 'geral',       label: 'Avaliação geral',         emoji: '⭐', cor: '#D69E2E' },
] as const

function tint(hex: string, a: number) {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`
}

function Estrelas({ valor, onChange }: { valor: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onMouseDown={e => { e.preventDefault(); onChange(i === valor ? 0 : i) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 26, color: i <= valor ? '#F6AD55' : 'var(--border)' }}>★</button>
      ))}
    </div>
  )
}

export default function Avaliacao({ profile }: { profile?: Profile }) {
  const { evento } = useEvento()
  const navigate = useNavigate()
  const [notas, setNotas] = useState<Record<string, number>>({})
  const [marcou, setMarcou] = useState('')
  const [melhorar, setMelhorar] = useState('')
  const [servir, setServir] = useState<boolean | null>(null)
  const [pos, setPos] = useState<boolean | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    if (!evento || !profile) return
    ;(async () => {
      const { data } = await supabase.from('avaliacoes').select('*').eq('event_id', evento.id).eq('user_id', profile.user_id).maybeSingle()
      if (data) {
        setNotas({ recepcao: data.nota_recepcao ?? 0, alimentacao: data.nota_alimentacao ?? 0, organizacao: data.nota_organizacao ?? 0, alojamento: data.nota_alojamento ?? 0, equipe: data.nota_equipe ?? 0, geral: data.nota_geral ?? 0 })
        setMarcou(data.marcou ?? ''); setMelhorar(data.melhorar ?? '')
        setServir(data.servir); setPos(data.pos_encontro)
      }
      setCarregado(true)
    })()
  }, [evento?.id, profile?.user_id])

  async function enviar() {
    if (!evento || !profile) return
    setSalvando(true)
    const { error } = await supabase.from('avaliacoes').upsert({
      event_id: evento.id, user_id: profile.user_id,
      nota_recepcao: notas.recepcao || null, nota_alimentacao: notas.alimentacao || null,
      nota_organizacao: notas.organizacao || null, nota_alojamento: notas.alojamento || null,
      nota_equipe: notas.equipe || null, nota_geral: notas.geral || null,
      marcou: marcou.trim() || null, melhorar: melhorar.trim() || null,
      servir, pos_encontro: pos,
    }, { onConflict: 'event_id,user_id' })
    setSalvando(false)
    if (error) { toast.falha('Não foi possível enviar. Rode o sql/65_avaliacao.sql.', error); return }
    toast.sucesso('Avaliação enviada! Obrigado 💚')
    navigate('/')
  }

  const Seg = ({ v, set }: { v: boolean | null; set: (b: boolean) => void }) => (
    <div style={{ display: 'flex', gap: 6, background: 'var(--bg)', borderRadius: 10, padding: 4 }}>
      <button type="button" onClick={() => set(true)} style={{ flex: 1, border: 'none', borderRadius: 8, padding: '9px 0', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: v === true ? 'var(--success)' : 'transparent', color: v === true ? 'white' : 'var(--muted)' }}>Sim</button>
      <button type="button" onClick={() => set(false)} style={{ flex: 1, border: 'none', borderRadius: 8, padding: '9px 0', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: v === false ? 'var(--danger)' : 'transparent', color: v === false ? 'white' : 'var(--muted)' }}>Não</button>
    </div>
  )

  if (!evento) return <div className="page"><p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum evento ativo.</p></div>
  if (!carregado) return <div className="page">{[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 66, marginBottom: 10, borderRadius: 12 }} />)}</div>

  return (
    <div className="page">
      <p className="section-label mb-2">Dê sua nota (toque nas estrelas)</p>
      {AVAL_CATS.map(c => (
        <div key={c.key} className="card-item" style={{ cursor: 'default' }}>
          <div className="card-item-bar" style={{ background: c.cor }} />
          <div className="card-item-avatar" style={{ background: tint(c.cor, 0.14) }}><span style={{ fontSize: 24 }}>{c.emoji}</span></div>
          <div className="card-item-wrap"><div className="card-item-main"><div className="card-item-title">{c.label}</div></div></div>
          <div className="card-item-direita"><Estrelas valor={notas[c.key] ?? 0} onChange={v => setNotas(n => ({ ...n, [c.key]: v }))} /></div>
        </div>
      ))}

      <div style={{ background: 'white', borderRadius: 12, boxShadow: 'var(--shadow-sm)', padding: 14, margin: '4px 0 10px' }}>
        <label className="form-label">O que mais te marcou?</label>
        <textarea className="form-input" value={marcou} onChange={e => setMarcou(e.target.value)} rows={2} placeholder="Compartilhe o que Deus fez em você…" style={{ resize: 'vertical' }} />
      </div>
      <div style={{ background: 'white', borderRadius: 12, boxShadow: 'var(--shadow-sm)', padding: 14, marginBottom: 10 }}>
        <label className="form-label">O que pode melhorar?</label>
        <textarea className="form-input" value={melhorar} onChange={e => setMelhorar(e.target.value)} rows={2} placeholder="Opcional" style={{ resize: 'vertical' }} />
      </div>
      <div style={{ background: 'white', borderRadius: 12, boxShadow: 'var(--shadow-sm)', padding: 14, marginBottom: 10 }}>
        <label className="form-label">Gostaria de servir como encontreiro no futuro?</label>
        <Seg v={servir} set={setServir} />
      </div>
      <div style={{ background: 'white', borderRadius: 12, boxShadow: 'var(--shadow-sm)', padding: 14, marginBottom: 14 }}>
        <label className="form-label">Deseja receber informações do Pós-Encontro?</label>
        <Seg v={pos} set={setPos} />
      </div>

      <button className="btn btn-primary btn-full" onClick={enviar} disabled={salvando}>{salvando ? 'Enviando...' : 'Enviar avaliação'}</button>
    </div>
  )
}
