import type { CSSProperties } from 'react'
import type { Elemento } from './tipos'

// Borda GENÉRICA — vale pra qualquer elemento (foto, texto, forma...).
// Guardada em el.props: bordaLargura (mm), bordaEstilo ('continua'|'tracejada'),
// bordaCor (hex), bordaOpacidade (0..1), bordaRaio (mm, arredondamento).

function hexParaRgba(hex: string, alpha: number): string {
  const h = (hex || '#000000').replace('#', '')
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const r = parseInt(n.slice(0, 2), 16) || 0
  const g = parseInt(n.slice(2, 4), 16) || 0
  const b = parseInt(n.slice(4, 6), 16) || 0
  const a = Math.max(0, Math.min(1, alpha))
  return `rgba(${r},${g},${b},${a})`
}

export function raioBorda(el: Elemento): number {
  return Number(el.props?.bordaRaio) || 0
}

// Estilo aplicado no "wrapper" do elemento (borda + arredondamento).
export function estiloBorda(el: Elemento): CSSProperties {
  const p = el.props || {}
  const larg = Number(p.bordaLargura) || 0
  const raio = raioBorda(el)
  const st: CSSProperties = {}
  if (raio > 0) st.borderRadius = `${raio}mm`
  if (larg > 0) {
    const estilo = p.bordaEstilo === 'tracejada' ? 'dashed' : 'solid'
    st.border = `${larg}mm ${estilo} ${hexParaRgba(p.bordaCor || '#000000', p.bordaOpacidade ?? 1)}`
    st.boxSizing = 'border-box'
  }
  return st
}

// Estilo do "recorte" interno: arredonda/clipa o conteúdo pra acompanhar a borda.
export function estiloRecorte(el: Elemento): CSSProperties {
  const raio = raioBorda(el)
  if (raio <= 0) return { width: '100%', height: '100%' }
  return { width: '100%', height: '100%', borderRadius: `${raio}mm`, overflow: 'hidden' }
}
