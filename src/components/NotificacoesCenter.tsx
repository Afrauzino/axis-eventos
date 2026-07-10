import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import { isAdmin } from '../utils'
import type { Profile } from '../App'

// #6 — Central de notificações do sininho.
// Junta tudo do usuário: escalas, cronograma (ministrante/elenco), equipes, avisos e
// aprovações (admin). "Começa em breve" (≤1h) vira lembrete. O "lido" fica salvo no aparelho.

export type Notif = {
  id: string
  emoji: string
  titulo: string
  sub?: string
  quando?: string | null   // ISO — pra ordenar e calcular "começa em breve"
  rota: string
}

function chaveLidas(userId?: string) { return `notif_lidas_${userId ?? 'anon'}` }
function lerLidas(userId?: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(chaveLidas(userId)) || '[]')) } catch { return new Set() }
}
function salvarLidas(userId: string | undefined, ids: Set<string>) {
  try { localStorage.setItem(chaveLidas(userId), JSON.stringify([...ids])) } catch {}
}

// Monta a lista de notificações do usuário (chamável de fora pra contar não-lidas)
export async function montarNotificacoes(profile: Profile, eventoId: string | null): Promise<Notif[]> {
  const out: Notif[] = []
  const userId = profile.user_id

  // Aprovações pendentes (admin — por cargo OU flag)
  // Id baseado em QUEM está pendente: cada nova inscrição vira uma notificação nova
  // (não fica "lida pra sempre" quando chega gente nova).
  if (isAdmin(profile.user_role) || profile.is_admin) {
    try {
      const { data: pend } = await supabase.from('profiles').select('user_id').eq('role_status', 'pending')
      const ids = (pend ?? []).map((p: any) => p.user_id).filter(Boolean).sort()
      if (ids.length > 0) out.push({ id: 'aprov-' + ids.join('_'), emoji: '🙋', titulo: `${ids.length} pessoa(s) aguardando aprovação`, sub: 'Toque para revisar', rota: '/admin' })
    } catch {}
  }

  if (!eventoId || !userId) return out

  // Meu cadastro no evento
  let personId: string | null = null
  let meuTipo: string | null = null
  try {
    const { data } = await supabase.from('people').select('id,role_type').eq('event_id', eventoId).eq('user_id', userId).maybeSingle()
    personId = data?.id ?? null
    meuTipo = (data as any)?.role_type ?? null
  } catch {}

  // Encontrista (nível mais baixo) NÃO recebe notificações
  if (meuTipo === 'encounterer' && !(isAdmin(profile.user_role) || profile.is_admin)) return out

  // Avisos gerais recentes
  try {
    const { data } = await supabase.from('alerts').select('id,title,priority,created_at').eq('event_id', eventoId).order('created_at', { ascending: false }).limit(5)
    for (const a of data ?? []) {
      const urg = a.priority === 'critico' || a.priority === 'urgente'
      out.push({ id: 'alert-' + a.id, emoji: urg ? '🚨' : '📢', titulo: a.title, sub: 'Aviso', quando: a.created_at, rota: '/alertas' })
    }
  } catch {}

  if (!personId) return out

  // Avisos de liderança direcionados a mim (não lidos)
  try {
    const { data } = await supabase.from('alertas_lideres_dest').select('id,lido').eq('destinatario_id', personId).eq('lido', false)
    const avIds = (data ?? []).map((d: any) => d.id).sort()
    if (avIds.length > 0) out.push({ id: 'lider-avisos-' + avIds.join('_'), emoji: '📨', titulo: `${avIds.length} aviso(s) da liderança`, sub: 'Toque para ver', rota: '/alertas-lideres' })
  } catch {}

  // Minhas escalas
  try {
    const { data } = await supabase.from('escalas').select('id,title,start_time,location,status').eq('event_id', eventoId).eq('person_id', personId).order('start_time')
    for (const e of data ?? []) {
      if (e.status === 'concluido' || e.status === 'cancelado') continue
      out.push({ id: 'escala-' + e.id, emoji: '📋', titulo: `Você está escalado: ${e.title}`, sub: e.location || 'Escala', quando: e.start_time, rota: '/minhas-atividades' })
    }
  } catch {}

  // Equipes que participo
  try {
    const { data: pt } = await supabase.from('people_teams').select('team_id').eq('person_id', personId)
    const ids = (pt ?? []).map((t: any) => t.team_id)
    if (ids.length) {
      const { data: teams } = await supabase.from('teams').select('id,name').in('id', ids)
      for (const t of teams ?? []) out.push({ id: 'equipe-' + t.id, emoji: '👥', titulo: `Você faz parte da equipe ${t.name}`, sub: 'Equipe', rota: '/equipes' })
    }
  } catch {}

  // Cronograma: ministrante / elenco
  try {
    const { data: cron } = await supabase.from('cronograma_eventos')
      .select('id,titulo,hora_inicio,local,ministracao_id,theater_id').eq('event_id', eventoId).order('hora_inicio')
    const minIds = (cron ?? []).filter(c => c.ministracao_id).map(c => c.ministracao_id)
    const teaIds = (cron ?? []).filter(c => c.theater_id).map(c => c.theater_id)
    let minhasMin = new Set<string>(), meusTea = new Set<string>()
    if (minIds.length) { const { data } = await supabase.from('ministrações').select('id').in('id', minIds).eq('ministrante_id', personId); minhasMin = new Set((data ?? []).map((m: any) => m.id)) }
    if (teaIds.length) { const { data } = await supabase.from('teatro_elenco').select('theater_id').in('theater_id', teaIds).eq('person_id', personId); meusTea = new Set((data ?? []).map((t: any) => t.theater_id)) }
    for (const c of cron ?? []) {
      if (c.ministracao_id && minhasMin.has(c.ministracao_id)) out.push({ id: 'cron-min-' + c.id, emoji: '🎤', titulo: `Você é o ministrante: ${c.titulo}`, sub: c.local || 'Ministração', quando: c.hora_inicio, rota: '/minhas-atividades' })
      else if (c.theater_id && meusTea.has(c.theater_id)) out.push({ id: 'cron-tea-' + c.id, emoji: '🎭', titulo: `Você está no teatro: ${c.titulo}`, sub: c.local || 'Teatro', quando: c.hora_inicio, rota: '/minhas-atividades' })
    }
  } catch {}

  // Fui marcado no Mural de Gratidão
  try {
    const { data } = await supabase.from('mural_posts')
      .select('id,autor_nome,texto,created_at')
      .eq('event_id', eventoId)
      .contains('mencionados', [personId])
      .order('created_at', { ascending: false }).limit(10)
    for (const m of data ?? []) {
      out.push({ id: 'mural-' + m.id, emoji: '🙌', titulo: `${m.autor_nome ?? 'Alguém'} marcou você no mural`, sub: (m.texto || '').slice(0, 60), quando: m.created_at, rota: '/?ir=mural' })
    }
  } catch {}

  // Solicitações de alteração de escala (para o LÍDER que criou a escala)
  try {
    const { data } = await supabase.from('escala_solicitacoes')
      .select('id,solicitante_nome,escala_titulo,created_at')
      .eq('event_id', eventoId).eq('lider_user_id', userId).eq('status', 'pendente')
      .order('created_at', { ascending: false }).limit(10)
    for (const s of data ?? []) {
      out.push({ id: 'escsolic-' + s.id, emoji: '✋', titulo: `${s.solicitante_nome ?? 'Alguém'} pediu alteração de escala`, sub: s.escala_titulo || 'Escala', quando: s.created_at, rota: '/escalas' })
    }
  } catch {}

  // Ordena: mais recentes/próximos primeiro (quem tem "quando" vem por data desc; sem data, no fim)
  out.sort((a, b) => (b.quando ?? '').localeCompare(a.quando ?? ''))
  return out
}

