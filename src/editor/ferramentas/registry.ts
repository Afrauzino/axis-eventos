// Registro das ferramentas da barra inferior.
// Adicionar ferramenta (Réguas, Zoom, Camadas, Efeitos...):
//   1) criar o arquivo com a DefFerramenta
//   2) importá-lo em ./index.ts
// A barra se monta sozinha a partir daqui.
import type { DefFerramenta } from '../tipos'

const REGISTRO: DefFerramenta[] = []

/** Idempotente: registrar de novo o mesmo id SUBSTITUI (não duplica).
 *  Necessário porque o hot-reload reexecuta os módulos. */
export function registrarFerramenta(def: DefFerramenta) {
  const i = REGISTRO.findIndex(f => f.id === def.id)
  if (i >= 0) REGISTRO[i] = def
  else REGISTRO.push(def)
}
export function listarFerramentas(): DefFerramenta[] { return [...REGISTRO] }
export function obterFerramenta(id: string) { return REGISTRO.find(f => f.id === id) }
