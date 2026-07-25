import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { carregarCorSalva, COR_PADRAO } from '../lib/tema'
import { getInitials } from '../utils'

// Visualizador de TEMPO — página pública (abre sem login), pra ver no celular/telão.
// Mostra o bloco do cronograma EM ANDAMENTO: foto do ministrante, qual ministração,
// tempo decorrido, quanto falta, barra de progresso com %. Sem botões de controle.
// Espelha a realidade do app EM TEMPO REAL: se pausar / +2 / −2 / reiniciar no
// cronômetro, o número acompanha (poll da RPC tempo_atual a cada 1,2s + relógio local).

type Bloco = {
  id: string
  titulo: string
  tipo?: string | null
  ministrante: string | null
  foto: string | null
  duracao_minutos: number | null
  hora_inicio: string | null
  hora_fim: string | null
  cron_estado: string | null
  cron_iniciado_em: string | null
  cron_ajuste_segundos: number
  cron_decorrido_segundos: number
}

function duracaoBaseSeg(b: Bloco): number {
  if (b.duracao_minutos && b.duracao_minutos > 0) return b.duracao_minutos * 60
  if (b.hora_inicio && b.hora_fim) {
    const diff = Math.round((new Date(b.hora_fim).getTime() - new Date(b.hora_inicio).getTime()) / 1000)
    return diff > 0 ? diff : 0
  }
  return 0
}
function fmt(seg: number): string {
  const s = Math.max(0, Math.floor(seg))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`
}
function tagTipo(t?: string | null): string {
  const x = (t || '').toLowerCase()
  if (x === 'teatro') return '🎭 Teatro'
  if (x === 'ministracao' || x === 'ministração' || x === 'palestra') return '🎤 Ministração'
  if (x === 'refeicao' || x === 'refeição') return '🍽️ Refeição'
  return '📌 Programação'
}

export default function TempoView() {
  const [bloco, setBloco] = useState<Bloco | null>(null)
  const [carregou, setCarregou] = useState(false)
  const [agora, setAgora] = useState(Date.now())
  const [accent, setAccent] = useState(COR_PADRAO)
  const vivoRef = useRef(true)
  // auto-ajuste do contador: mede a largura e cresce/encolhe pra caber sempre
  const numRef = useRef<HTMLDivElement>(null)
  const [numFs, setNumFs] = useState(150)
  const avancouRef = useRef<string | null>(null)   // trava: só dispara o "avançar" 1x por bloco

  // cor do sistema (só pro acento na zona tranquila)
  useEffect(() => { carregarCorSalva().then(c => c && setAccent(c)).catch(() => {}) }, [])

  // fundo escuro imersivo no documento todo (sem barra branca)
  useEffect(() => {
    const b = document.body, h = document.documentElement
    const antesB = b.style.background, antesH = h.style.background
    b.style.background = '#0a0e17'; h.style.background = '#0a0e17'
    return () => { b.style.background = antesB; h.style.background = antesH }
  }, [])

  // poll da RPC (1,2s) — pega iniciar/pausar/±/encerrar/trocar de bloco
  useEffect(() => {
    vivoRef.current = true
    const puxar = async () => {
      const { data } = await supabase.rpc('tempo_atual')
      if (!vivoRef.current) return
      setBloco((data as any) ?? null)
      setCarregou(true)
      setAgora(Date.now())
    }
    puxar()
    const t = setInterval(puxar, 1200)
    return () => { vivoRef.current = false; clearInterval(t) }
  }, [])

  // relógio local (250ms) — só corre quando está 'correndo'
  useEffect(() => {
    if (bloco?.cron_estado !== 'correndo') return
    const t = setInterval(() => setAgora(Date.now()), 250)
    return () => clearInterval(t)
  }, [bloco?.cron_estado, bloco?.id])

  // AUTO-AVANÇAR: quando o tempo do bloco zera, conclui e inicia o próximo (via RPC
  // guardada). Dispara 1x por bloco; o poll (1,2s) já traz o próximo. É o gatilho
  // imediato — o pg_cron (1min) é só reforço caso nenhuma tela esteja aberta.
  useEffect(() => {
    if (!bloco || bloco.cron_estado !== 'correndo') return
    const tot = duracaoBaseSeg(bloco) + (bloco.cron_ajuste_segundos ?? 0)
    let dec = bloco.cron_decorrido_segundos ?? 0
    if (bloco.cron_iniciado_em) dec += Math.max(0, Math.floor((agora - new Date(bloco.cron_iniciado_em).getTime()) / 1000))
    if (tot > 0 && dec >= tot && avancouRef.current !== bloco.id) {
      avancouRef.current = bloco.id
      ;(async () => { try { await supabase.rpc('avancar_bloco', { p_id: bloco.id }) } catch {} })()
    }
  }, [agora, bloco?.id, bloco?.cron_estado, bloco?.cron_iniciado_em, bloco?.cron_ajuste_segundos, bloco?.cron_decorrido_segundos])

  // AUTO-AJUSTE do contador: a cada render mede a largura do número e reescala a fonte
  // pra ocupar ~94% da largura disponível. Pouca escrita (mm:ss) → fonte grande;
  // muita escrita (hh:mm:ss) → menor. Converge num passo (fonte escala linear) e o
  // guard (>0,6px) evita loop. Como usa dígitos tabulares, só remede quando o
  // tamanho do texto muda (vira/sai da hora) ou a janela muda.
  useLayoutEffect(() => {
    const el = numRef.current, parent = el?.parentElement
    if (!el || !parent) return
    const avail = parent.clientWidth
    const w = el.scrollWidth
    if (avail <= 0 || w <= 0) return
    // BANDA MORTA: só reajusta se está estourando (>98%) ou sobrando muito (<80%);
    // mira ~90% da largura. Sem isso, o arredondamento oscilava 1px pra sempre e
    // derrubava a tela (React #185 "max update depth").
    if (w > avail * 0.98 || w < avail * 0.80) {
      setNumFs(n => Math.min(240, Math.max(38, (n * avail * 0.90) / w)))
    }
  })

  const rodando = bloco?.cron_estado === 'correndo'
  const total = bloco ? duracaoBaseSeg(bloco) + (bloco.cron_ajuste_segundos ?? 0) : 0
  let decorrido = bloco?.cron_decorrido_segundos ?? 0
  if (bloco && rodando && bloco.cron_iniciado_em) {
    decorrido += Math.max(0, Math.floor((agora - new Date(bloco.cron_iniciado_em).getTime()) / 1000))
  }
  const restante = Math.max(0, total - decorrido)
  const pct = total > 0 ? Math.min(100, Math.round((decorrido / total) * 100)) : 0
  const zerou = decorrido > 0 && restante <= 0
  // previsão de término em HORA DE RELÓGIO (agora + o que falta). Rodando fica fixa;
  // pausado, empurra pra frente (se retomar agora, acaba a essa hora).
  const fimDate = new Date(agora + restante * 1000)
  const fimHora = `${String(fimDate.getHours()).padStart(2, '0')}:${String(fimDate.getMinutes()).padStart(2, '0')}`

  // cor por urgência
  let cor = accent
  if (pct >= 90) cor = '#EF4444'
  else if (pct >= 80) cor = '#F59E0B'
  if (zerou) cor = '#EF4444'

  const wrap: React.CSSProperties = {
    position: 'fixed', inset: 0, background: `radial-gradient(120% 90% at 50% 0%, ${cor}22 0%, rgba(10,14,23,0) 55%), #0a0e17`,
    color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: 'max(24px, env(safe-area-inset-top)) 22px max(24px, env(safe-area-inset-bottom))',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', textAlign: 'center', overflow: 'hidden',
  }

  // ---------- Nada rodando ----------
  if (carregou && !bloco) {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 60, opacity: 0.5 }}>⏱️</div>
        <p style={{ fontSize: 20, fontWeight: 700, marginTop: 14, opacity: 0.85 }}>Nenhuma ministração em andamento</p>
        <p style={{ fontSize: 14, marginTop: 8, color: 'rgba(255,255,255,0.5)' }}>Assim que começar, aparece aqui automaticamente.</p>
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'tvpulse 1.6s infinite' }} />
          Ao vivo · atualiza sozinho
        </div>
        <style>{keyframes}</style>
      </div>
    )
  }

  // ---------- Carregando ----------
  if (!bloco) {
    return <div style={wrap}><div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#fff', animation: 'tvspin 0.8s linear infinite' }} /><style>{keyframes}</style></div>
  }

  return (
    <div style={wrap}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* status: AO VIVO ou PAUSADO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 99, background: rodando ? `${cor}22` : 'rgba(255,255,255,0.08)', border: `1px solid ${rodando ? cor : 'rgba(255,255,255,0.2)'}` }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: rodando ? cor : 'rgba(255,255,255,0.6)', animation: rodando ? 'tvpulse 1.3s infinite' : 'none' }} />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: rodando ? cor : 'rgba(255,255,255,0.75)' }}>
            {zerou ? 'TEMPO ESGOTADO' : rodando ? 'AO VIVO' : 'PAUSADO'}
          </span>
        </div>

        {/* foto do ministrante */}
        <div style={{ width: 132, height: 132, borderRadius: '50%', marginTop: 24, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `3px solid ${cor}`, boxShadow: `0 0 0 8px ${cor}18, 0 14px 40px rgba(0,0,0,0.5)` }}>
          {bloco.foto
            ? <img src={bloco.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 44, fontWeight: 800, color: cor }}>{getInitials(bloco.ministrante ?? bloco.titulo ?? '?')}</span>}
        </div>

        {/* ministrante + tag */}
        {bloco.ministrante && <p style={{ fontSize: 22, fontWeight: 800, marginTop: 18 }}>{bloco.ministrante}</p>}
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginTop: 6, letterSpacing: '0.06em' }}>{tagTipo(bloco.tipo)}</div>

        {/* qual ministração */}
        <p style={{ fontSize: 19, fontWeight: 700, marginTop: 12, color: cor, lineHeight: 1.25 }}>{bloco.titulo}</p>

        {/* tempo restante GIGANTE */}
        <div style={{ marginTop: 26, fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)' }}>QUANTO FALTA</div>
        <div ref={numRef} style={{ fontSize: numFs, fontWeight: 800, lineHeight: 1, color: cor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textShadow: `0 6px 40px ${cor}55`, animation: zerou ? 'tvblink 1s infinite' : 'none' }}>{fmt(restante)}</div>

        {/* previsão de término (hora do relógio) */}
        {!zerou && (
          <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 99, background: `${cor}18`, border: `1px solid ${cor}55` }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>🕐 Termina às</span>
            <b style={{ fontSize: 20, fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums' }}>{fimHora}</b>
          </div>
        )}

        {/* decorrido (tempo que já passou) */}
        <div style={{ marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
          <span>Decorrido <b style={{ color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{fmt(decorrido)}</b></span>
        </div>

        {/* barra + % */}
        <div style={{ width: '100%', marginTop: 22, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 99, transition: 'width 0.4s linear', boxShadow: `0 0 16px ${cor}88` }} />
          </div>
          <span style={{ fontSize: 22, fontWeight: 800, color: cor, minWidth: 62, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
        </div>
      </div>
      <style>{keyframes}</style>
    </div>
  )
}

const keyframes = `
@keyframes tvpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.85)} }
@keyframes tvspin { to { transform: rotate(360deg) } }
@keyframes tvblink { 0%,100%{opacity:1} 50%{opacity:.4} }
`
