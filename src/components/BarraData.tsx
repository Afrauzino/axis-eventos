import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

// Barra de data — fita contínua de dias (7 visíveis), rola pro lado.
// Abre com o EVENTO centralizado. Dias do evento (start_date..end_date) ficam
// habilitados e marcados; os outros aparecem apagados e travados.

const WD  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

function parseLocal(s: string) {
  const [y, m, d] = s.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d)
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function soData(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function diffDias(a: Date, b: Date) { return Math.round((soData(a).getTime() - soData(b).getTime()) / 86400000) }

type Props = {
  value: Date
  onChange: (d: Date) => void
  inicio?: string | null   // events.start_date
  fim?: string | null      // events.end_date
  hoje?: Date
  cor?: string
}

export default function BarraData({ value, onChange, inicio, fim, hoje = new Date(), cor = 'var(--primary)' }: Props) {
  const scRef = useRef<HTMLDivElement>(null)
  const eStart = inicio ? soData(parseLocal(inicio)) : null
  const eEnd   = fim ? soData(parseLocal(fim)) : null
  const hj     = soData(hoje)

  const temEvento = !!(eStart && eEnd)
  const ehEvento = (d: Date) => temEvento && soData(d) >= eStart! && soData(d) <= eEnd!
  const habilitado = (d: Date) => !temEvento || ehEvento(d)

  // Intervalo da fita: cobre o(s) mês(es) do evento + a semana de hoje (pra rolar e voltar).
  const primeiroDia = useMemo(() => {
    let lo: Date
    if (eStart && eEnd) lo = new Date(eStart.getFullYear(), eStart.getMonth(), 1)
    else lo = addDays(hj, -28)
    if (hj < lo) lo = hj
    return soData(lo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, fim])

  const totalDias = useMemo(() => {
    let hi: Date
    if (eStart && eEnd) hi = new Date(eEnd.getFullYear(), eEnd.getMonth() + 1, 0)
    else hi = addDays(hj, 28)
    if (hj > hi) hi = hj
    return diffDias(hi, primeiroDia) + 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, fim, primeiroDia])

  const diaDe = (i: number) => addDays(primeiroDia, i)
  const idxDe = (d: Date) => diffDias(d, primeiroDia)

  // Se a seleção cair fora do evento, ancora no evento (hoje se estiver dentro; senão o início).
  const diaEfetivo = () => {
    if (!temEvento) return value
    const v = soData(value)
    if (v >= eStart! && v <= eEnd!) return value
    if (hj >= eStart! && hj <= eEnd!) return new Date(hj)
    return new Date(eStart!)
  }

  // Dia que fica no CENTRO ao abrir: o meio do evento.
  const diaCentro = () => {
    if (temEvento) return addDays(eStart!, Math.floor(diffDias(eEnd!, eStart!) / 2))
    return diaEfetivo()
  }

  const [centro, setCentro] = useState(() => idxDe(value))

  const centralizar = (i: number, suave = false) => {
    const el = scRef.current
    if (!el || el.clientWidth === 0) return false
    const pw = el.clientWidth / 7
    el.scrollTo({ left: Math.max(0, (i - 3) * pw), behavior: suave ? 'smooth' : 'auto' })
    return true
  }

  // Espera a fita ter largura (>0) antes de centralizar — evita ficar no começo.
  const centralizarQuandoPronto = (i: number) => {
    let tentativas = 0
    const tick = () => {
      if (centralizar(i)) return
      if (tentativas++ < 40) requestAnimationFrame(tick)
    }
    tick()
  }

  // Ao montar / trocar de evento: garante seleção válida e centraliza o evento.
  useLayoutEffect(() => {
    const alvo = diaEfetivo()
    if (!sameDay(alvo, value)) onChange(alvo)
    const c = idxDe(diaCentro())
    setCentro(c)
    centralizarQuandoPronto(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDias])

  // Atualiza o mês exibido conforme rola.
  useEffect(() => {
    const el = scRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const pw = el.clientWidth / 7
        const c = Math.round(el.scrollLeft / pw) + 3
        setCentro(prev => (prev === c ? prev : c))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  // Se o dia selecionado sair da faixa visível (ex: botão "Hoje"), rola até centralizá-lo.
  useEffect(() => {
    const el = scRef.current
    if (!el) return
    const pw = el.clientWidth / 7
    const primeiro = el.scrollLeft / pw
    const i = idxDe(value)
    if (i < primeiro + 0.5 || i > primeiro + 6.5) centralizar(i, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const diaLabel = diaDe(Math.min(totalDias - 1, Math.max(0, centro)))
  const label = `${MES[diaLabel.getMonth()].charAt(0).toUpperCase()}${MES[diaLabel.getMonth()].slice(1)} ${diaLabel.getFullYear()}`

  return (
    <div style={{ background: 'var(--white)', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: '12px 6px 12px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{label}</span>
        {!sameDay(value, hj) && habilitado(hj) && (
          <button onClick={() => onChange(new Date(hj))}
            style={{ background: 'none', border: 'none', color: cor, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Hoje
          </button>
        )}
      </div>

      <div
        ref={scRef}
        className="barra-data-scroll"
        style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {Array.from({ length: totalDias }, (_, i) => {
          const d = diaDe(i)
          const on = habilitado(d)
          const sel = sameDay(d, value)
          const evt = ehEvento(d)
          const today = sameDay(d, hj)
          return (
            <button
              key={i}
              disabled={!on}
              onClick={() => on && onChange(d)}
              style={{
                flex: '0 0 calc(100% / 7)', minWidth: 0, border: 'none', fontFamily: 'inherit',
                background: sel ? cor : 'transparent',
                borderRadius: 12, padding: '7px 0 8px',
                cursor: on ? 'pointer' : 'default',
                opacity: on ? 1 : 0.3,
                boxShadow: sel ? '0 2px 6px rgba(0,0,0,0.18)' : 'none',
                position: 'relative',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: sel ? 'rgba(255,255,255,0.85)' : 'var(--muted)' }}>{WD[d.getDay()]}</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2, color: sel ? '#fff' : on ? 'var(--text)' : 'var(--muted)' }}>{d.getDate()}</div>
              {evt && !sel && (
                <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 16, height: 3, borderRadius: 2, background: cor }} />
              )}
              {today && !sel && !evt && (
                <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--muted)' }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
