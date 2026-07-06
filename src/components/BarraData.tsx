import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

// Barra de data em formato SEMANA (Dom→Sáb). Rola a semana inteira pro lado.
// Dias do evento (start_date..end_date) ficam habilitados e marcados; os outros travados.

const WD  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

function parseLocal(s: string) {
  const [y, m, d] = s.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d)
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function startOfWeek(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() - x.getDay()); return x }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function soData(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }

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

  // Semanas a renderizar: cobre o(s) mês(es) do evento + a semana de hoje/selecionado.
  const semanas = useMemo(() => {
    let lo: Date, hi: Date
    if (eStart && eEnd) {
      lo = new Date(eStart.getFullYear(), eStart.getMonth(), 1)
      hi = new Date(eEnd.getFullYear(), eEnd.getMonth() + 1, 0)
    } else {
      lo = addDays(hj, -28); hi = addDays(hj, 28)
    }
    if (hj < lo) lo = hj
    if (hj > hi) hi = hj
    const out: Date[] = []
    let w = startOfWeek(lo)
    const fimW = startOfWeek(hi)
    while (w <= fimW) { out.push(w); w = addDays(w, 7) }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, fim])

  const idxDe = (d: Date) => {
    const alvo = startOfWeek(d).getTime()
    const i = semanas.findIndex(w => w.getTime() === alvo)
    return i < 0 ? 0 : i
  }

  const temEvento = !!(eStart && eEnd)
  const ehEvento = (d: Date) => temEvento && soData(d) >= eStart! && soData(d) <= eEnd!
  const habilitado = (d: Date) => !temEvento || ehEvento(d)

  // Dia efetivo: se a seleção cair fora do evento, ancora no evento
  // (hoje se estiver dentro do período; senão o primeiro dia do evento).
  const diaEfetivo = () => {
    if (!temEvento) return value
    const v = soData(value)
    if (v >= eStart! && v <= eEnd!) return value
    if (hj >= eStart! && hj <= eEnd!) return new Date(hj)
    return new Date(eStart!)
  }

  const [semVisivel, setSemVisivel] = useState(() => idxDe(value))

  // Ao montar / trocar de evento: garante seleção válida e abre na semana do evento.
  useLayoutEffect(() => {
    const alvo = diaEfetivo()
    const i = idxDe(alvo)
    setSemVisivel(i)
    const el = scRef.current
    if (el) el.scrollLeft = i * el.clientWidth
    if (!sameDay(alvo, value)) onChange(alvo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanas.length])

  // Quando o dia selecionado muda de semana por fora (ex: botão "Hoje"), rola até ela.
  useEffect(() => {
    const el = scRef.current
    if (!el) return
    const i = idxDe(value)
    if (i !== semVisivel) {
      el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
      setSemVisivel(i)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Atualiza o mês exibido conforme rola.
  useEffect(() => {
    const el = scRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / el.clientWidth)
        setSemVisivel(prev => (prev === i ? prev : i))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  const meioDaSemana = semanas[semVisivel] ? addDays(semanas[semVisivel], 3) : value
  const label = `${MES[meioDaSemana.getMonth()].charAt(0).toUpperCase()}${MES[meioDaSemana.getMonth()].slice(1)} ${meioDaSemana.getFullYear()}`

  return (
    <div style={{ background: 'var(--white)', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: '12px 8px 12px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{label}</span>
        {!habilitado(value) ? null : !sameDay(value, hj) && habilitado(hj) && (
          <button onClick={() => onChange(new Date(hj))}
            style={{ background: 'none', border: 'none', color: cor, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Hoje
          </button>
        )}
      </div>

      <div
        ref={scRef}
        style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        className="barra-data-scroll"
      >
        {semanas.map((wkStart, wi) => (
          <div key={wi} style={{ flex: '0 0 100%', display: 'flex', gap: 4, scrollSnapAlign: 'start', padding: '0 4px' }}>
            {Array.from({ length: 7 }, (_, di) => {
              const d = addDays(wkStart, di)
              const on = habilitado(d)
              const sel = sameDay(d, value)
              const evt = ehEvento(d)
              const today = sameDay(d, hj)
              return (
                <button
                  key={di}
                  disabled={!on}
                  onClick={() => on && onChange(d)}
                  style={{
                    flex: 1, minWidth: 0, border: 'none', fontFamily: 'inherit',
                    background: sel ? cor : 'transparent',
                    borderRadius: 12, padding: '7px 0 6px',
                    cursor: on ? 'pointer' : 'default',
                    opacity: on ? 1 : 0.32,
                    boxShadow: sel ? '0 2px 6px rgba(0,0,0,0.18)' : 'none',
                    position: 'relative',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: sel ? 'rgba(255,255,255,0.85)' : 'var(--muted)' }}>{WD[di]}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2, color: sel ? '#fff' : on ? 'var(--text)' : 'var(--muted)' }}>{d.getDate()}</div>
                  {/* marcador do dia do evento (quando não selecionado) */}
                  {evt && !sel && (
                    <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 16, height: 3, borderRadius: 2, background: cor }} />
                  )}
                  {/* ponto de "hoje" (quando não é o dia do evento marcado nem selecionado) */}
                  {today && !sel && !evt && (
                    <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--muted)' }} />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
