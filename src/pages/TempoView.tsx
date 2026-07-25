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
  foto_png: string | null
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
  // auto-ajuste da TELA INTEIRA: o conteúdo tem tamanho fixo (design) e o "palco"
  // é escalado pra caber/encher a tela — cada item junto, sem perder o design.
  const stageRef = useRef<HTMLDivElement>(null)
  const [fitStage, setFitStage] = useState(1)
  const [, setResizeTick] = useState(0)

  // cor do sistema (só pro acento na zona tranquila)
  useEffect(() => { carregarCorSalva().then(c => c && setAccent(c)).catch(() => {}) }, [])

  // fundo escuro imersivo no documento todo (sem barra branca)
  useEffect(() => {
    const b = document.body, h = document.documentElement
    const antesB = b.style.background, antesH = h.style.background
    b.style.background = '#0a0e17'; h.style.background = '#0a0e17'
    return () => { b.style.background = antesB; h.style.background = antesH }
  }, [])

  // poll da RPC (1s) — pega iniciar/pausar/±/encerrar/trocar de bloco.
  // O navegador CONGELA o setInterval quando a aba/tela sai de foco (por isso antes
  // só atualizava ao recarregar). Então re-buscamos NA HORA ao voltar o foco/visibilidade.
  useEffect(() => {
    vivoRef.current = true
    const puxar = async () => {
      try {
        const { data } = await supabase.rpc('tempo_atual')
        if (!vivoRef.current) return
        setBloco((data as any) ?? null)
        setCarregou(true)
        setAgora(Date.now())
      } catch {}
    }
    puxar()
    const t = setInterval(puxar, 1000)
    const aoVoltar = () => { if (document.visibilityState === 'visible') puxar() }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', puxar)
    window.addEventListener('pageshow', puxar)
    window.addEventListener('online', puxar)
    return () => {
      vivoRef.current = false; clearInterval(t)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', puxar)
      window.removeEventListener('pageshow', puxar)
      window.removeEventListener('online', puxar)
    }
  }, [])

  // relógio local (250ms) — só corre quando está 'correndo'
  useEffect(() => {
    if (bloco?.cron_estado !== 'correndo') return
    const t = setInterval(() => setAgora(Date.now()), 250)
    return () => clearInterval(t)
  }, [bloco?.cron_estado, bloco?.id])

  // AUTO-AJUSTE da tela inteira: mede o tamanho NATURAL do palco (independe do scale
  // aplicado — transform não muda o layout) e calcula o fator pra caber na tela.
  // Como a medida não depende do fitStage, NÃO entra em loop (ao contrário do #185).
  useLayoutEffect(() => {
    const el = stageRef.current, parent = el?.parentElement
    if (!el || !parent) return
    const availW = parent.clientWidth, availH = parent.clientHeight
    const w = el.scrollWidth, h = el.scrollHeight
    if (w <= 0 || h <= 0 || availW <= 0 || availH <= 0) return
    const f = Math.min(3.2, Math.max(0.2, Math.min(availW / w, availH / h) * 0.98))
    setFitStage(prev => Math.abs(prev - f) > 0.008 ? f : prev)
  })
  // recalcula na hora ao girar/redimensionar
  useEffect(() => {
    const onR = () => setResizeTick(t => t + 1)
    window.addEventListener('resize', onR)
    window.addEventListener('orientationchange', onR)
    return () => { window.removeEventListener('resize', onR); window.removeEventListener('orientationchange', onR) }
  }, [])

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

  const numFont = restante >= 3600 ? 108 : 150   // hh:mm:ss menor / mm:ss maior (cabe no palco de 540)

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
      <div ref={stageRef} style={{ width: 540, flexShrink: 0, transform: `scale(${fitStage})`, transformOrigin: 'center center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* status: AO VIVO ou PAUSADO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 99, background: rodando ? `${cor}22` : 'rgba(255,255,255,0.08)', border: `1px solid ${rodando ? cor : 'rgba(255,255,255,0.2)'}` }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: rodando ? cor : 'rgba(255,255,255,0.6)', animation: rodando ? 'tvpulse 1.3s infinite' : 'none' }} />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: rodando ? cor : 'rgba(255,255,255,0.75)' }}>
            {zerou ? 'TEMPO ESGOTADO' : rodando ? 'AO VIVO' : 'PAUSADO'}
          </span>
        </div>

        {/* PNG do pôster (mesma figura do cronograma) — senão, foto redonda/iniciais */}
        {bloco.foto_png ? (
          <img src={bloco.foto_png} alt="" style={{ height: 300, maxWidth: 480, objectFit: 'contain', objectPosition: 'bottom center', marginTop: 10, filter: 'drop-shadow(0 16px 34px rgba(0,0,0,0.6))' }} />
        ) : (
          <div style={{ width: 132, height: 132, borderRadius: '50%', marginTop: 24, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `3px solid ${cor}`, boxShadow: `0 0 0 8px ${cor}18, 0 14px 40px rgba(0,0,0,0.5)` }}>
            {bloco.foto
              ? <img src={bloco.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 44, fontWeight: 800, color: cor }}>{getInitials(bloco.ministrante ?? bloco.titulo ?? '?')}</span>}
          </div>
        )}

        {/* ministrante + tag */}
        {bloco.ministrante && <p style={{ fontSize: 22, fontWeight: 800, marginTop: 18 }}>{bloco.ministrante}</p>}
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginTop: 6, letterSpacing: '0.06em' }}>{tagTipo(bloco.tipo)}</div>

        {/* qual ministração */}
        <p style={{ fontSize: 19, fontWeight: 700, marginTop: 12, color: cor, lineHeight: 1.25 }}>{bloco.titulo}</p>

        {/* tempo restante GIGANTE */}
        <div style={{ marginTop: 26, fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)' }}>QUANTO FALTA</div>
        <div style={{ fontSize: numFont, fontWeight: 800, lineHeight: 1, color: cor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textShadow: `0 6px 40px ${cor}55`, animation: zerou ? 'tvblink 1s infinite' : 'none' }}>{fmt(restante)}</div>

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
