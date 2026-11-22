import { useCallback, useEffect, useRef, useState } from 'react'
import { posicaoDaTecla, vibrar, type MeuChamado, type PalcoBotao } from '../../lib/palco'

// Grade de botões do PALCO (usada no /ped e na aba Palco do /cel).
// Botão simples → 1 toque envia. Botão com ETAPAS → abre 1 ou 2 telas de escolha
// (ex.: Back → "Sem retorno" → "Ana") = até 3 toques. Teclas: 1–6 / A–F escolhem;
// Esc/Backspace/0 voltam. Fica parado numa etapa por 15 s → volta pra grade.

type Props = {
  botoes: PalcoBotao[]
  chamados: MeuChamado[]
  onEnviar: (posicao: number, escolhas: string[]) => Promise<boolean>
  onCancelar: (c: MeuChamado) => void
}

type Fluxo = { botao: PalcoBotao; escolhas: string[] }
const VOLTA_SOZINHO_MS = 15000

export default function PadPalco({ botoes, chamados, onEnviar, onCancelar }: Props) {
  const [fluxo, setFluxo] = useState<Fluxo | null>(null)
  const [flash, setFlash] = useState<string | null>(null)        // chave do botão/opção piscando
  const [enviado, setEnviado] = useState<{ texto: string; cor: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [paisagem, setPaisagem] = useState(() => window.innerWidth > window.innerHeight)
  const timerVolta = useRef<number | undefined>(undefined)
  const timerEnviado = useRef<number | undefined>(undefined)

  useEffect(() => {
    const f = () => setPaisagem(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])

  // parado numa etapa → volta pra grade (cantor desistiu / tocou sem querer)
  useEffect(() => {
    window.clearTimeout(timerVolta.current)
    if (fluxo) timerVolta.current = window.setTimeout(() => setFluxo(null), VOLTA_SOZINHO_MS)
    return () => window.clearTimeout(timerVolta.current)
  }, [fluxo])

  // se a configuração mudar (botão some/ganha etapas) no meio do fluxo, sai do fluxo
  useEffect(() => {
    if (fluxo && !botoes.some(b => b.posicao === fluxo.botao.posicao && JSON.stringify(b.etapas ?? []) === JSON.stringify(fluxo.botao.etapas ?? []))) setFluxo(null)
  }, [botoes])

  function piscar(chave: string) {
    setFlash(chave); window.setTimeout(() => setFlash(f => (f === chave ? null : f)), 300)
  }

  const finalizar = useCallback(async (b: PalcoBotao, escolhas: string[]) => {
    setFluxo(null)
    setEnviando(true)
    const ok = await onEnviar(b.posicao, escolhas)
    setEnviando(false)
    if (ok) {
      vibrar(70)
      setEnviado({ texto: [b.nome, ...escolhas].join(' · '), cor: b.cor })
      window.clearTimeout(timerEnviado.current)
      timerEnviado.current = window.setTimeout(() => setEnviado(null), 1800)
    }
  }, [onEnviar])

  const tocarBotao = useCallback((b: PalcoBotao) => {
    if (enviando) return
    piscar(`b${b.posicao}`); vibrar(35)
    if (!b.etapas?.length) finalizar(b, [])
    else setFluxo({ botao: b, escolhas: [] })
  }, [enviando, finalizar])

  const escolher = useCallback((opcao: string) => {
    if (!fluxo) return
    piscar(`o${opcao}`); vibrar(35)
    const escolhas = [...fluxo.escolhas, opcao]
    if (escolhas.length >= (fluxo.botao.etapas?.length ?? 0)) finalizar(fluxo.botao, escolhas)
    else setFluxo({ botao: fluxo.botao, escolhas })
  }, [fluxo, finalizar])

  const voltar = useCallback(() => {
    setFluxo(f => (!f ? null : f.escolhas.length ? { ...f, escolhas: f.escolhas.slice(0, -1) } : null))
  }, [])

  // pedal físico / teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (fluxo && (e.key === 'Escape' || e.key === 'Backspace' || e.key === '0')) { e.preventDefault(); voltar(); return }
      const p = posicaoDaTecla(e)
      if (!p) return
      e.preventDefault()
      if (fluxo) {
        const etapa = fluxo.botao.etapas![fluxo.escolhas.length]
        const op = etapa?.opcoes[p - 1]
        if (op) escolher(op)
      } else {
        const b = botoes.find(x => x.posicao === p)
        if (b) tocarBotao(b)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fluxo, botoes, escolher, voltar, tocarBotao])

  if (botoes.length === 0) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 18, padding: 24, textAlign: 'center' }}>
      Nenhum botão ativo. Configure os botões em Palco ↔ Mesa.
    </div>
  )

  // ── TELA DE ETAPA ──
  if (fluxo) {
    const b = fluxo.botao
    const passo = fluxo.escolhas.length
    const etapa = b.etapas![passo]
    const total = b.etapas!.length
    const n = etapa.opcoes.length
    const cols = paisagem ? Math.min(3, n) : (n <= 3 ? 1 : 2)
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: b.cor }}>
          <button onClick={voltar} style={btnEtapa}>← Voltar</button>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, opacity: .9 }}>{[b.nome, ...fluxo.escolhas].join(' › ')}</div>
            <div style={{ fontSize: 'clamp(20px, 4vmin, 30px)', fontWeight: 900, lineHeight: 1.1 }}>{etapa.titulo || 'Escolha'}</div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 900, background: 'rgba(0,0,0,.25)', borderRadius: 99, padding: '4px 10px' }}>{passo + 2}/{total + 1}</span>
          <button onClick={() => setFluxo(null)} style={btnEtapa} aria-label="Cancelar">✕</button>
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: '1fr', gap: 12, padding: 12, minHeight: 0 }}>
          {etapa.opcoes.map((op, i) => (
            <button key={op} onClick={() => escolher(op)}
              style={{
                position: 'relative', border: `4px solid ${b.cor}`, borderRadius: 22, cursor: 'pointer', fontFamily: 'inherit',
                background: flash === `o${op}` ? b.cor : '#111827', color: 'white', padding: 12, minHeight: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .12s',
              }}>
              <span style={{ position: 'absolute', top: 10, left: 12, fontSize: 14, fontWeight: 800, background: b.cor, borderRadius: 8, padding: '2px 8px' }}>{i + 1}</span>
              <span style={{ fontSize: tamTexto(op, cols), fontWeight: 900, lineHeight: 1.1, textAlign: 'center', overflowWrap: 'break-word', maxWidth: '100%' }}>{op}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── GRADE PRINCIPAL ──
  const n = botoes.length
  const cols = paisagem ? Math.min(3, Math.max(1, Math.ceil(n / 2))) : (n <= 3 ? 1 : 2)
  const ordem = { aberto: 0, visto: 1, resolvido: 2 } as const

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: '1fr', gap: 12, padding: 12, minHeight: 0, position: 'relative' }}>
      <style>{`
        @keyframes palcoPulse { 0%,100% { box-shadow: inset 0 0 0 4px #fbbf24 } 50% { box-shadow: 0 0 28px 4px rgba(251,191,36,.45), inset 0 0 0 4px #fbbf24 } }
      `}</style>
      {botoes.map(b => {
        const meus = chamados.filter(c => c.posicao === b.posicao).sort((x, y) => ordem[x.status] - ordem[y.status])
        const st = meus[0]?.status
        const abertos = meus.filter(c => c.status !== 'resolvido')
        const temEtapas = !!b.etapas?.length
        return (
          <button key={b.posicao} onClick={() => tocarBotao(b)} disabled={enviando}
            aria-label={`${b.nome}: ${b.mensagem}`}
            style={{
              position: 'relative', border: 'none', borderRadius: 22, cursor: 'pointer', fontFamily: 'inherit',
              background: b.cor, color: 'white', padding: '14px 12px', minHeight: 0, overflow: 'hidden',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
              filter: flash === `b${b.posicao}` ? 'brightness(1.35)' : 'none',
              transform: flash === `b${b.posicao}` ? 'scale(.97)' : 'none',
              transition: 'transform .12s, filter .12s',
              animation: st === 'aberto' ? 'palcoPulse 1.2s ease-in-out infinite' : 'none',
              boxShadow: st === 'visto' ? 'inset 0 0 0 4px #38bdf8' : st === 'resolvido' ? 'inset 0 0 0 4px #4ade80' : 'none',
            }}>
            <span style={{ position: 'absolute', top: 10, left: 12, fontSize: 14, fontWeight: 800, background: 'rgba(0,0,0,.28)', borderRadius: 8, padding: '2px 8px' }}>{b.posicao}</span>
            {temEtapas && <span style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 12, fontWeight: 800, background: 'rgba(0,0,0,.28)', borderRadius: 8, padding: '2px 8px' }}>{b.etapas!.length + 1} toques ›</span>}
            <span style={{ fontSize: tamTexto(b.nome, cols), fontWeight: 900, lineHeight: 1.05, textAlign: 'center', textShadow: '0 2px 6px rgba(0,0,0,.25)', overflowWrap: 'break-word', maxWidth: '100%' }}>{b.nome}</span>
            {b.mensagem && <span style={{ fontSize: 'clamp(13px, 2.4vmin, 20px)', fontWeight: 600, opacity: .92, textAlign: 'center', lineHeight: 1.2 }}>{b.mensagem}</span>}
            {st && (
              <span style={{
                marginTop: 4, fontSize: 'clamp(12px, 2.2vmin, 17px)', fontWeight: 900, letterSpacing: .5, borderRadius: 99, padding: '5px 12px',
                background: st === 'aberto' ? '#fbbf24' : st === 'visto' ? '#38bdf8' : '#4ade80', color: '#0b0f17',
              }}>
                {st === 'aberto'
                  ? `ENVIADO${abertos.length > 1 ? ` (${abertos.length})` : meus[0].repeticoes > 1 ? ` ×${meus[0].repeticoes}` : ''} · AGUARDANDO`
                  : st === 'visto' ? '👀 MESA VIU' : '✓ RESOLVIDO'}
              </span>
            )}
            {abertos.some(c => c.detalhe) && (
              <span style={{ fontSize: 'clamp(11px, 2vmin, 15px)', fontWeight: 700, opacity: .95, textAlign: 'center' }}>
                {abertos.filter(c => c.detalhe).slice(0, 2).map(c => c.detalhe).join(' / ')}{abertos.length > 2 ? ' …' : ''}
              </span>
            )}
            {abertos.length > 0 && (
              <span role="button" aria-label="Cancelar pedido"
                onClick={e => { e.stopPropagation(); abertos.forEach(onCancelar) }}
                style={{ position: 'absolute', top: 8, right: 8, width: 40, height: 40, borderRadius: 99, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>✕</span>
            )}
          </button>
        )
      })}

      {enviado && (
        <div style={{ position: 'absolute', inset: 12, borderRadius: 22, background: enviado.cor, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20, pointerEvents: 'none', boxShadow: '0 0 0 4px #fbbf24' }}>
          <div style={{ fontSize: 'clamp(40px, 10vmin, 90px)' }}>📨</div>
          <div style={{ fontSize: 'clamp(22px, 5vmin, 44px)', fontWeight: 900 }}>Enviado pra mesa</div>
          <div style={{ fontSize: 'clamp(16px, 3.4vmin, 28px)', fontWeight: 700, marginTop: 6 }}>{enviado.texto}</div>
        </div>
      )}
    </div>
  )
}

const btnEtapa: React.CSSProperties = { background: 'rgba(0,0,0,.3)', color: 'white', border: 'none', borderRadius: 12, padding: '10px 14px', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }

// Fonte cabe na largura do botão sem quebrar a palavra no meio
// (largura ≈ 100vw/colunas; cada letra ≈ 0,62em; a palavra mais longa manda).
function tamTexto(txt: string, cols: number): string {
  const maior = Math.max(4, ...txt.split(/\s+/).map(w => w.length))
  const vw = (82 / cols) / (maior * 0.62)
  return `clamp(20px, min(6.5vmin, ${vw.toFixed(2)}vw), 64px)`
}
