import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  tokenDaUrl, usePalcoSync, useTelaAcesa, useFundoEscuro, destravarSom, bipe, vibrar,
  erroPalco, useDeteccaoNovos, type PalcoBotao, type MeuChamado,
} from '../lib/palco'
import PadPalco from '../components/palco/PadPalco'
import MesaCards, { FlashTela, MESA_CSS } from '../components/palco/MesaCards'
import { useMesa, Recentes, type MesaEstado } from '../components/palco/mesa'
import { Aviso, LinkInvalido, Tela } from '../components/palco/Comum'
import { Brilho, FundoVivo, vidroBotao, vidroChip, vidroPainel } from '../components/palco/vidro'
import { BotaoInstalar, useManifestPalco } from '../components/palco/Instalar'

// LINK DO CELULAR — página pública (/cel/:token), sem login. Um link só com as DUAS
// funções, em abas embaixo: 🎤 PALCO (envia como um dos pedais — a pessoa escolhe
// "quem é você" uma vez e o celular lembra) e 🎚️ MESA (monitor com Visto/Resolvido).
// Recado novo: a aba Mesa ganha contador e o celular vibra; com a aba Mesa aberta,
// também toca o som e a tela pisca na cor do botão.

type CelEstado = MesaEstado & { botoes: PalcoBotao[]; meus: MeuChamado[] }
type Aba = 'palco' | 'mesa'

