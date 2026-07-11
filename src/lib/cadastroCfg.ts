// Configuração do campo "Cargo" no cadastro — fonte única (chave/valor).
// Admin edita em Administração → Ficha de cadastro. Sem schema novo.
import { carregarConfig, salvarConfig } from './tema'

export type CadastroCfg = { cargos: string[]; obrigatorio: boolean; oculto: boolean }
export const CADASTRO_CFG_VAZIO: CadastroCfg = { cargos: [], obrigatorio: false, oculto: false }

let cache: CadastroCfg | null = null

export async function carregarCadastroCfg(force = false): Promise<CadastroCfg> {
  if (cache && !force) return cache
  const [c, ob, oc] = await Promise.all([
    carregarConfig('cadastro_cargos'),
    carregarConfig('cadastro_cargo_obrigatorio'),
    carregarConfig('cadastro_cargo_oculto'),
  ])
  let cargos: string[] = []
  if (c) { try { const arr = JSON.parse(c); if (Array.isArray(arr)) cargos = arr.filter((x: any) => typeof x === 'string' && x.trim()).map((x: string) => x.trim()) } catch {} }
  cache = { cargos, obrigatorio: ob === '1', oculto: oc === '1' }
  return cache
}

export async function salvarCadastroCfg(cfg: CadastroCfg): Promise<boolean> {
  cache = { ...cfg, cargos: cfg.cargos.filter(x => x.trim()).map(x => x.trim()) }
  const [a, b, d] = await Promise.all([
    salvarConfig('cadastro_cargos', JSON.stringify(cache.cargos)),
    salvarConfig('cadastro_cargo_obrigatorio', cfg.obrigatorio ? '1' : '0'),
    salvarConfig('cadastro_cargo_oculto', cfg.oculto ? '1' : '0'),
  ])
  return a && b && d
}

// O campo Cargo deve aparecer? (tem cargos configurados e não está oculto)
export function cargoVisivel(cfg: CadastroCfg): boolean {
  return !cfg.oculto && cfg.cargos.length > 0
}

// Falta preencher um cargo obrigatório? (pra validar antes de salvar)
export async function cargoObrigatorioFaltando(cargo: string | undefined | null): Promise<boolean> {
  const cfg = await carregarCadastroCfg()
  if (!cargoVisivel(cfg) || !cfg.obrigatorio) return false
  return !((cargo ?? '').trim())
}
