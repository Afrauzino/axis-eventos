import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { carregarConfig } from '../lib/tema'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

export const AVAL_TIT_PADRAO = 'Conte como foi seu Encontro com Deus'
export const AVAL_SUB_PADRAO = 'Sua experiência é muito importante. Reserve alguns minutos pra responder — isso nos ajuda a cuidar melhor das próximas turmas.'

// Card na Início: só para ENCONTRISTAS (role_type=encounterer), quando o admin
// liberou a avaliação naquele evento. Depois de responder, vira "Obrigado".
export default function BannerAvaliacao({ profile }: { profile: Profile }) {
  const { evento } = useEvento()
  const navigate = useNavigate()
  const [estado, setEstado] = useState<'nada' | 'responder' | 'obrigado'>('nada')
  const [tit, setTit] = useState(AVAL_TIT_PADRAO)
  const [sub, setSub] = useState(AVAL_SUB_PADRAO)

  useEffect(() => {
    if (!evento || !profile) return
    let ativo = true
    ;(async () => {
      const { data: ev } = await supabase.from('events').select('avaliacao_liberada').eq('id', evento.id).maybeSingle()
      if (!ativo || !ev?.avaliacao_liberada) return
      const { data: p } = await supabase.from('people').select('role_type').eq('user_id', profile.user_id).eq('event_id', evento.id).maybeSingle()
      if (!ativo || p?.role_type !== 'encounterer') return   // só encontristas
      const { data: av } = await supabase.from('avaliacoes').select('id').eq('event_id', evento.id).eq('user_id', profile.user_id).maybeSingle()
      const [t, s] = await Promise.all([carregarConfig('avaliacao_titulo'), carregarConfig('avaliacao_subtitulo')])
      if (!ativo) return
      if (t) setTit(t)
      if (s) setSub(s)
      setEstado(av ? 'obrigado' : 'responder')
    })()
    return () => { ativo = false }
  }, [evento?.id, profile?.user_id])

  if (estado === 'nada') return null

  if (estado === 'obrigado') return (
    <div style={{ background: 'white', borderRadius: 12, boxShadow: 'var(--shadow-sm)', overflow: 'hidden', display: 'flex', marginBottom: 16 }}>
      <div style={{ width: 6, background: 'var(--success)', flexShrink: 0 }} />
      <div style={{ padding: 18, textAlign: 'center', flex: 1 }}>
        <div style={{ fontSize: 32 }}>✅</div>
        <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)', margin: '6px 0 4px' }}>Obrigado!</p>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>Sua avaliação foi enviada. Obrigado por compartilhar sua experiência. 💚</p>
      </div>
    </div>
  )

  return (
    <div style={{ background: 'white', borderRadius: 12, boxShadow: 'var(--shadow-sm)', overflow: 'hidden', display: 'flex', marginBottom: 16 }}>
      <div style={{ width: 6, background: 'var(--primary)', flexShrink: 0 }} />
      <div style={{ padding: '14px 14px 14px 12px', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🙏</div>
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, lineHeight: 1.25 }}>{tit}</h3>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5, margin: '8px 0 12px' }}>{sub}</p>
        <button className="btn btn-primary btn-full" onClick={() => navigate('/avaliacao')}>Responder agora</button>
      </div>
    </div>
  )
}
