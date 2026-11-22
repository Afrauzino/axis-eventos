import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  tokenDaUrl, usePalcoSync, useTelaAcesa, useFundoEscuro, alternarTelaCheia,
  destravarSom, bipe, haQuanto, type PalcoChamado,
} from '../lib/palco'

// MONITOR DA MESA DE SOM — página pública (/mesa/:token), sem login, pro PC/tablet da mesa.
// Mostra em tempo real os recados apertados no palco (quem apertou, o quê, há quanto
// tempo, quantas vezes). O técnico marca "Visto" (o palco vê "MESA VIU") e "Resolvido".
// Som de alerta a cada recado novo/reforçado e lembrete enquanto houver recado sem ver.

type Estado = {
  canal: { id: string; nome: string; sinal: string }
  pedais: { id: string; nome: string; online: boolean }[]
  abertos: PalcoChamado[]
  recentes: PalcoChamado[]
  agora: string
}

const LEMBRETE_MS = 30000

export default function PalcoMesa() {
  const token = tokenDaUrl()
  const [estado, setEstado] = useState<Estado | null>(null)
  const [carregou, setCarregou] = useState(false)
  const [online, setOnline] = useState(true)
  const [iniciado, setIniciado] = useState(false)     // toque inicial (destrava som + tela cheia)
  const [som, setSom] = useState(() => { try { return localStorage.getItem('axis_palco_som') !== '0' } catch { return true } })
  const [alerta, setAlerta] = useState(false)          // pisca a tela num recado novo
  const [agora, setAgora] = useState(Date.now())
  const offsetRef = useRef(0)
  const vistosRef = useRef<Map<string, number> | null>(null)   // id → repeticoes já alertadas
  const somRef = useRef(som)
  somRef.current = som

  useTelaAcesa(true)
  useFundoEscuro('#0b0f17')
  useEffect(() => { try { localStorage.setItem('axis_palco_som', som ? '1' : '0') } catch {} }, [som])
  useEffect(() => { const t = setInterval(() => setAgora(Date.now() + offsetRef.current), 1000); return () => clearInterval(t) }, [])

  const puxar = useCallback(async () => {
    if (!token) { setCarregou(true); return }
    const t0 = Date.now()
    const { data, error } = await supabase.rpc('palco_mesa_estado', { p_token: token })
    const t1 = Date.now()
    if (error) { setOnline(false); return }
    setOnline(true)
    const e = (data as Estado) ?? null
    if (e?.agora && t1 - t0 < 3000) offsetRef.current = Date.parse(e.agora) - (t0 + t1) / 2

    // detecta recado NOVO ou REFORÇADO (repeticoes subiu) → alerta
    if (e) {
      const ant = vistosRef.current
      const novo = new Map(e.abertos.map(c => [c.id, c.repeticoes]))
      if (ant) {
        let tipo: 'novo' | 'reforco' | null = null
        for (const c of e.abertos) {
          const r = ant.get(c.id)
          if (r === undefined) { tipo = 'novo'; break }
          if (c.repeticoes > r) tipo = 'reforco'
        }
        if (tipo) {
          if (somRef.current) bipe(tipo)
          setAlerta(true); window.setTimeout(() => setAlerta(false), 1600)
          document.title = '🔴 Recado do palco!'
        }
      }
      vistosRef.current = novo
      if (!e.abertos.some(c => c.status === 'aberto')) document.title = `Mesa · ${e.canal.nome}`
    }
    setEstado(e)
    setCarregou(true)
  }, [token])

  const avisar = usePalcoSync(puxar, estado?.canal.sinal ?? null, 1500)

  // lembrete sonoro enquanto houver recado que ninguém marcou como visto
  useEffect(() => {
    const t = setInterval(() => {
      if (somRef.current && estado?.abertos.some(c => c.status === 'aberto')) bipe('novo')
    }, LEMBRETE_MS)
    return () => clearInterval(t)
  }, [estado])

  const marcar = useCallback(async (id: string | null, status: 'visto' | 'resolvido') => {
    if (!token) return
    // otimista
    setEstado(e => {
      if (!e) return e
      if (status === 'resolvido') {
        const sai = e.abertos.filter(c => id === null || c.id === id).map(c => ({ ...c, status: 'resolvido' as const, atualizado_em: new Date().toISOString() }))
        return { ...e, abertos: e.abertos.filter(c => !(id === null || c.id === id)), recentes: [...sai, ...e.recentes].slice(0, 15) }
      }
      return { ...e, abertos: e.abertos.map(c => (c.id === id ? { ...c, status: 'visto' } : c)) }
    })
    if (somRef.current && status === 'resolvido') bipe('ok')
    const { error } = await supabase.rpc('palco_mesa_marcar', { p_token: token, p_chamado: id, p_status: status })
    if (error) puxar()
    else avisar()
  }, [token, avisar, puxar])

  // atalhos: Espaço/Enter = resolve o mais antigo · V = marca o mais antigo como visto
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!iniciado || !estado?.abertos.length || ev.repeat) return
      const maisAntigo = estado.abertos[0]
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); marcar(maisAntigo.id, 'resolvido') }
      else if (ev.key.toLowerCase() === 'v') {
        const a = estado.abertos.find(c => c.status === 'aberto'); if (a) marcar(a.id, 'visto')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [iniciado, estado, marcar])

  function iniciar() {
    destravarSom()
    if (som) bipe('ok')
    setIniciado(true)
  }

  if (!carregou) return <Centro><span style={{ color: '#64748b', fontSize: 18 }}>Carregando…</span></Centro>
  if (!token || !estado) return (
    <Centro>
      <div style={{ textAlign: 'center', color: '#e2e8f0', padding: 24, maxWidth: 440 }}>
        <div style={{ fontSize: 54 }}>🔒</div>
        <p style={{ fontSize: 22, fontWeight: 800, margin: '10px 0 6px' }}>Monitor não encontrado</p>
        <p style={{ color: '#94a3b8', fontSize: 15 }}>Este link é inválido, foi trocado ou o palco está desativado. Peça um novo link a quem configura o Palco ↔ Mesa.</p>
      </div>
    </Centro>
  )

  const hora = new Date(agora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const qtdAbertos = estado.abertos.length

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0b0f17', color: '#f8fafc', fontFamily: 'inherit',
                  boxShadow: alerta ? 'inset 0 0 0 10px #ef4444' : 'none', transition: 'box-shadow .2s' }}>
      <style>{`
        @keyframes mesaPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.0) } 50% { box-shadow: 0 0 30px 4px rgba(239,68,68,.55) } }
      `}</style>

      {/* cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #1e293b', flexWrap: 'wrap' }}>
        <span title={online ? 'Conectado' : 'Sem conexão'} style={{ width: 12, height: 12, borderRadius: 99, background: online ? '#22c55e' : '#ef4444', boxShadow: online ? '0 0 8px #22c55e' : 'none' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>🎚️ {estado.canal.nome}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Monitor da mesa de som</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 120 }}>
          {estado.pedais.map(p => (
            <span key={p.id} title={p.online ? 'Pedal conectado' : 'Pedal sem contato recente'}
              style={{ fontSize: 12, fontWeight: 700, borderRadius: 99, padding: '3px 10px', background: p.online ? '#14532d' : '#1e293b', color: p.online ? '#bbf7d0' : '#64748b' }}>
              {p.online ? '●' : '○'} {p.nome}
            </span>
          ))}
        </div>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 20, fontWeight: 800, color: '#cbd5e1' }}>{hora}</span>
        <button onClick={() => { destravarSom(); setSom(s => !s) }} style={btnTopo}>{som ? '🔔 Som ligado' : '🔕 Sem som'}</button>
        <button onClick={alternarTelaCheia} style={btnTopo}>⛶</button>
        {qtdAbertos > 1 && <button onClick={() => marcar(null, 'resolvido')} style={{ ...btnTopo, background: '#166534', color: 'white' }}>✓ Resolver todos ({qtdAbertos})</button>}
      </div>

      {!online && <div style={{ background: '#7f1d1d', color: 'white', textAlign: 'center', padding: '6px 10px', fontSize: 14, fontWeight: 700 }}>Sem conexão — os recados podem estar atrasados</div>}

      {/* recados abertos */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {qtdAbertos === 0 ? (
          <div style={{ height: '100%', minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#475569', textAlign: 'center' }}>
            <div style={{ fontSize: 72 }}>✓</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#64748b' }}>Tudo certo no palco</div>
            <div style={{ fontSize: 14, marginTop: 6 }}>Os recados aparecem aqui assim que alguém apertar um pedal.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 14 }}>
            {estado.abertos.map(c => {
              const naoVisto = c.status === 'aberto'
              return (
                <div key={c.id} style={{
                  borderRadius: 20, overflow: 'hidden', background: '#111827', border: `3px solid ${naoVisto ? '#ef4444' : '#334155'}`,
                  animation: naoVisto ? 'mesaPulse 1.1s ease-in-out infinite' : 'none', display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ background: c.cor, padding: '14px 16px', position: 'relative' }}>
                    <div style={{ fontSize: `clamp(24px, ${Math.floor(290 / (Math.max(4, ...c.nome.split(/\s+/).map(w => w.length)) * 0.62))}px, 52px)`, fontWeight: 900, lineHeight: 1.05, color: 'white', textShadow: '0 2px 6px rgba(0,0,0,.25)', overflowWrap: 'break-word', paddingRight: c.repeticoes > 1 ? 56 : 0 }}>{c.nome}</div>
                    {c.repeticoes > 1 && (
                      <span style={{ position: 'absolute', top: 10, right: 12, background: '#0b0f17', color: '#fbbf24', borderRadius: 99, padding: '4px 10px', fontWeight: 900, fontSize: 18 }}>×{c.repeticoes}</span>
                    )}
                  </div>
                  <div style={{ padding: '12px 16px', flex: 1 }}>
                    {c.mensagem && <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25, marginBottom: 8 }}>{c.mensagem}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: '#cbd5e1', fontSize: 15 }}>
                      <span style={{ fontWeight: 800, background: '#1e293b', borderRadius: 8, padding: '3px 10px' }}>🎤 {c.pedal_nome}</span>
                      <span>{haQuanto(c.criado_em, agora)}</span>
                      {c.repeticoes > 1 && <span style={{ color: '#fbbf24' }}>· último {haQuanto(c.atualizado_em, agora)}</span>}
                      <span style={{ marginLeft: 'auto', fontWeight: 800, color: naoVisto ? '#f87171' : '#38bdf8' }}>{naoVisto ? 'NOVO' : 'VISTO'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, padding: '0 16px 14px' }}>
                    {naoVisto && <button onClick={() => marcar(c.id, 'visto')} style={{ ...btnAcao, background: '#1e3a8a' }}>👀 Visto</button>}
                    <button onClick={() => marcar(c.id, 'resolvido')} style={{ ...btnAcao, background: '#166534', flex: 2 }}>✓ Resolvido</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* histórico curto */}
      {estado.recentes.length > 0 && (
        <div style={{ borderTop: '1px solid #1e293b', padding: '8px 14px', display: 'flex', gap: 8, overflowX: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 800, alignSelf: 'center' }}>RECENTES</span>
          {estado.recentes.map(r => (
            <span key={r.id} style={{ fontSize: 12, borderRadius: 99, padding: '4px 10px', background: '#111827', color: '#94a3b8', border: '1px solid #1e293b' }}>
              <b style={{ color: r.cor }}>■</b> {r.nome} · {r.pedal_nome} · {r.status === 'cancelado' ? 'cancelado pelo palco' : 'resolvido'} {haQuanto(r.atualizado_em, agora)}
            </span>
          ))}
        </div>
      )}

      {/* toque inicial: navegadores só tocam som depois de uma interação */}
      {!iniciado && (
        <div onClick={iniciar} style={{ position: 'fixed', inset: 0, background: 'rgba(11,15,23,.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 64 }}>🎚️</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8 }}>{estado.canal.nome}</div>
          <div style={{ fontSize: 16, color: '#94a3b8', margin: '8px 0 22px' }}>Toque em qualquer lugar para iniciar o monitor e ativar o som de alerta</div>
          <span style={{ background: '#22c55e', color: '#052e16', fontWeight: 900, fontSize: 18, borderRadius: 14, padding: '14px 28px' }}>▶ Iniciar monitor</span>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 18 }}>Atalhos: Espaço = resolve o mais antigo · V = marca como visto</div>
        </div>
      )}
    </div>
  )
}

const btnTopo: React.CSSProperties = { background: '#1e293b', color: '#e2e8f0', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const btnAcao: React.CSSProperties = { flex: 1, border: 'none', borderRadius: 12, padding: '14px 10px', fontSize: 18, fontWeight: 900, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }

function Centro({ children }: { children: React.ReactNode }) {
  useFundoEscuro('#0b0f17')
  return <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0f17' }}>{children}</div>
}
