// Lista PADRÃO de igrejas (campo church). Seleção única no cadastro/pré-cadastro.
// Quem não é de nenhuma dessas (nome de cidade etc.) entra em "Outros".

export const IGREJAS = [
  'Adoradores Mac',
  'Adoradores LP',
  'Adoradores Ped',
  'Adoradores Guedes',
  'Ad Vec',
  'Rompendo em Fé',
  'Outros',
] as const

export type Igreja = typeof IGREJAS[number]

// Só as "nomeadas" (sem o "Outros") — útil pra decidir o que cai em Outros.
export const IGREJAS_NOMEADAS = IGREJAS.filter(i => i !== 'Outros')

export const IGREJA_OPCOES = IGREJAS.map(i => ({ value: i, label: i }))
