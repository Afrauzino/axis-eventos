import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  tokenDaUrl, usePalcoSync, useTelaAcesa, useFundoEscuro, alternarTelaCheia,
  destravarSom, bipe, useDeteccaoNovos,
} from '../lib/palco'
import MesaCards, { FlashTela, MESA_CSS } from '../components/palco/MesaCards'
import { LinkInvalido, Tela } from '../components/palco/Comum'
import { useMesa, Recentes, type MesaEstado } from '../components/palco/mesa'
import { FundoVivo, vidroBotao, vidroChip, vidroPainel } from '../components/palco/vidro'
import { BotaoInstalar, useManifestPalco } from '../components/palco/Instalar'
import FalarPalco from '../components/palco/FalarPalco'
import ConfigMesa from '../components/palco/ConfigMesa'

// MONITOR DA MESA DE SOM — página pública (/mesa/:token), sem login, pro PC/tablet da mesa.
// Recados do palco em tempo real (quem apertou, o quê, detalhe das etapas, há quanto
// tempo, quantas vezes). Recado novo: clarão na tela na COR do botão + card piscando na
// cor até alguém marcar "Visto". Som de alerta e lembrete a cada 30 s enquanto houver
// recado sem ver.

export default function PalcoMesa() {
  const token = tokenDaUrl()
  const [estado, setEstado] = useState<MesaEstado | null>(null)
  const [carregou, setCarregou] = useState(false)
  const [online, setOnline] = useState(true)
  const [iniciado, setIniciado] = useState(false)     // toque inicial (destrava o som)
  const [som, setSom] = useState(() => { try { return localStorage.getItem('axis_palco_som') !== '0' } catch { return true } })
  const [flashCor, setFlashCor] = useState<string | null>(null)
  const [painel, setPainel] = useState<'falar' | 'config' | null>(null)
  const [agora, setAgora] = useState(Date.now())
  const offsetRef = useRef(0)
  const detectar = useDeteccaoNovos()
  const somRef = useRef(som)
  somRef.current = som

  useTelaAcesa(true)
  useFundoEscuro('#05070d')
  useManifestPalco('mesa', token, estado?.canal.nome)
  useEffect(() => { try { localStorage.setItem('axis_palco_som', som ? '1' : '0') } catch {} }, [som])
  useEffect(() => { const t = setInterval(() => setAgora(Date.now() + offsetRef.current), 1000); return () => clearInterval(t) }, [])

  const puxar = useCallback(async () => {
    if (!token) { setCarregou(true); return }
    const t0 = Date.now()
    const { data, error } = await supabase.rpc('palco_mesa_estado', { p_token: token })
    const t1 = Date.now()
    if (error) { setOnline(false); return }
    setOnline(true)
    const e = (data as MesaEstado) ?? null
    if (e?.agora && t1 - t0 < 3000) offsetRef.current = Date.parse(e.agora) - (t0 + t1) / 2
    if (e) {
      const novo = detectar(e.abertos)
      if (novo) {
        if (somRef.current) bipe(novo.tipo)
        setFlashCor(novo.chamado.cor); window.setTimeout(() => setFlashCor(null), 1700)
        document.title = '🔴 Recado do palco!'
      } else if (!e.abertos.some(c => c.status === 'aberto')) document.title = `Mesa · ${e.canal.nome}`
    }
    setEstado(e)
    setCarregou(true)
  }, [token])

  const avisar = usePalcoSync(puxar, estado?.canal.sinal ?? null, 1500)
  const marcar = useMesa(estado, setEstado, token, avisar, puxar, som)

  // atalhos: Espaço/Enter = resolve o mais antigo · V = marca o mais antigo como visto
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!iniciado || painel || !estado?.abertos.length || ev.repeat) return
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); marcar(estado.abertos[0].id, 'resolvido') }
      else if (ev.key.toLowerCase() === 'v') {
        const a = estado.abertos.find(c => c.status === 'aberto'); if (a) marcar(a.id, 'visto')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [iniciado, painel, estado, marcar])

  if (!carregou) return <Tela><span style={{ color: '#64748b', fontSize: 18 }}>Carregando…</span></Tela>
  if (!token || !estado) return <Tela><LinkInvalido titulo="Monitor não encontrado" /></Tela>

  const hora = new Date(agora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const qtdAbertos = estado.abertos.length

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', color: '#f8fafc', fontFamily: 'inherit' }}>
      <FundoVivo cores={[...new Set(estado.abertos.map(c => c.cor))].concat(['#2B6CB0', '#6B46C1'])} />
      <style>{MESA_CSS}</style>
      <FlashTela cor={flashCor} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', margin: '10px 12px 0', borderRadius: 20, ...vidroPainel(), flexWrap: 'wrap' }}>
        <span title={online ? 'Conectado' : 'Sem conexão'} style={{ width: 12, height: 12, borderRadius: 99, background: online ? '#22c55e' : '#ef4444', boxShadow: online ? '0 0 8px #22c55e' : 'none' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>🎚️ {estado.canal.nome}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Monitor da mesa de som</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 120 }}>
          {estado.pedais.map(p => (
            <span key={p.id} title={p.online ? 'Pedal conectado' : 'Pedal sem contato recente'}
              style={{ fontSize: 12, fontWeight: 700, borderRadius: 99, padding: '3px 10px', background: p.online ? 'rgba(34,197,94,.22)' : 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', color: p.online ? '#bbf7d0' : '#94a3b8' }}>
              {p.online ? '●' : '○'} {p.nome}
            </span>
          ))}
        </div>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 20, fontWeight: 800, color: '#cbd5e1' }}>{hora}</span>
        <button onClick={() => { destravarSom(); setSom(s => !s) }} style={btnTopo}>{som ? '🔔 Som ligado' : '🔕 Sem som'}</button>
        <button onClick={() => setPainel('falar')} style={{ ...btnTopo, ...vidroBotao('#0ea5e9'), color: 'white' }}>📣 Falar com o palco</button>
        <button onClick={() => setPainel('config')} style={btnTopo}>⚙️ Configurar</button>
        <BotaoInstalar />
        <button onClick={alternarTelaCheia} style={btnTopo}>⛶</button>
        {qtdAbertos > 1 && <button onClick={() => marcar(null, 'resolvido')} style={{ ...btnTopo, ...vidroBotao('#16a34a') }}>✓ Resolver todos ({qtdAbertos})</button>}
      </div>

      {!online && <div style={{ background: '#7f1d1d', color: 'white', textAlign: 'center', padding: '6px 10px', fontSize: 14, fontWeight: 700 }}>Sem conexão — os recados podem estar atrasados</div>}

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <MesaCards abertos={estado.abertos} agora={agora} onMarcar={marcar} />
      </div>

      <Recentes recentes={estado.recentes} agora={agora} />

      {painel === 'falar' && (
        <FalarPalco token={token} pedais={estado.pedais} recados={estado.canal.recados_mesa ?? []} avisos={estado.avisos ?? []}
          agora={agora} onEnviado={() => { avisar(); puxar() }} onFechar={() => setPainel(null)} />
      )}
      {painel === 'config' && <ConfigMesa token={token} onFechar={() => { setPainel(null); puxar() }} onMudou={avisar} />}

      {!iniciado && (
        <div onClick={() => { destravarSom(); if (som) bipe('ok'); setIniciado(true) }} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(5,7,13,.72)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 64 }}>🎚️</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8 }}>{estado.canal.nome}</div>
          <div style={{ fontSize: 16, color: '#94a3b8', margin: '8px 0 22px' }}>Toque em qualquer lugar para iniciar o monitor e ativar o som de alerta</div>
          <span style={{ ...vidroBotao('#22c55e'), color: 'white', fontWeight: 900, fontSize: 18, borderRadius: 18, padding: '14px 28px' }}>▶ Iniciar monitor</span>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 18 }}>Atalhos: Espaço = resolve o mais antigo · V = marca como visto</div>
        </div>
      )}
    </div>
  )
}

const btnTopo: React.CSSProperties = vidroChip
