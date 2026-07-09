// Fontes disponíveis no editor. Compartilhado — qualquer elemento novo
// que tenha texto usa a mesma lista. Adicionar uma fonte = 1 linha aqui.
// (São fontes web-safe: aparecem igual na tela e na impressão.)

export const FONTES = [
  'Padrão',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Trebuchet MS',
  'Tahoma',
  'Courier New',
  'Impact',
  'Comic Sans MS',
  'Brush Script MT',
] as const

export type Fonte = typeof FONTES[number]

/** 'Padrão' herda a fonte do app; as outras usam a família com fallback. */
export function fontFamilyDe(fonte?: string): string | undefined {
  if (!fonte || fonte === 'Padrão') return undefined
  const comAspas = /\s/.test(fonte) ? `"${fonte}"` : fonte
  const generica = fonte === 'Courier New' ? 'monospace'
    : ['Georgia', 'Times New Roman'].includes(fonte) ? 'serif'
    : ['Impact', 'Brush Script MT', 'Comic Sans MS'].includes(fonte) ? 'cursive'
    : 'sans-serif'
  return `${comAspas}, ${generica}`
}
