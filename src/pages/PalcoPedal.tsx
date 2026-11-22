import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  tokenDaUrl, usePalcoSync, useTelaAcesa, useFundoEscuro, alternarTelaCheia,
  vibrar, posicaoDaTecla, type PalcoBotao,
} from '../lib/palco'

// PEDAL DO PALCO — página pública (/ped/:token), sem login, pro tablet/celular no palco.
// 6 botões grandes (configurados em /palco). Tocar (ou apertar a tecla 1–6 / A–F de um
// pedal USB/Bluetooth) envia o recado pra mesa de som. O botão mostra o retorno da mesa:
// ENVIADO → MESA VIU → RESOLVIDO. Tocar de novo REFORÇA (a mesa alerta outra vez).

type MeuChamado = { id: string; posicao: number; status: 'aberto' | 'visto' | 'resolvido'; repeticoes: number }
type Estado = {
  pedal: { id: string; nome: string }
  canal: { nome: string; sinal: string }
  botoes: PalcoBotao[]
  chamados: MeuChamado[]
}

const ERROS: Record<string, string> = {
  pedal_invalido: 'Este link do pedal não vale mais. Peça um novo ao responsável.',
  botao_inativo: 'Este botão foi desativado.',
  limite_apertos: 'Muitos apertos seguidos. Aguarde alguns segundos.',
}

