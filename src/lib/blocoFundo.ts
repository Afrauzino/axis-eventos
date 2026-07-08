import type { CSSProperties } from 'react'

// Estilo de fundo de um bloco da tela inicial (cor OU imagem/degradê).
// Aplica no próprio elemento colorido do bloco (cabeçalho ou card).
export type BlocoFundo = { cor?: string; bg?: string }

export function estiloFundo(fundo: BlocoFundo | undefined, padrao: string): CSSProperties {
  if (fundo?.bg) return { backgroundImage: `linear-gradient(rgba(0,0,0,0.18),rgba(0,0,0,0.28)), url(${fundo.bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  if (fundo?.cor) return { background: fundo.cor }
  return { background: padrao }
}

// Proporção (largura/altura) real do elemento onde a imagem vai ficar, para o
// enquadramento ser fiel ao quadro. Cai em 16:9 se não conseguir medir.
export function medirAspecto(el: HTMLElement | null | undefined): number {
  const r = el?.getBoundingClientRect()
  return r && r.height > 4 ? r.width / r.height : 16 / 9
}
