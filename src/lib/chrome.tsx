import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

// "Chrome" da página = o que a página entrega pro ⚙️ do topo:
// busca + filtros + opções de imprimir + configurações da própria tela.
export type FiltroGrupo = { chave: string; label: string; opcoes: { value: string; label: string }[] }
export type ItemImpressao = { label: string; onClick: () => void; icon?: string; disabled?: boolean }
export type ItemConfig = { label: string; onClick: () => void; icon?: string }

export type Chrome = {
  busca?: { value: string; onChange: (v: string) => void; placeholder?: string }
  grupos?: FiltroGrupo[]
  valores?: Record<string, string>
  onFiltro?: (chave: string, value: string) => void
  padraoFiltro?: string        // valor que conta como "sem filtro" (padrão 'todos')
  impressoes?: ItemImpressao[]
  configs?: ItemConfig[]
}

const Ctx = createContext<{ chrome: Chrome | null; setChrome: (c: Chrome | null) => void }>({ chrome: null, setChrome: () => {} })

export function ChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChrome] = useState<Chrome | null>(null)
  return <Ctx.Provider value={{ chrome, setChrome }}>{children}</Ctx.Provider>
}

export function useChrome() { return useContext(Ctx) }

// A página registra o seu chrome. Passe nas deps os valores reativos
// (busca, filtros selecionados) pra o ⚙️ acompanhar.
export function useRegistrarChrome(chrome: Chrome, deps: any[]) {
  const { setChrome } = useContext(Ctx)
  useEffect(() => {
    setChrome(chrome)
    return () => setChrome(null)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}
