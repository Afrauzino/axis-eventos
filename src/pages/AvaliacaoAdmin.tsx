import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { carregarConfig, salvarConfig } from '../lib/tema'
import { useRegistrarChromeAdmin } from '../lib/chrome'
import { toast } from '../components/Toast'
import { useEvento } from '../hooks/useEvento'
import { formatName } from '../utils'
import { AVAL_CATS } from './Avaliacao'
import { AVAL_TIT_PADRAO, AVAL_SUB_PADRAO } from '../components/BannerAvaliacao'
import type { Profile } from '../App'

// Administração → Avaliação pós-evento: liberar, editar textos, ver respostas (só admin).
export default function AvaliacaoAdmin({ profile: _profile }: { profile?: Profile }) {
  useRegistrarChromeAdmin()
  const { evento } = useEvento()
  const [liberada, setLiberada] = useState(false)
  const [tit, setTit] = useState(AVAL_TIT_PADRAO)
  const [sub, setSub] = useState(AVAL_SUB_PADRAO)
  const [respostas, setRespostas] = useState<any[]>([])
  const [nomes, setNomes] = useState<Record<string, string>>({})
  const [carregado, setCarregado] = useState(false)
  const [salvandoT, setSalvandoT] = useState(false)

  useEffect(() => { if (evento) carregar() }, [evento?.id])
  async function carregar() {
    const { data: ev } = await supabase.from('events').select('avaliacao_liberada').eq('id', evento!.id).maybeSingle()
    setLiberada(!!ev?.avaliacao_liberada)
    const [t, s] = await Promise.all([carregarConfig('avaliacao_titulo'), carregarConfig('avaliacao_subtitulo')])
    if (t) setTit(t)
    if (s) setSub(s)
    const { data: av } = await supabase.from('avaliacoes').select('*').eq('event_id', evento!.id).order('created_at', { ascending: false })
    setRespostas(av ?? [])
    const uids = [...new Set((av ?? []).map((a: any) => a.user_id))]
    if (uids.length) {
      const { data: pf } = await supabase.from('profiles').select('user_id,name').in('user_id', uids)
      const m: Record<string, string> = {}; for (const p of pf ?? []) m[p.user_id] = p.name; setNomes(m)
    }
    setCarregado(true)
  }

  async function toggleLiberar() {
    const novo = !liberada; setLiberada(novo)
    const { error } = await supabase.from('events').update({ avaliacao_liberada: novo }).eq('id', evento!.id)
    if (error) { setLiberada(!novo); toast.falha('Não foi possível salvar. Rode o sql/65_avaliacao.sql.', error) }
  }
  async function salvarTextos() {
    setSalvandoT(true)
    await Promise.all([salvarConfig('avaliacao_titulo', tit.trim() || AVAL_TIT_PADRAO), salvarConfig('avaliacao_subtitulo', sub.trim() || AVAL_SUB_PADRAO)])
    setSalvandoT(false); toast.sucesso('Textos salvos!')
  }

  const total = respostas.length
  const media = (col: string) => { const v = respostas.map(r => r[col]).filter((x: any) => x != null); return v.length ? (v.reduce((s: number, x: number) => s + x, 0) / v.length) : 0 }
  const servirSim = respostas.filter(r => r.servir === true).length
  const posSim = respostas.filter(r => r.pos_encontro === true).length

  if (!evento) return <div className="page"><p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum evento ativo.</p></div>
  if (!carregado) return <div className="page"><div className="skeleton" style={{ height: 200, borderRadius: 12 }} /></div>

  return (
    <div className="page">
      {/* Liberar */}
      <div className="card-item" style={{ cursor: 'default' }}>
        <div className="card-item-bar" style={{ background: liberada ? 'var(--success)' : 'var(--muted-light)' }} />
        <div className="card-item-avatar" style={{ background: liberada ? 'var(--success-bg)' : 'var(--bg)' }}><span style={{ fontSize: 22 }}>{liberada ? '🟢' : '⚪'}</span></div>
        <div className="card-item-wrap"><div className="card-item-main"><div className="card-item-title">Liberar avaliação</div><div className="card-item-sub">{liberada ? 'Aparecendo na Início dos encontristas' : 'Encontristas ainda não veem'}</div></div></div>
        <div className="card-item-direita">
          <button onClick={toggleLiberar} aria-label="Liberar avaliação" style={{ width: 46, height: 27, borderRadius: 99, border: 'none', cursor: 'pointer', background: liberada ? 'var(--success)' : 'var(--border)', position: 'relative' }}>
            <span style={{ position: 'absolute', top: 3, left: liberada ? 22 : 3, width: 21, height: 21, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left .15s' }} />
          </button>
        </div>
      </div>

      {/* Textos do card */}
      <div style={{ background: 'white', borderRadius: 12, boxShadow: 'var(--shadow-sm)', padding: 14, margin: '10px 0' }}>
        <p className="section-label mb-2">Texto do card</p>
        <div className="form-group"><label className="form-label">Título</label><input className="form-input" value={tit} onChange={e => setTit(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Mensagem</label><textarea className="form-input" value={sub} onChange={e => setSub(e.target.value)} rows={3} style={{ resize: 'vertical' }} /></div>
        <button className="btn btn-primary btn-full" onClick={salvarTextos} disabled={salvandoT}>{salvandoT ? 'Salvando...' : 'Salvar textos'}</button>
      </div>

      {/* Respostas */}
      <p className="section-label mb-2">Respostas <span className="badge badge-success" style={{ fontSize: 9 }}>confidencial</span></p>
      {total === 0 ? (
        <div className="empty"><p className="empty-desc">Nenhuma resposta ainda.</p></div>
      ) : (
        <>
          <div className="card-item" style={{ cursor: 'default' }}>
            <div className="card-item-bar" style={{ background: 'var(--primary)' }} />
            <div className="card-item-avatar" style={{ background: 'var(--primary-light)' }}><span style={{ fontSize: 22 }}>📊</span></div>
            <div className="card-item-wrap"><div className="card-item-main"><div className="card-item-title">{total} resposta{total === 1 ? '' : 's'}</div><div className="card-item-sub">Média geral {media('nota_geral').toFixed(1)} ★ · {servirSim} querem servir · {posSim} querem o Pós</div></div></div>
          </div>

          <div style={{ background: 'white', borderRadius: 12, boxShadow: 'var(--shadow-sm)', padding: '8px 14px', margin: '10px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {AVAL_CATS.map(c => (
              <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '5px 0' }}>
                <span>{c.emoji} {c.label}</span><b style={{ color: '#F6AD55' }}>{media('nota_' + c.key).toFixed(1)} ★</b>
              </div>
            ))}
          </div>

          {respostas.map(r => (
            <div key={r.id} style={{ background: 'white', borderRadius: 12, boxShadow: 'var(--shadow-sm)', padding: '12px 14px', marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{formatName(nomes[r.user_id] || '—')} <span style={{ fontSize: 11, color: '#F6AD55', fontWeight: 800 }}>{r.nota_geral ?? '—'}★</span></p>
              {r.marcou && <p style={{ fontSize: 12.5, color: 'var(--text2)', margin: '2px 0' }}><b style={{ color: 'var(--muted)' }}>Marcou:</b> {r.marcou}</p>}
              {r.melhorar && <p style={{ fontSize: 12.5, color: 'var(--text2)', margin: '2px 0' }}><b style={{ color: 'var(--muted)' }}>Melhorar:</b> {r.melhorar}</p>}
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Servir: {r.servir === true ? 'Sim' : r.servir === false ? 'Não' : '—'} · Pós-Encontro: {r.pos_encontro === true ? 'Sim' : r.pos_encontro === false ? 'Não' : '—'}</p>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
