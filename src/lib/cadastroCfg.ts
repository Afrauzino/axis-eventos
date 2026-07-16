// Configuração da FICHA DE CADASTRO — fonte única (chave/valor, sem schema novo).
// Admin edita em Administração → Ficha de cadastro.
//  - Cargo: lista fixa (cadastro_cargos) + obrigatório/ocultar (chaves próprias, legado).
//  - Demais campos: cada um pode ser ocultado e/ou virar obrigatório (cadastro_campos).
import { carregarConfig, salvarConfig } from './tema'

// Campos da ficha que dá pra ligar/desligar e obrigar. Nome e Celular ficam de
// fora de propósito (são a base do cadastro — sempre visíveis e obrigatórios).
// A chave bate com o campo do PessoaForm (foto = photo_url).
export const CAMPOS: { key: string; label: string }[] = [
  { key: 'foto',          label: 'Foto' },
  { key: 'contact_phone', label: 'Contato de emergência' },
  { key: 'sexo',          label: 'Sexo' },
  { key: 'birth_date',    label: 'Data de nascimento' },
  { key: 'estado_civil',  label: 'Estado civil' },
  { key: 'phone2',        label: '2º telefone de contato' },
  { key: 'contact_phone2', label: '2º contato de emergência' },
  { key: 'cpf',           label: 'CPF' },
  { key: 'rg',            label: 'RG' },
  { key: 'church',        label: 'Igreja' },
  { key: 'ano_encontro',  label: 'Ano que passou pelo encontro' },
  { key: 'instagram',     label: 'Instagram' },
  { key: 'facebook',      label: 'Facebook' },
  { key: 'rede_outra',    label: 'Outra rede social' },
  { key: 'endereco',      label: 'Endereço' },
  { key: 'bairro',        label: 'Bairro' },
  { key: 'cep',           label: 'CEP' },
  { key: 'cidade',        label: 'Cidade' },
  { key: 'estado',        label: 'Estado (UF)' },
  { key: 'notes',         label: 'Observações' },
]

export type CampoCfg = { oculto?: boolean; obrigatorio?: boolean }
export type CadastroCfg = {
  cargos: string[]
  obrigatorio: boolean          // cargo obrigatório
  oculto: boolean               // cargo oculto
  campos: Record<string, CampoCfg>
}
export const CADASTRO_CFG_VAZIO: CadastroCfg = { cargos: [], obrigatorio: false, oculto: false, campos: {} }

let cache: CadastroCfg | null = null

export async function carregarCadastroCfg(force = false): Promise<CadastroCfg> {
  if (cache && !force) return cache
  const [c, ob, oc, cp] = await Promise.all([
    carregarConfig('cadastro_cargos'),
    carregarConfig('cadastro_cargo_obrigatorio'),
    carregarConfig('cadastro_cargo_oculto'),
    carregarConfig('cadastro_campos'),
  ])
  let cargos: string[] = []
  if (c) { try { const arr = JSON.parse(c); if (Array.isArray(arr)) cargos = arr.filter((x: any) => typeof x === 'string' && x.trim()).map((x: string) => x.trim()) } catch {} }
  let campos: Record<string, CampoCfg> = {}
  if (cp) { try { const o = JSON.parse(cp); if (o && typeof o === 'object') campos = o } catch {} }
  cache = { cargos, obrigatorio: ob === '1', oculto: oc === '1', campos }
  return cache
}

export async function salvarCadastroCfg(cfg: CadastroCfg): Promise<boolean> {
  const cargos = cfg.cargos.filter(x => x.trim()).map(x => x.trim())
  cache = { ...cfg, cargos }
  const [a, b, d, e] = await Promise.all([
    salvarConfig('cadastro_cargos', JSON.stringify(cargos)),
    salvarConfig('cadastro_cargo_obrigatorio', cfg.obrigatorio ? '1' : '0'),
    salvarConfig('cadastro_cargo_oculto', cfg.oculto ? '1' : '0'),
    salvarConfig('cadastro_campos', JSON.stringify(cfg.campos || {})),
  ])
  return a && b && d && e
}

// ---- Cargo ----
export function cargoVisivel(cfg: CadastroCfg): boolean { return !cfg.oculto && cfg.cargos.length > 0 }

// ---- Campos gerais ----
export function campoOculto(cfg: CadastroCfg, key: string): boolean { return cfg.campos[key]?.oculto === true }
export function campoObrigatorio(cfg: CadastroCfg, key: string): boolean { return cfg.campos[key]?.obrigatorio === true }

// Foto: obrigatória POR PADRÃO (comportamento de hoje). Só deixa de exigir se
// for ocultada OU se o admin desligar o "obrigatório" da foto explicitamente.
export function fotoRequerida(cfg: CadastroCfg): boolean {
  return !campoOculto(cfg, 'foto') && cfg.campos['foto']?.obrigatorio !== false
}

// Pega o valor "preenchido?" de um campo no form (foto = photo_url).
function preenchido(form: any, key: string): boolean {
  const v = key === 'foto' ? form.photo_url : form[key]
  return !!(v && String(v).trim())
}

// Retorna a lista de campos OBRIGATÓRIOS que estão VAZIOS (pra validar no salvar).
// Inclui o Cargo. Devolve os rótulos amigáveis.
export async function validarCadastroFaltando(form: any): Promise<string[]> {
  const cfg = await carregarCadastroCfg()
  const faltando: string[] = []
  // Cargo (config própria)
  if (cargoVisivel(cfg) && cfg.obrigatorio && !preenchido({ photo_url: null, cargo: form.cargo }, 'cargo')) faltando.push('Cargo')
  // Foto (obrigatória por padrão)
  if (fotoRequerida(cfg) && !preenchido(form, 'foto')) faltando.push('Foto')
  // Demais campos
  for (const c of CAMPOS) {
    if (c.key === 'foto') continue  // já tratado acima (padrão diferente)
    if (campoOculto(cfg, c.key)) continue
    if (campoObrigatorio(cfg, c.key) && !preenchido(form, c.key)) faltando.push(c.label)
  }
  return faltando
}
