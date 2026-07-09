// ─────────────────────────────────────────────────────────────
// Editor de impressão — MODELO DE DADOS
// Tudo que é genérico mora aqui. Um elemento novo (QR, código de
// barras, forma...) NÃO mexe neste arquivo: ele só se registra.
// Unidade oficial do documento: milímetros (mm). O canvas converte pra px.
// ─────────────────────────────────────────────────────────────
import type { ReactNode } from 'react'

export type Id = string

/** Propriedades que TODO elemento tem. O comportamento padrão
 *  (selecionar/arrastar/redimensionar/rotacionar/duplicar/excluir/
 *   ordem/opacidade/bloquear/alinhar/agrupar) age sobre elas. */
export type Elemento = {
  id: Id
  tipo: string            // chave no registro de elementos
  x: number               // mm — canto superior esquerdo
  y: number               // mm
  w: number               // mm
  h: number               // mm
  rot: number             // graus (0-360)
  opacidade: number       // 0..1
  bloqueado: boolean
  visivel: boolean
  grupo?: Id | null       // id do grupo (agrupar/desagrupar)
  props: Record<string, any>  // específico de cada tipo
}

export type Pagina = {
  id: Id
  fundo?: string
  elementos: Elemento[]   // a ORDEM do array é a ordem de empilhamento (z)
}

export type Papel = {
  largura: number         // mm
  altura: number          // mm
  sangria?: number        // mm (futuro)
  marcasCorte?: boolean   // futuro
}

/** De onde vem o preenchimento automático. 'pessoas' = repete o
 *  modelo por pessoa, trocando os campos ligados ({{nome}}, {{foto}}...). */
export type FonteDados = 'pessoas' | null

export type Documento = {
  id: Id
  nome: string
  papel: Papel
  paginas: Pagina[]
  fonteDados: FonteDados
}

// ── Comandos (tudo passa por aqui → desfazer/refazer de graça) ──
export type Acao =
  | { t: 'add';        paginaId: Id; el: Elemento }
  | { t: 'excluir';    ids: Id[] }
  | { t: 'patch';      ids: Id[]; patch: Partial<Elemento> }
  | { t: 'patchProps'; ids: Id[]; props: Record<string, any> }
  | { t: 'ordem';      ids: Id[]; para: 'frente' | 'tras' | 'topo' | 'fundo' }
  | { t: 'duplicar';   ids: Id[] }
  | { t: 'agrupar';    ids: Id[] }
  | { t: 'desagrupar'; ids: Id[] }
  | { t: 'documento';  patch: Partial<Documento> }
  | { t: 'papel';      patch: Partial<Papel> }
  | { t: 'pagina.add' }
  | { t: 'pagina.excluir'; paginaId: Id }
  | { t: 'pagina.duplicar'; paginaId: Id }

// ── Registro de ELEMENTOS ──────────────────────────────────────
/** Contrato de um tipo de elemento. Criar um tipo novo = implementar
 *  isto num arquivo e registrar. Ele já ganha todo o comportamento padrão. */
export type DefElemento = {
  tipo: string
  nome: string
  icone: string                 // Material Symbols
  /** Cria o elemento com valores padrão (o registro completa id/tipo). */
  criar: (parcial?: Partial<Elemento>) => Omit<Elemento, 'id' | 'tipo'>
  /** Como desenhar. `dados` traz os valores da pessoa quando há fonte de dados. */
  Render: (p: { el: Elemento; dados?: Record<string, any>; modo: 'tela' | 'papel' }) => ReactNode
  /** Painel de propriedades específicas do tipo (opcional). */
  Painel?: (p: { el: Elemento; setProps: (props: Record<string, any>) => void; set: (patch: Partial<Elemento>) => void }) => ReactNode
  /** Campos do sistema que este elemento aceita ligar (ex: ['nome','foto']). */
  camposLigaveis?: string[]
}

// ── Registro de FERRAMENTAS (barra inferior) ───────────────────
export type CtxEditor = {
  doc: Documento
  paginaAtual: number
  selecao: Id[]
  dispatch: (a: Acao) => void
  selecionar: (ids: Id[]) => void
  setPaginaAtual: (i: number) => void
  desfazer: () => void
  refazer: () => void
  podeDesfazer: boolean
  podeRefazer: boolean
}

/** Um botão da barra inferior + o painel que ele abre. Adicionar
 *  ferramenta (Réguas, Zoom, Efeitos...) = 1 arquivo + 1 linha no registro. */
export type DefFerramenta = {
  id: string
  nome: string
  icone: string
  /** Se true, só aparece quando há algo selecionado. */
  precisaSelecao?: boolean
  Painel: (ctx: CtxEditor) => ReactNode
}

// ── Utilitários ────────────────────────────────────────────────
export const novoId = (): Id => Math.random().toString(36).slice(2, 10)

export const ELEMENTO_PADRAO: Omit<Elemento, 'id' | 'tipo' | 'props'> = {
  x: 10, y: 10, w: 40, h: 12, rot: 0, opacidade: 1, bloqueado: false, visivel: true, grupo: null,
}