export default function PalcoPedal() {
  const token = tokenDaUrl()
  const [estado, setEstado] = useState<Estado | null>(null)
  const [carregou, setCarregou] = useState(false)
  const [online, setOnline] = useState(true)
  const [enviando, setEnviando] = useState<number | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [flash, setFlash] = useState<number | null>(null)
  const avisoTimer = useRef<number | undefined>(undefined)
  const [paisagem, setPaisagem] = useState(() => window.innerWidth > window.innerHeight)

  useTelaAcesa(true)
  useFundoEscuro('#0b0f17')
  useEffect(() => {
    const f = () => setPaisagem(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  useEffect(() => { document.title = estado ? `Pedal · ${estado.pedal.nome}` : 'Pedal do palco' }, [estado?.pedal.nome])

  const puxar = useCallback(async () => {
    if (!token) { setCarregou(true); return }
    const { data, error } = await supabase.rpc('palco_pedal_estado', { p_token: token })
    if (error) { setOnline(false); return }
    setOnline(true)
    setEstado((data as Estado) ?? null)
    setCarregou(true)
  }, [token])

  const avisar = usePalcoSync(puxar, estado?.canal.sinal ?? null, 2000)

  function mostrarAviso(txt: string) {
    setAviso(txt)
    window.clearTimeout(avisoTimer.current)
    avisoTimer.current = window.setTimeout(() => setAviso(null), 3500)
  }

  const enviar = useCallback(async (posicao: number) => {
    if (!token || !estado) return
    if (!estado.botoes.some(b => b.posicao === posicao)) return
    setEnviando(posicao); setFlash(posicao); vibrar(60)
    window.setTimeout(() => setFlash(f => (f === posicao ? null : f)), 350)
    const { data, error } = await supabase.rpc('palco_enviar', { p_token: token, p_posicao: posicao })
    setEnviando(null)
    if (error) {
      const chave = Object.keys(ERROS).find(k => error.message?.includes(k))
      mostrarAviso(chave ? ERROS[chave] : navigator.onLine ? 'Não foi enviado. Toque de novo.' : 'Sem internet — não foi enviado.')
      vibrar([80, 60, 80])
      if (chave === 'pedal_invalido') puxar()
      return
    }
    const r = data as { id: string; status: MeuChamado['status']; repeticoes: number; ignorado: boolean }
    // otimista: já mostra "enviado" sem esperar o próximo poll
    setEstado(e => e && ({
      ...e,
      chamados: [...e.chamados.filter(c => c.id !== r.id && c.posicao !== posicao),
                 { id: r.id, posicao, status: r.status, repeticoes: r.repeticoes }],
    }))
    if (!r.ignorado) avisar()
  }, [token, estado, avisar, puxar])

  async function cancelar(c: MeuChamado) {
    if (!token) return
    setEstado(e => e && ({ ...e, chamados: e.chamados.filter(x => x.id !== c.id) }))
    const { error } = await supabase.rpc('palco_cancelar', { p_token: token, p_chamado: c.id })
    if (error) { mostrarAviso('Não foi possível cancelar.'); puxar(); return }
    avisar()
  }

  // Pedal físico (teclado/USB/Bluetooth): 1–6 ou A–F. Ignora auto-repetição da tecla presa.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const p = posicaoDaTecla(e)
      if (p) { e.preventDefault(); enviar(p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enviar])

  if (!carregou) return <Tela><div style={{ color: '#64748b', fontSize: 18 }}>Carregando…</div></Tela>
  if (!token || !estado) return (
    <Tela>
      <div style={{ textAlign: 'center', color: '#e2e8f0', padding: 24, maxWidth: 420 }}>
        <div style={{ fontSize: 54 }}>🔒</div>
        <p style={{ fontSize: 22, fontWeight: 800, margin: '10px 0 6px' }}>Pedal não encontrado</p>
        <p style={{ color: '#94a3b8', fontSize: 15 }}>Este link é inválido, foi trocado ou o palco está desativado. Peça um novo link a quem configura o Palco ↔ Mesa.</p>
      </div>
    </Tela>
  )

  const porPos = new Map(estado.chamados.map(c => [c.posicao, c]))
  const n = estado.botoes.length
  const cols = paisagem ? Math.min(3, Math.max(1, Math.ceil(n / 2))) : (n <= 3 ? 1 : 2)

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0b0f17', color: '#f8fafc', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}>
      <style>{`
        @keyframes palcoPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(251,191,36,.0), inset 0 0 0 4px #fbbf24 } 50% { box-shadow: 0 0 28px 4px rgba(251,191,36,.45), inset 0 0 0 4px #fbbf24 } }
        @keyframes palcoOk { 0% { transform: scale(.96) } 100% { transform: scale(1) } }
      `}</style>
      {/* barra superior */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #1e293b' }}>
        <span title={online ? 'Conectado' : 'Sem conexão'} style={{ width: 12, height: 12, borderRadius: 99, background: online ? '#22c55e' : '#ef4444', boxShadow: online ? '0 0 8px #22c55e' : 'none', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🎤 {estado.pedal.nome}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{estado.canal.nome} · mesa de som</div>
        </div>
        <button onClick={alternarTelaCheia} aria-label="Tela cheia"
          style={{ background: '#1e293b', color: '#e2e8f0', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>⛶ Tela cheia</button>
      </div>

      {!online && <div style={{ background: '#7f1d1d', color: 'white', textAlign: 'center', padding: '6px 10px', fontSize: 14, fontWeight: 700 }}>Sem conexão com a mesa — verifique a internet</div>}

      {/* botões */}
      {n === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 18, padding: 24, textAlign: 'center' }}>
          Nenhum botão ativo. Configure os botões em Palco ↔ Mesa.
        </div>
      ) : (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: '1fr', gap: 12, padding: 12, minHeight: 0 }}>
          {estado.botoes.map(b => {
            const c = porPos.get(b.posicao)
            const st = c?.status
            return (
              <button key={b.posicao}
                onClick={() => enviar(b.posicao)}
                disabled={enviando === b.posicao}
                aria-label={`${b.nome}: ${b.mensagem}`}
                style={{
                  position: 'relative', border: 'none', borderRadius: 22, cursor: 'pointer', fontFamily: 'inherit',
                  background: b.cor, color: 'white', padding: '14px 12px', minHeight: 0, overflow: 'hidden',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                  filter: flash === b.posicao ? 'brightness(1.35)' : 'none',
                  transform: flash === b.posicao ? 'scale(.97)' : 'none',
                  transition: 'transform .12s, filter .12s',
                  animation: st === 'aberto' ? 'palcoPulse 1.2s ease-in-out infinite' : st === 'resolvido' ? 'palcoOk .3s' : 'none',
                  boxShadow: st === 'visto' ? 'inset 0 0 0 4px #38bdf8' : st === 'resolvido' ? 'inset 0 0 0 4px #4ade80' : 'none',
                }}>
                <span style={{ position: 'absolute', top: 10, left: 12, fontSize: 14, fontWeight: 800, background: 'rgba(0,0,0,.28)', borderRadius: 8, padding: '2px 8px' }}>{b.posicao}</span>
                <span style={{ fontSize: tamNome(b.nome, cols), fontWeight: 900, lineHeight: 1.05, textAlign: 'center', textShadow: '0 2px 6px rgba(0,0,0,.25)', overflowWrap: 'break-word', maxWidth: '100%' }}>{b.nome}</span>
                {b.mensagem && <span style={{ fontSize: 'clamp(13px, 2.4vmin, 20px)', fontWeight: 600, opacity: .92, textAlign: 'center', lineHeight: 1.2 }}>{b.mensagem}</span>}
                {st && (
                  <span style={{
                    marginTop: 4, fontSize: 'clamp(12px, 2.2vmin, 17px)', fontWeight: 900, letterSpacing: .5, borderRadius: 99, padding: '5px 12px',
                    background: st === 'aberto' ? '#fbbf24' : st === 'visto' ? '#38bdf8' : '#4ade80', color: '#0b0f17',
                  }}>
                    {st === 'aberto' ? `ENVIADO${c!.repeticoes > 1 ? ` ×${c!.repeticoes}` : ''} · AGUARDANDO` : st === 'visto' ? '👀 MESA VIU' : '✓ RESOLVIDO'}
                  </span>
                )}
                {c && st !== 'resolvido' && (
                  <span role="button" aria-label="Cancelar pedido"
                    onClick={e => { e.stopPropagation(); cancelar(c) }}
                    style={{ position: 'absolute', top: 8, right: 8, width: 40, height: 40, borderRadius: 99, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>✕</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {aviso && (
        <div style={{ position: 'fixed', left: 16, right: 16, bottom: 20, background: '#7f1d1d', color: 'white', borderRadius: 14, padding: '12px 16px', fontWeight: 700, fontSize: 16, textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>{aviso}</div>
      )}
    </div>
  )
}

// Fonte do nome cabe na largura do botão sem quebrar a palavra no meio
// (largura ≈ 100vw/colunas; cada letra ≈ 0,62em; a palavra mais longa manda).
function tamNome(nome: string, cols: number): string {
  const maior = Math.max(4, ...nome.split(/\s+/).map(w => w.length))
  const vw = (82 / cols) / (maior * 0.62)
  return `clamp(20px, min(6.5vmin, ${vw.toFixed(2)}vw), 64px)`
}

function Tela({ children }: { children: React.ReactNode }) {
  useFundoEscuro('#0b0f17')
  return <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0f17' }}>{children}</div>
}
