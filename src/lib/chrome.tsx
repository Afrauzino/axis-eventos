import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { NAV_GROUPS, ADMIN_GRUPOS } from './navGroups'

const TITULOS_NAV: Record<string, string> = { admin:'Administração', equipes:'Equipes e Escalas', teatro:'Teatro', evento:'Evento', saude:'Saúde', financeiro:'Financeiro' }

// "Chrome" da página = o que a página entrega pro ⚙️ do topo:
// busca + filtros + opções de imprimir + configurações da própria tela.
export type FiltroGrupo = { chave: string; label: string; opcoes: { value: string; label: string }[] }
export type ItemImpressao = { label: string; onClick: () => void; icon?: string; disabled?: boolean }
export type ItemConfig = { label: string; onClick: () => void; icon?: string }
export type NavItem = { label: string; ativo?: boolean; onClick: () => void; icone?: string }
export type NavGrupo = { titulo: string; itens: NavItem[] }
// Navegação em RAIL lateral (coluna de grupos com emoji + painel de itens ao lado).
export type RailGrupo = { titulo: string; curto: string; emoji: string; itens: NavItem[] }

export type Chrome = {
  navegacao?: NavGrupo[]        // sub-abas da tela, organizadas em grupos
  railGrupos?: RailGrupo[]      // navegação em rail lateral (Administração)
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

// Menu ÚNICO da Administração (4 grupos por assunto), montado a partir de
// ADMIN_GRUPOS. Usado por TODAS as telas admin (Usuários, Menus, Notificações,
// Saúde, Comparativo) — assim o ⚙️ fica idêntico em qualquer uma delas.
// Item marcado como ativo pela rota OU, se for aba (/admin?aba=xxx), pelo ?aba=.
export function useRegistrarChromeAdmin(extra: Chrome = {}, deps: any[] = []) {
  const nav = useNavigate()
  const loc = useLocation()
  const abaAtual = new URLSearchParams(loc.search).get('aba') || 'usuarios'
  const estaAtivo = (rota: string) => {
    const [caminho, query] = rota.split('?')
    if (query) return loc.pathname === caminho && `aba=${abaAtual}` === query
    return loc.pathname === caminho
  }
  const railGrupos: RailGrupo[] = ADMIN_GRUPOS.map(g => ({
    titulo: g.titulo,
    curto: g.curto ?? g.titulo,
    emoji: g.emoji ?? '•',
    itens: g.itens.map(it => ({ label: it.label, icone: it.icone, ativo: estaAtivo(it.rota), onClick: () => nav(it.rota) })),
  }))
  useRegistrarChrome(
    { ...extra, railGrupos, navegacao: extra.navegacao },
    [loc.pathname, loc.search, ...deps], // eslint-disable-line react-hooks/exhaustive-deps
  )
}

// Atalho: registra a NAVEGAÇÃO de um grupo de sub-abas (SubTabs) no ⚙️.
// A tela some com a fileira de abas e usa o ⚙️. `extra` acrescenta busca/filtro/imprimir/seções.
export function useRegistrarChromeNav(group: keyof typeof NAV_GROUPS, extra: Chrome = {}, deps: any[] = []) {
  const nav = useNavigate()
  const loc = useLocation()
  const grupo = NAV_GROUPS[group] ?? []
  const chrome: Chrome = {
    ...extra,
    navegacao: [
      { titulo: TITULOS_NAV[group] ?? 'Ir para', itens: grupo.map(it => ({ label: it.label, ativo: loc.pathname === it.rota, onClick: () => { if (loc.pathname !== it.rota) nav(it.rota) } })) },
      ...(extra.navegacao ?? []),
    ],
  }
  useRegistrarChrome(chrome, [loc.pathname, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
}
