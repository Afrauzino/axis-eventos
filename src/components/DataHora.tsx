import { useState } from 'react'
import { useVoltarFecha } from '../hooks/useVoltarFecha'

// DataHora — calendário/hora próprio no padrão AXIS (item 6 do manual).
// Substitui os inputs nativos type="date" | "time" | "datetime-local".
// Mantém o MESMO formato de valor dos inputs nativos (pra não mexer no resto):
//   - modo 'date'     → 'YYYY-MM-DD'
//   - modo 'time'     → 'HH:MM'
//   - modo 'datetime' → 'YYYY-MM-DDTHH:MM'
export type ModoDataHora = 'date' | 'time' | 'datetime'

type Props = {
  value: string
  onChange: (v: string) => void
  modo?: ModoDataHora
  disabled?: boolean
  placeholder?: string
  titulo?: string
  min?: string   // 'YYYY-MM-DD' — trava dias ANTES (ex.: início do evento)
  max?: string   // 'YYYY-MM-DD' — trava dias DEPOIS (ex.: fim do evento)
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEM = ['D','S','T','Q','Q','S','S']
const pad = (n: number) => String(n).padStart(2, '0')

type Partes = { y: number; m: number; d: number; h: number; min: number }

function parse(value: string, modo: ModoDataHora): Partes {
  const p: Partes = { y: NaN, m: NaN, d: NaN, h: NaN, min: NaN }
  if (modo === 'time') {
    const mt = /^(\d{1,2}):(\d{2})/.exec(value || '')
    if (mt) { p.h = +mt[1]; p.min = +mt[2] }
  } else {
    const mt = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(value || '')
    if (mt) { p.y = +mt[1]; p.m = +mt[2] - 1; p.d = +mt[3]; if (mt[4] != null) { p.h = +mt[4]; p.min = +mt[5] } }
  }
  return p
}

function formatarValor(p: Partes, modo: ModoDataHora): string {
  if (modo === 'time') {
    if (isNaN(p.h)) return ''
    return `${pad(p.h)}:${pad(isNaN(p.min) ? 0 : p.min)}`
  }
  if (isNaN(p.y) || isNaN(p.m) || isNaN(p.d)) return ''
  const data = `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`
  if (modo === 'date') return data
  return `${data}T${pad(isNaN(p.h) ? 0 : p.h)}:${pad(isNaN(p.min) ? 0 : p.min)}`
}

function rotulo(value: string, modo: ModoDataHora): string {
  const p = parse(value, modo)
  if (modo === 'time') return isNaN(p.h) ? '' : `${pad(p.h)}:${pad(isNaN(p.min) ? 0 : p.min)}`
  if (isNaN(p.y)) return ''
  const dataFmt = `${pad(p.d)}/${pad(p.m + 1)}/${p.y}`
  if (modo === 'date') return dataFmt
  if (isNaN(p.h)) return dataFmt
  return `${dataFmt} ${pad(p.h)}:${pad(isNaN(p.min) ? 0 : p.min)}`
}

export default function DataHora({ value, onChange, modo = 'date', disabled, placeholder, titulo, min, max }: Props) {
  const [aberto, setAberto] = useState(false)
  const [anoAberto, setAnoAberto] = useState(false)
  useVoltarFecha(aberto, () => setAberto(false))  // voltar do celular fecha o calendário
  const [work, setWork] = useState<Partes>(() => parse(value, modo))
  // sem valor, o calendário abre no mês do "min" (quando há trava de início) senão em "hoje"
  const baseView = () => {
    if (min) return { y: +min.slice(0,4), m: +min.slice(5,7) - 1 }
    const hoje = new Date(); return { y: hoje.getFullYear(), m: hoje.getMonth() }
  }
  const dataCel = (y:number,m:number,d:number) => `${y}-${pad(m+1)}-${pad(d)}`
  const foraFaixa = (y:number,m:number,d:number) => { const s = dataCel(y,m,d); return (!!min && s < min) || (!!max && s > max) }
  const [view, setView] = useState<{ y: number; m: number }>(() => {
    const p = parse(value, modo)
    const b = baseView()
    return { y: isNaN(p.y) ? b.y : p.y, m: isNaN(p.m) ? b.m : p.m }
  })

  const usaData = modo === 'date' || modo === 'datetime'
  const usaHora = modo === 'time' || modo === 'datetime'
  const ph = placeholder ?? (modo === 'time' ? 'Escolher hora' : modo === 'date' ? 'Escolher data' : 'Escolher data e hora')
  const tit = titulo ?? (modo === 'time' ? 'Escolher hora' : modo === 'date' ? 'Escolher data' : 'Data e hora')
  const txt = rotulo(value, modo)

  function abrir() {
    if (disabled) return
    const p = parse(value, modo)
    // Se vai usar hora e ainda não tem, começa na hora atual (fica visível)
    if (usaHora && isNaN(p.h)) { const agora = new Date(); p.h = agora.getHours(); p.min = agora.getMinutes() }
    setWork(p)
    const b = baseView()
    setView({ y: isNaN(p.y) ? b.y : p.y, m: isNaN(p.m) ? b.m : p.m })
    setAnoAberto(false)
    setAberto(true)
  }

  function confirmar() {
    onChange(formatarValor(work, modo))
    setAberto(false)
  }
  function limpar() {
    onChange('')
    setAberto(false)
  }

  function mudarMes(delta: number) {
    setView(v => {
      const nm = v.m + delta
      const y = v.y + Math.floor(nm / 12)
      const m = ((nm % 12) + 12) % 12
      return { y, m }
    })
  }

  function escolherDia(dia: number, mesDoDia: number, anoDoDia: number) {
    setWork(w => ({ ...w, y: anoDoDia, m: mesDoDia, d: dia }))
    if (mesDoDia !== view.m) setView({ y: anoDoDia, m: mesDoDia })
  }

  // Grade de 42 células (6 semanas), começando no domingo
  const primeiroDiaSemana = new Date(view.y, view.m, 1).getDay()
  const celulas = Array.from({ length: 42 }, (_, i) => {
    const dt = new Date(view.y, view.m, 1 + (i - primeiroDiaSemana))
    return { d: dt.getDate(), m: dt.getMonth(), y: dt.getFullYear(), outro: dt.getMonth() !== view.m }
  })
  const hoje = new Date()

  return (
    <>
      <button type="button" disabled={disabled} onClick={abrir}
        style={{ width: '100%', border: '1.5px solid var(--primary)', borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'white', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.6 : 1 }}>
        <span style={{ fontSize: 14, color: txt ? 'var(--text)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {txt || ph}
        </span>
        <span className="icon icon-sm" style={{ color: 'var(--primary)', flexShrink: 0 }}>{modo === 'time' ? 'schedule' : 'calendar_month'}</span>
      </button>

      {aberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setAberto(false)}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 16px 20px', maxHeight: '82vh', overflowY: 'auto', maxWidth: 480, width: '100%', margin: '0 auto' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 14px' }} />
            <p style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, padding: '0 4px' }}>{tit}</p>

            {/* CALENDÁRIO */}
            {usaData && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: usaHora ? 14 : 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <button type="button" onClick={() => mudarMes(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontFamily: 'inherit', padding: 4, display: 'flex' }}><span className="icon">chevron_left</span></button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button type="button" onClick={() => setAnoAberto(false)} style={{ fontSize: 14, fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 4px' }}>{MESES[view.m]}</button>
                    {/* Ano vira um botão DESTACADO — óbvio que dá pra tocar e escolher (útil no aniversário) */}
                    <button type="button" onClick={() => setAnoAberto(a => !a)} style={{ fontSize: 14, fontWeight: 800, background: 'var(--primary-light)', color: 'var(--primary-dark)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3 }}>
                      {view.y} <span className="icon icon-sm" style={{ color: 'var(--primary)' }}>{anoAberto ? 'expand_less' : 'expand_more'}</span>
                    </button>
                  </div>
                  <button type="button" onClick={() => mudarMes(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontFamily: 'inherit', padding: 4, display: 'flex' }}><span className="icon">chevron_right</span></button>
                </div>
                {anoAberto ? (
                  <div style={{ maxHeight: 214, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, padding: '2px' }}>
                    {Array.from({ length: (new Date().getFullYear() + 1) - 1920 + 1 }, (_, i) => (new Date().getFullYear() + 1) - i).map(ano => (
                      <button key={ano} type="button" onClick={() => { setView(v => ({ ...v, y: ano })); setAnoAberto(false) }}
                        style={{ padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: ano === view.y ? 800 : 500, background: ano === view.y ? 'var(--primary)' : 'var(--bg)', color: ano === view.y ? 'white' : 'var(--text)' }}>
                        {ano}
                      </button>
                    ))}
                  </div>
                ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, textAlign: 'center' }}>
                  {DIAS_SEM.map((d, i) => <span key={i} style={{ fontSize: 11, color: 'var(--muted-light)', fontWeight: 600, paddingBottom: 2 }}>{d}</span>)}
                  {celulas.map((c, i) => {
                    const sel = c.d === work.d && c.m === work.m && c.y === work.y && !isNaN(work.d)
                    const ehHoje = c.d === hoje.getDate() && c.m === hoje.getMonth() && c.y === hoje.getFullYear()
                    const bloq = foraFaixa(c.y, c.m, c.d)
                    return (
                      <button key={i} type="button" disabled={bloq} onClick={() => !bloq && escolherDia(c.d, c.m, c.y)}
                        style={{ padding: 0, height: 34, borderRadius: '50%', border: 'none', cursor: bloq ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13,
                          fontWeight: sel || ehHoje ? 700 : 500,
                          opacity: bloq ? 0.25 : 1,
                          background: sel ? 'var(--primary)' : 'transparent',
                          color: sel ? 'white' : c.outro ? 'var(--muted-light)' : ehHoje ? 'var(--primary)' : 'var(--text)' }}>
                        {c.d}
                      </button>
                    )
                  })}
                </div>
                )}
              </div>
            )}

            {/* HORA */}
            {usaHora && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>Hora:</span>
                  <div style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', borderRadius: 8, padding: '6px 14px', fontSize: 16, fontWeight: 800 }}>
                    {pad(isNaN(work.h) ? 0 : work.h)} : {pad(isNaN(work.min) ? 0 : work.min)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <ColunaNumeros titulo="Horas" itens={24} passo={1} valor={isNaN(work.h) ? 0 : work.h} onSel={h => setWork(w => ({ ...w, h }))} />
                  <ColunaNumeros titulo="Minutos" itens={60} passo={1} valor={isNaN(work.min) ? 0 : work.min} onSel={min => setWork(w => ({ ...w, min }))} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={limpar}>Limpar</button>
              <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={confirmar}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Coluna rolável de números (horas/minutos), item selecionado na cor do sistema
function ColunaNumeros({ titulo, itens, passo, valor, onSel }: { titulo: string; itens: number; passo: number; valor: number; onSel: (n: number) => void }) {
  const nums = Array.from({ length: Math.ceil(itens / passo) }, (_, i) => i * passo)
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginBottom: 4 }}>{titulo}</p>
      <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: 4 }}>
        {nums.map(n => {
          const sel = n === valor
          return (
            <button key={n} type="button" onClick={() => onSel(n)}
              style={{ width: '100%', padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, marginBottom: 2,
                fontWeight: sel ? 800 : 500, background: sel ? 'var(--primary)' : 'transparent', color: sel ? 'white' : 'var(--text)' }}>
              {String(n).padStart(2, '0')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
