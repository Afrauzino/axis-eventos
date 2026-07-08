import type { CSSProperties } from 'react'

// Estilo de fundo de um bloco da tela inicial (cor OU imagem/degradê).
// Aplica no próprio elemento colorido do bloco (cabeçalho ou card).
export type BlocoFundo = { cor?: string; bg?: string }

export function estiloFundo(fundo: BlocoFundo | undefined, padrao: string): CSSProperties {
  if (fundo?.bg) return { backgroundImage: `linear-gradient(rgba(0,0,0,0.18),rgba(0,0,0,0.28)), url(${fundo.bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  if (fundo?.cor) return { background: fundo.cor }
  return { background: padrao }
}
