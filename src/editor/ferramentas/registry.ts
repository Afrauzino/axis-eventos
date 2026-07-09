// Registro das ferramentas da barra inferior.
// Adicionar ferramenta (Réguas, Zoom, Camadas, Efeitos...):
//   1) criar o arquivo com a DefFerramenta
//   2) importá-lo em ./index.ts
// A barra se monta sozinha a partir daqui.
import type { DefFerramenta } from '../tipos'

const REGISTRO: DefFerramenta[] = []

export function registrarFerramenta(def: DefFerramenta) { REGISTRO.push(def) }
export function listarFerramentas(): DefFerramenta[] { return [...REGISTRO] }
export function obterFerramenta(id: string) { return REGISTRO.find(f => f.id === id) }
