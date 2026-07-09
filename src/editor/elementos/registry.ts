// ─────────────────────────────────────────────────────────────
// Registro de tipos de elemento (puro — sem importar os tipos,
// pra não criar dependência circular).
// Para adicionar um tipo novo: crie o arquivo com a DefElemento,
// chame registrarElemento(...) nele, e importe-o em ./index.ts
// Ele já nasce com selecionar/arrastar/redimensionar/rotacionar/
// duplicar/excluir/ordem/opacidade/bloquear/alinhar/agrupar.
// ─────────────────────────────────────────────────────────────
import type { DefElemento, Elemento } from '../tipos'
import { novoId } from '../tipos'

const REGISTRO = new Map<string, DefElemento>()

export function registrarElemento(def: DefElemento) { REGISTRO.set(def.tipo, def) }
export function obterElemento(tipo: string): DefElemento | undefined { return REGISTRO.get(tipo) }
export function listarElementos(): DefElemento[] { return [...REGISTRO.values()] }

/** Cria uma instância pronta (com id) a partir do tipo registrado. */
export function criarElemento(tipo: string, parcial?: Partial<Elemento>): Elemento | null {
  const def = obterElemento(tipo)
  if (!def) return null
  const base = def.criar(parcial)
  return { ...base, ...parcial, id: novoId(), tipo } as Elemento
}
