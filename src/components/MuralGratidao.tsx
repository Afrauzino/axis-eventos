import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getInitials, isAdmin } from '../utils'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { toast } from './Toast'
import type { Profile } from '../App'

// Mural de gratidão — feed da tela inicial. Cada pessoa posta uma mensagem
// curta (limite de caracteres), pode marcar várias pessoas, e todos veem em
// tempo real. Foto do autor + estilo feed.

const LIMITE = 280

type Post = {
  id: string; user_id: string | null; autor_nome: string | null; autor_foto: string | null
  texto: string; mencionados: string[]; created_at: string
}
type Pessoa = { id: string; name: string; photo_url: string | null }

function haQuanto(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'agora'
  const m = Math.floor(s / 60); if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24); if (d < 7) return `há ${d}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function MuralGratidao({ eventoId, profile }: { eventoId?: string; profile: Profile }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [texto, setTexto] = useState('')
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [pickerAberto, setPickerAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [carregado, setCarregado] = useState(false)
  useVoltarFecha(pickerAberto, () => setPickerAberto(false))

  const admin = isAdmin(profile.user_role) || profile.is_admin
  const pMap = new Map(pessoas.map(p => [p.id, p]))

  async function carregar(eid: string) {
    const [po, pe] = await Promise.all([
      supabase.from('mural_posts').select('*').eq('event_id', eid).order('created_at', { ascending: false }).limit(50),
      supabase.from('people').select('id,name,photo_url').eq('event_id', eid).order('name'),
    ])
    setPosts((po.data as Post[]) ?? [])
    setPessoas(pe.data ?? [])
    setCarregado(true)
  }

  useEffect(() => {
    if (!eventoId) { setCarregado(true); return }
    carregar(eventoId)
    const canal = supabase.channel('mural-' + eventoId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mural_posts', filter: `event_id=eq.${eventoId}` }, () => carregar(eventoId))
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [eventoId])

  async function postar() {
    const t = texto.trim()
    if (!t || t.length > LIMITE || !eventoId) return
    setEnviando(true)
    const { error } = await supabase.from('mural_posts').insert({
      event_id: eventoId, user_id: profile.user_id,
      autor_nome: profile.full_name, autor_foto: profile.avatar_url,
      texto: t, mencionados: selecionados,
    })
    setEnviando(false)
    if (error) { toast.falha('Não foi possível publicar. Rode o SQL 39_mural_gratidao.sql.', error); return }
    setTexto(''); setSelecionados([])
    carregar(eventoId)
  }

  async function excluir(p: Post) {
    if (!confirm('Apagar esta mensagem?')) return
    await supabase.from('mural_posts').delete().eq('id', p.id)
    if (eventoId) carregar(eventoId)
  }

  function toggleSel(id: string) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  if (!carregado) return null

  const restante = LIMITE - texto.length
  const filtradas = busca.trim()
    ? pessoas.filter(p => p.name.toLowerCase().includes(busca.toLowerCase()))
    : pessoas

  return (
    <div style={{ background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 16 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'linear-gradient(135deg,#ED8936,#DD6B20)' }}>
        <span style={{ fontSize: 20 }}>🙌</span>
        <div>
          <p style={{ fontWeight: 800, fontSize: 15, color: 'white', lineHeight: 1.1 }}>Mural de Gratidão</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>Deixe uma mensagem para todos</p>
        </div>
      </div>

      {/* Composer */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{getInitials(profile.full_name ?? '?')}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <textarea value={texto} onChange={e => setTexto(e.target.value.slice(0, LIMITE))}
              placeholder="Sou grato por..." rows={2}
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px', fontFamily: 'inherit', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', minHeight: 44 }} />

            {/* Chips de marcados */}
            {selecionados.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {selecionados.map(id => {
                  const p = pMap.get(id)
                  return (
                    <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--primary-light)', color: 'var(--primary-dark)', borderRadius: 99, padding: '3px 6px 3px 8px', fontSize: 12, fontWeight: 700 }}>
                      {p?.name ?? '—'}
                      <button onClick={() => toggleSel(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-dark)', display: 'flex', padding: 0 }}><span className="icon" style={{ fontSize: 15 }}>close</span></button>
                    </span>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
              <button onClick={() => { setBusca(''); setPickerAberto(true) }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                <span className="icon icon-sm">alternate_email</span> Marcar {selecionados.length > 0 ? `(${selecionados.length})` : 'pessoas'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: restante < 20 ? 'var(--danger)' : 'var(--muted)' }}>{restante}</span>
                <button onClick={postar} disabled={enviando || !texto.trim()}
                  style={{ background: texto.trim() ? 'var(--primary)' : 'var(--border)', color: 'white', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: texto.trim() ? 'pointer' : 'default', fontSize: 13, fontWeight: 800, fontFamily: 'inherit' }}>
                  {enviando ? '...' : 'Publicar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div style={{ maxHeight: 460, overflowY: 'auto' }}>
        {posts.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 26, marginBottom: 6 }}>💬</p>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Seja o primeiro a deixar uma mensagem de gratidão!</p>
          </div>
        ) : posts.map(p => {
          const nomes = (p.mencionados ?? []).map(id => pMap.get(id)?.name).filter(Boolean) as string[]
          const podeApagar = p.user_id === profile.user_id || admin
          return (
            <div key={p.id} style={{ display: 'flex', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.autor_foto
                  ? <img src={p.autor_foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{getInitials(p.autor_nome ?? '?')}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.autor_nome ?? 'Alguém'}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>· {haQuanto(p.created_at)}</span>
                  {podeApagar && <button onClick={() => excluir(p)} title="Apagar" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 2 }}><span className="icon icon-sm">delete</span></button>}
                </div>
                <p style={{ fontSize: 14, color: 'var(--text)', marginTop: 2, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{p.texto}</p>
                {nomes.length > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, marginTop: 4 }}>🙌 {nomes.map(n => `@${n.split(' ')[0]}`).join(' ')}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Picker de marcar pessoas */}
      {pickerAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setPickerAberto(false)}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 16px 20px', maxWidth: 480, width: '100%', margin: '0 auto', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 12px', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>Marcar pessoas {selecionados.length > 0 ? `(${selecionados.length})` : ''}</span>
              <button onClick={() => setPickerAberto(false)} className="btn btn-primary btn-sm">Concluir</button>
            </div>
            <input className="form-input" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pessoa..." style={{ marginBottom: 10, flexShrink: 0 }} />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filtradas.map(p => {
                const on = selecionados.includes(p.id)
                return (
                  <button key={p.id} onClick={() => toggleSel(p.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{getInitials(p.name)}</span>}
                    </div>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: on ? 800 : 500, color: on ? 'var(--primary-dark)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span className="icon" style={{ color: on ? 'var(--primary)' : 'var(--border)', flexShrink: 0 }}>{on ? 'check_circle' : 'radio_button_unchecked'}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