// Conta quantas notificações estão NÃO lidas (pro badge do sininho)
export async function contarNaoLidas(profile: Profile, eventoId: string | null): Promise<number> {
  const list = await montarNotificacoes(profile, eventoId)
  const lidas = lerLidas(profile.user_id)
  return list.filter(i => !lidas.has(i.id)).length
}

function chaveNotificados(userId?: string) { return `notif_push_${userId ?? 'anon'}` }

// Conta não lidas E dispara notificação NATIVA do celular para as novas.
// (Funciona com o app aberto/em segundo plano; app 100% fechado exige Web Push.)
export async function sincronizarPushLocal(profile: Profile, eventoId: string | null): Promise<number> {
  const list = await montarNotificacoes(profile, eventoId)
  const lidas = lerLidas(profile.user_id)
  const naoLidas = list.filter(i => !lidas.has(i.id))

  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      let salvos: string[] | null = null
      try { const raw = localStorage.getItem(chaveNotificados(profile.user_id)); salvos = raw ? JSON.parse(raw) : null } catch {}
      const primeira = salvos === null            // 1ª vez: não dispara (evita enxurrada), só semeia
      const set = new Set<string>(salvos ?? [])
      const novos = primeira ? [] : naoLidas.filter(i => !set.has(i.id))
      for (const n of novos.slice(0, 3)) {         // no máx 3 por ciclo
        try { new Notification(`${n.emoji} ${n.titulo}`, { body: n.sub || '', tag: n.id, icon: '/axis-192.png', badge: '/axis-192.png' }) } catch {}
        set.add(n.id)
      }
      naoLidas.forEach(i => set.add(i.id))          // marca as atuais como já "vistas" p/ não repetir
      const relevantes = new Set(list.map(i => i.id))
      const persistir = [...set].filter(id => relevantes.has(id)).slice(-100)
      try { localStorage.setItem(chaveNotificados(profile.user_id), JSON.stringify(persistir)) } catch {}
    }
  } catch {}

  return naoLidas.length
}