export default function PalcoCelular() {
  const token = tokenDaUrl()
  const chave = `axis_palco_cel_${token ?? ''}`
  const [estado, setEstado] = useState<CelEstado | null>(null)
  const [carregou, setCarregou] = useState(false)
  const [online, setOnline] = useState(true)
  const [aba, setAba] = useState<Aba>(() => { try { return (localStorage.getItem(chave + '_aba') as Aba) || 'palco' } catch { return 'palco' } })
  const [pedalId, setPedalId] = useState<string | null>(() => { try { return localStorage.getItem(chave + '_pedal') } catch { return null } })
  const [som, setSom] = useState(() => { try { return localStorage.getItem('axis_palco_som') !== '0' } catch { return true } })
  const [flashCor, setFlashCor] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [agora, setAgora] = useState(Date.now())
  const offsetRef = useRef(0)
  const avisoTimer = useRef<number | undefined>(undefined)
  const detectar = useDeteccaoNovos()
  const abaRef = useRef(aba); abaRef.current = aba
  const somRef = useRef(som); somRef.current = som
  const pedalRef = useRef(pedalId); pedalRef.current = pedalId

  useTelaAcesa(true)
  useFundoEscuro('#05070d')
  useManifestPalco('cel', token, estado?.canal.nome)
  useEffect(() => { try { localStorage.setItem(chave + '_aba', aba) } catch {} }, [aba, chave])
  useEffect(() => { try { pedalId ? localStorage.setItem(chave + '_pedal', pedalId) : localStorage.removeItem(chave + '_pedal') } catch {} }, [pedalId, chave])
  useEffect(() => { try { localStorage.setItem('axis_palco_som', som ? '1' : '0') } catch {} }, [som])
  useEffect(() => { const t = setInterval(() => setAgora(Date.now() + offsetRef.current), 1000); return () => clearInterval(t) }, [])

  const puxar = useCallback(async () => {
    if (!token) { setCarregou(true); return }
    const t0 = Date.now()
    const { data, error } = await supabase.rpc('palco_cel_estado', { p_token: token, p_pedal: pedalRef.current })
    const t1 = Date.now()
    if (error) { setOnline(false); return }
    setOnline(true)
    const e = (data as CelEstado) ?? null
    if (e?.agora && t1 - t0 < 3000) offsetRef.current = Date.parse(e.agora) - (t0 + t1) / 2
    if (e) {
      // pedal salvo foi excluído/desativado → pede pra escolher de novo
      if (pedalRef.current && !e.pedais.some(p => p.id === pedalRef.current)) setPedalId(null)
      // alerta só de recado que NÃO fui eu que mandei
      const novo = detectar(e.abertos.filter(c => c.pedal_id !== pedalRef.current))
      if (novo) {
        vibrar([200, 100, 200])
        if (abaRef.current === 'mesa') {
          if (somRef.current) bipe(novo.tipo)
          setFlashCor(novo.chamado.cor); window.setTimeout(() => setFlashCor(null), 1700)
        }
      }
    }
    setEstado(e)
    setCarregou(true)
  }, [token])

  const avisar = usePalcoSync(puxar, estado?.canal.sinal ?? null, 1500)
  const marcar = useMesa(estado, setEstado, token, avisar, puxar, som && aba === 'mesa')
  useEffect(() => { puxar() }, [pedalId])   // trocou de pedal → já traz os "meus"

  function mostrarAviso(txt: string) {
    setAviso(txt)
    window.clearTimeout(avisoTimer.current)
    avisoTimer.current = window.setTimeout(() => setAviso(null), 3500)
  }

  const enviar = useCallback(async (posicao: number, escolhas: string[]) => {
    if (!token || !pedalId) return false
    const { data, error } = await supabase.rpc('palco_cel_enviar', { p_token: token, p_pedal: pedalId, p_posicao: posicao, p_escolhas: escolhas })
    if (error) { mostrarAviso(erroPalco(error.message)); vibrar([80, 60, 80]); puxar(); return false }
    const r = data as { id: string; status: MeuChamado['status']; repeticoes: number; ignorado: boolean }
    setEstado(e => e && ({ ...e, meus: [...e.meus.filter(c => c.id !== r.id), { id: r.id, posicao, status: r.status, repeticoes: r.repeticoes, detalhe: escolhas.join(' · ') }] }))
    if (!r.ignorado) avisar()
    return true
  }, [token, pedalId, avisar, puxar])

  const cancelar = useCallback(async (c: MeuChamado) => {
    if (!token) return
    setEstado(e => e && ({ ...e, meus: e.meus.filter(x => x.id !== c.id) }))
    const { error } = await supabase.rpc('palco_cel_cancelar', { p_token: token, p_chamado: c.id })
    if (error) { mostrarAviso('Não foi possível cancelar.'); puxar(); return }
    avisar()
  }, [token, avisar, puxar])

  if (!carregou) return <Tela><span style={{ color: '#64748b', fontSize: 18 }}>Carregando…</span></Tela>
  if (!token || !estado) return <Tela><LinkInvalido titulo="Link do celular não encontrado" /></Tela>

  const pedal = estado.pedais.find(p => p.id === pedalId) ?? null
  const naoVistos = estado.abertos.filter(c => c.status === 'aberto').length

  return (
    <div onPointerDown={() => destravarSom()}
      style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', color: '#f8fafc', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}>
      <style>{MESA_CSS}</style>
      <FlashTela cor={flashCor} />
      <FundoVivo cores={estado.botoes.map(b => b.cor)} />

      {/* topo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', margin: '0 10px', marginTop: 'max(10px, env(safe-area-inset-top))', borderRadius: 20, ...vidroPainel() }}>
        <span style={{ width: 12, height: 12, borderRadius: 99, background: online ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {aba === 'palco' ? `🎤 ${pedal?.nome ?? 'Palco'}` : `🎚️ Mesa`}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{estado.canal.nome}</div>
        </div>
        <BotaoInstalar />
        {aba === 'palco' && pedal && <button onClick={() => setPedalId(null)} style={btnTopo}>Trocar</button>}
        {aba === 'mesa' && <button onClick={() => { destravarSom(); setSom(s => !s) }} style={btnTopo}>{som ? '🔔' : '🔕'}</button>}
        {aba === 'mesa' && estado.abertos.length > 1 && <button onClick={() => marcar(null, 'resolvido')} style={{ ...btnTopo, ...vidroBotao('#16a34a') }}>✓ Todos</button>}
      </div>
      {!online && <div style={{ background: '#7f1d1d', color: 'white', textAlign: 'center', padding: '6px 10px', fontSize: 13, fontWeight: 700 }}>Sem conexão</div>}

      {/* conteúdo */}
      {aba === 'palco' ? (
        pedal ? (
          <PadPalco botoes={estado.botoes} chamados={estado.meus} onEnviar={enviar} onCancelar={cancelar} />
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <p style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Quem é você no palco?</p>
            <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 16 }}>A mesa vai ver este nome nos seus recados. O celular lembra da escolha.</p>
            {estado.pedais.length === 0 && <p style={{ color: '#94a3b8' }}>Nenhum pedal cadastrado neste palco. Peça a quem configura o Palco ↔ Mesa.</p>}
            <div style={{ display: 'grid', gap: 10 }}>
              {estado.pedais.map(p => (
                <button key={p.id} onClick={() => setPedalId(p.id)}
                  style={{ ...vidroPainel(.35), position: 'relative', color: 'white', borderRadius: 20, padding: '18px 16px', fontSize: 20, fontWeight: 800, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Brilho raio={20} />🎤 {p.nome}
                </button>
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            <MesaCards abertos={estado.abertos} agora={agora} onMarcar={marcar} compacto />
          </div>
          <Recentes recentes={estado.recentes} agora={agora} />
        </>
      )}

      {/* abas */}
      <div style={{ display: 'flex', margin: '0 10px', marginBottom: 'max(10px, env(safe-area-inset-bottom))', borderRadius: 24, overflow: 'hidden', ...vidroPainel(.5) }}>
        {([['palco', '🎤', 'Palco'], ['mesa', '🎚️', 'Mesa']] as const).map(([id, em, label]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{ flex: 1, border: 'none', color: aba === id ? '#f8fafc' : '#94a3b8', padding: '10px 0 12px', fontFamily: 'inherit', cursor: 'pointer', position: 'relative',
                     background: aba === id ? 'rgba(255,255,255,.12)' : 'none' }}>
            <div style={{ fontSize: 22 }}>{em}</div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{label}</div>
            {id === 'mesa' && naoVistos > 0 && (
              <span style={{ position: 'absolute', top: 6, left: '50%', marginLeft: 10, minWidth: 22, height: 22, borderRadius: 99, background: '#ef4444', color: 'white', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{naoVistos}</span>
            )}
          </button>
        ))}
      </div>

      {aviso && <Aviso texto={aviso} />}
    </div>
  )
}

const btnTopo: React.CSSProperties = vidroChip
