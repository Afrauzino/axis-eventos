import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getInitials } from '../utils'

// Faixa "AO VIVO" na tela inicial: aparece quando um bloco do cronograma está
// com o cronômetro CORRENDO. Mostra o rosto do ministrante, a ministração, o
// teatro (se houver) e a barra de porcentagem com o tempo em contagem regressiva.
// Visível a todos que abrem a tela inicial. NÃO é clicável (só acompanhar).

type ItemCron = {
  id: string; titulo: string; tipo: string
  hora_inicio: string; hora_fim: string; status?: string
  ministracao_id?: string | null; theater_id?: string | null
  duracao_minutos?: number | null
  cron_iniciado_em?: string | null
  cron_ajuste_segundos?: number | null
  cron_estado?: string | null
  cron_decorrido_segundos?: number | null
}
type Dados = {
  item: ItemCron
  titulo: string
  teatroNome: string | null
  ministranteNome: string | null
  ministranteFoto: string | null
}

function duracaoBaseSeg(item: ItemCron): number {
  if (item.duracao_minutos && item.duracao_minutos > 0) return item.duracao_minutos * 60
  const ini = new Date(item.hora_inicio).getTime()
  const fim = new Date(item.hora_fim).getTime()
  const diff = Math.round((fim - ini) / 1000)
  return diff > 0 ? diff : 0
}
function fmt(seg: number): string {
  const s = Math.max(0, Math.floor(seg))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`
}

export default function CronometroAoVivo({ eventoId }: { eventoId?: string }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [agora, setAgora] = useState(Date.now())

  async function carregar(eid: string) {
    // Bloco com cronômetro correndo (o mais recente, se houver mais de um)
    const { data: rows } = await supabase.from('cronograma_eventos').select('*')
      .eq('event_id', eid).eq('cron_estado', 'correndo')
      .order('cron_iniciado_em', { ascending: false }).limit(1)
    const item = (rows ?? [])[0] as ItemCron | undefined
    if (!item || item.status === 'concluido') { setDados(null); return }

    let titulo = item.titulo
    let ministranteId: string | null = null
    if (item.ministracao_id) {
      const { data: m } = await supabase.from('ministrações')
        .select('titulo,ministrante_id').eq('id', item.ministracao_id).maybeSingle()
      if (m?.titulo) titulo = m.titulo
      ministranteId = m?.ministrante_id ?? null
    }

    // Teatro: direto do item OU vinculado à ministração
    let teatroNome: string | null = null
    if (item.theater_id) {
      const { data: t } = await supabase.from('theaters').select('nome').eq('id', item.theater_id).maybeSingle()
      teatroNome = t?.nome ?? null
    } else if (item.ministracao_id) {
      const { data: t } = await supabase.from('theaters').select('nome').eq('ministracao_id', item.ministracao_id).maybeSingle()
      teatroNome = t?.nome ?? null
    }

    let ministranteNome: string | null = null
    let ministranteFoto: string | null = null
    if (ministranteId) {
      const { data: p } = await supabase.from('people').select('name,photo_url').eq('id', ministranteId).maybeSingle()
      ministranteNome = p?.name ?? null
      ministranteFoto = p?.photo_url ?? null
    }

    setDados({ item, titulo, teatroNome, ministranteNome, ministranteFoto })
  }

  // Carrega + acompanha em tempo real (aparece/some quando ligam/desligam o cronômetro)
  useEffect(() => {
    if (!eventoId) { setDados(null); return }
    carregar(eventoId)
    const canal = supabase
      .channel('crono-aovivo-' + eventoId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cronograma_eventos', filter: `event_id=eq.${eventoId}` },
        () => carregar(eventoId))
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [eventoId])

  // Relógio local (0,5s) só enquanto há bloco rodando
  useEffect(() => {
    if (!dados) return
    const t = setInterval(() => setAgora(Date.now()), 500)
    return () => clearInterval(t)
  }, [dados])

  if (!dados) return null

  const { item } = dados
  const totalSeg = duracaoBaseSeg(item) + (item.cron_ajuste_segundos ?? 0)
  const acumulado = item.cron_decorrido_segundos ?? 0
  let decorrido = acumulado
  if (item.cron_iniciado_em && item.cron_estado === 'correndo') {
    decorrido = acumulado + Math.max(0, Math.floor((agora - new Date(item.cron_iniciado_em).getTime()) / 1000))
  }
  const restante = Math.max(0, totalSeg - decorrido)
  const pct = totalSeg > 0 ? Math.min(100, Math.round((decorrido / totalSeg) * 100)) : 0
  const zerou = decorrido > 0 && restante <= 0

  let cor = 'var(--primary)'
  if (pct >= 95) cor = '#C53030'
  else if (pct >= 90) cor = '#E53E3E'
  else if (pct >= 80) cor = '#ECC94B'
  if (zerou) cor = '#C53030'

  return (
    // pointerEvents:none → apenas acompanhar, não é clicável
    <div style={{
      background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)',
      border: `1.5px solid ${cor}`, overflow: 'hidden', marginBottom: 16,
      pointerEvents: 'none', userSelect: 'none',
    }}>
      {/* Cabeçalho AO VIVO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: cor }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'white', animation: 'pulse 1s infinite' }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: 'white', letterSpacing: '0.08em' }}>AO VIVO · ACONTECENDO AGORA</span>
      </div>

      <div style={{ padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Rosto do ministrante */}
          <div style={{ width: 54, height: 54, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${cor}` }}>
            {dados.ministranteFoto
              ? <img src={dados.ministranteFoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary)' }}>{getInitials(dados.ministranteNome ?? dados.titulo ?? '?')}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dados.titulo}</p>
            {dados.ministranteNome && <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎤 {dados.ministranteNome}</p>}
            {dados.teatroNome && <p style={{ fontSize: 12, color: '#9a5b12', fontWeight: 700, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎭 Teatro: {dados.teatroNome}</p>}
          </div>
        </div>

        {/* Tempo regressivo + barra de porcentagem */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '12px 0 6px' }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>{fmt(restante)}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: cor }}>{pct}%</span>
        </div>
        <div style={{ height: 12, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 99, transition: 'width 0.5s linear' }} />
        </div>
        {zerou && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#E53E3E', animation: 'pulse 1s infinite' }} />
            <span style={{ fontSize: 11, color: '#E53E3E', fontWeight: 800 }}>Tempo esgotado</span>
          </div>
        )}
      </div>
    </div>
  )
}
