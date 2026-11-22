// "Liquid glass" (estilo iOS) das telas do Palco ↔ Mesa.
// Vidro = cor translúcida + desfoque do que está atrás (backdrop-filter) + reflexo
// de luz no topo + borda clara fina. O fundo tem manchas de cor (as cores dos
// botões) pra o vidro ter o que "refratar". Sem filtro animado no fundo: roda
// leve em tablet/celular simples.
import type { CSSProperties } from 'react'

export function rgba(hex: string, a: number): string {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? '64748b'
  const n = parseInt(h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

const BLUR = 'blur(22px) saturate(180%)'

/** Botão de vidro colorido. `fraco` = vidro escuro só com toque de cor (opções/etapas). */
export function vidroBotao(cor: string, fraco = false): CSSProperties {
  return {
    background: fraco
      ? `linear-gradient(160deg, ${rgba(cor, .30)} 0%, rgba(15,23,42,.42) 60%, ${rgba(cor, .22)} 100%)`
      : `linear-gradient(160deg, ${rgba(cor, .78)} 0%, ${rgba(cor, .46)} 55%, ${rgba(cor, .62)} 100%)`,
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    border: `1px solid ${fraco ? rgba(cor, .55) : 'rgba(255,255,255,.30)'}`,
    boxShadow: [
      'inset 0 1px 1px rgba(255,255,255,.70)',
      'inset 0 -1px 1px rgba(255,255,255,.18)',
      `inset 0 0 26px ${rgba(cor, fraco ? .22 : .40)}`,
      '0 12px 32px rgba(0,0,0,.38)',
      `0 0 26px ${rgba(cor, fraco ? .15 : .28)}`,
    ].join(', '),
  }
}

/** Barra/painel de vidro escuro (topo, abas, cards). */
export function vidroPainel(alfa = .42): CSSProperties {
  return {
    background: `rgba(15,23,42,${alfa})`,
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    border: '1px solid rgba(255,255,255,.10)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12), 0 10px 30px rgba(0,0,0,.30)',
  }
}

/** Botão pequeno de vidro (topo: tela cheia, som, instalar…). */
export const vidroChip: CSSProperties = {
  background: 'rgba(255,255,255,.10)',
  backdropFilter: BLUR,
  WebkitBackdropFilter: BLUR,
  border: '1px solid rgba(255,255,255,.18)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)',
  color: '#f1f5f9', borderRadius: 12, padding: '8px 12px', fontSize: 13, fontWeight: 800,
  cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
}

/** Reflexo de luz (o "brilho" do vidro). Vai como 1º filho de um elemento position:relative. */
export function Brilho({ raio = 22 }: { raio?: number }) {
  return (
    <span aria-hidden style={{
      position: 'absolute', inset: 0, borderRadius: raio, pointerEvents: 'none',
      background: 'radial-gradient(120% 70% at 25% -10%, rgba(255,255,255,.42), rgba(255,255,255,0) 55%), linear-gradient(180deg, rgba(255,255,255,0) 70%, rgba(255,255,255,.08))',
    }} />
  )
}

/** Fundo escuro com manchas das cores dos botões (pro vidro refratar). */
export function FundoVivo({ cores }: { cores: string[] }) {
  const c = cores.length ? cores : ['#2B6CB0', '#6B46C1', '#00A99D']
  const pos = ['12% 18%', '85% 12%', '50% 55%', '15% 88%', '88% 85%', '50% 100%']
  const camadas = pos.map((p, i) => `radial-gradient(38% 42% at ${p}, ${rgba(c[i % c.length], .42)}, transparent 70%)`)
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -1, background: `${camadas.join(', ')}, #05070d` }}>
      <style>{`@keyframes palcoDeriva { 0%,100% { transform: translate3d(0,0,0) scale(1) } 50% { transform: translate3d(-2%,1.5%,0) scale(1.06) } }`}</style>
      <div style={{ position: 'absolute', inset: '-10%', background: camadas.slice(0, 3).reverse().join(', '), opacity: .55, animation: 'palcoDeriva 18s ease-in-out infinite' }} />
    </div>
  )
}
