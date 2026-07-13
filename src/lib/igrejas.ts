import { useEffect, useState } from 'react'
import { carregarConfig, salvarConfig } from './tema'

// Lista de igrejas (campo church). Seleção única no cadastro/pré-cadastro.
// A lista é GERENCIÁVEL pelo app (admin adiciona/remove) — guardada em
// `configuracoes` (chave 'igrejas', JSON). "Outros" é sempre uma opção fixa
// (abre um campo pra digitar). Fallback = IGREJAS_DEFAULT.

export const IGREJAS_DEFAULT = [
  'Adoradores Mac',
  'Adoradores LP',
  'Adoradores Ped',
  'Adoradores Guedes',
  'Ad Vec',
  'Rompendo em Fé',
]

export const OUTROS = 'Outros'

let cache: string[] | null = null

function limpar(arr: any): string[] {
  if (!Array.isArray(arr)) return []
  const vistos = new Set<string>()
  const out: string[] = []
  for (const x of arr) {
    if (typeof x !== 'string') continue
    const v = x.trim()
    if (!v || v === OUTROS) continue          // "Outros" é fixo, não entra na lista
    const chave = v.toLowerCase()
    if (vistos.has(chave)) continue
    vistos.add(chave); out.push(v)
  }
  return out
}

export async function carregarIgrejas(): Promise<string[]> {
  if (cache) return cache
  const raw = await carregarConfig('igrejas')
  if (raw) {
    try {
      const arr = limpar(JSON.parse(raw))
      if (arr.length) { cache = arr; return cache }
    } catch { /* usa o padrão */ }
  }
  cache = [...IGREJAS_DEFAULT]
  return cache
}

export async function salvarIgrejas(list: string[]): Promise<boolean> {
  const clean = limpar(list)
  cache = clean
  return salvarConfig('igrejas', JSON.stringify(clean))
}

// Hook: devolve a lista NOMEADA (sem "Outros"), com fallback imediato.
export function useIgrejas() {
  const [nomeadas, setNomeadas] = useState<string[]>(cache ?? IGREJAS_DEFAULT)
  const [loading, setLoading]   = useState(!cache)
  useEffect(() => {
    let vivo = true
    carregarIgrejas().then(l => { if (vivo) { setNomeadas(l); setLoading(false) } })
    return () => { vivo = false }
  }, [])
  function recarregar() { cache = null; carregarIgrejas().then(l => setNomeadas(l)) }
  return { nomeadas, loading, recarregar }
}