// "Começa em X" pros próximos 60 min
function lembrete(quando?: string | null): string | null {
  if (!quando) return null
  const diff = new Date(quando).getTime() - Date.now()
  if (diff < 0 || diff > 60 * 60000) return null
  const min = Math.round(diff / 60000)
  return min <= 1 ? 'Começa agora' : `Começa em ${min} min`
}

export default function NotificacoesCenter({ profile, onClose, onUnread }: { profile: Profile; onClose: () => void; onUnread?: (n: number) => void }) {
  useVoltarFecha(true, onClose)  // voltar do celular fecha as notificações
  const navigate = useNavigate()
  const { evento } = useEvento()
  const [itens, setItens] = useState<Notif[]>([])
  const [lidas, setLidas] = useState<Set<string>>(() => lerLidas(profile.user_id))
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    let ativo = true
    montarNotificacoes(profile, evento?.id ?? null).then(list => { if (ativo) { setItens(list); setCarregado(true) } })
    return () => { ativo = false }
  }, [profile, evento?.id])

  useEffect(() => { onUnread?.(itens.filter(i => !lidas.has(i.id)).length) }, [itens, lidas])

  function abrir(n: Notif) {
    const novo = new Set(lidas); novo.add(n.id); setLidas(novo); salvarLidas(profile.user_id, novo)
    onClose(); navigate(n.rota)
  }
  function marcarTodas() {
    const novo = new Set(lidas); itens.forEach(i => novo.add(i.id)); setLidas(novo); salvarLidas(profile.user_id, novo)
  }

  // Depois de lida, a notificação SAI da lista (não fica mais aparecendo no sininho)
  const visiveis = itens.filter(i => !lidas.has(i.id))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: '20px 20px 0 0', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <p style={{ fontSize: 17, fontWeight: 800 }}>Notificações</p>
          {visiveis.length > 0 && <button onClick={marcarTodas} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Marcar todas como lidas</button>}
        </div>

        <div style={{ padding: '8px 16px 28px' }}>
          {!carregado ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '24px 0' }}>Carregando...</p>
          ) : visiveis.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p style={{ fontSize: 34, marginBottom: 8 }}>🔕</p>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>Nenhuma notificação por enquanto.</p>
            </div>
          ) : visiveis.map(n => {
            const naoLida = true
            const lb = lembrete(n.quando)
            return (
              <button key={n.id} onClick={() => abrir(n)}
                style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 10px', borderBottom: '1px solid var(--border)', background: naoLida ? 'var(--primary-light)' : 'white', border: 'none', borderRadius: 10, marginBottom: 4, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1.2 }}>{n.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: naoLida ? 700 : 600, color: 'var(--text)' }}>{n.titulo}</p>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                    {n.sub && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{n.sub}</span>}
                    {lb && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '1px 7px', borderRadius: 99 }}>⏰ {lb}</span>}
                  </div>
                </div>
                {naoLida && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 4 }} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
