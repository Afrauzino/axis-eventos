import { supabase } from '../lib/supabase'

// Converte hex em {r,g,b}
function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function clamp(n: number) { return Math.max(0, Math.min(255, Math.round(n))) }

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(x => clamp(x).toString(16).padStart(2, '0')).join('')
}

// Escurece uma cor (fator 0-1)
function darken(hex: string, f: number) {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex(r * (1 - f), g * (1 - f), b * (1 - f))
}

// Clareia bem (para fundos suaves)
function lighten(hex: string, f: number) {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f)
}

// Aplica a cor principal em todas as variáveis CSS derivadas
export function aplicarCor(hex: string) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return
  const root = document.documentElement
  const { r, g, b } = hexToRgb(hex)
  root.style.setProperty('--primary', hex)
  root.style.setProperty('--primary-dark', darken(hex, 0.18))
  root.style.setProperty('--primary-light', lighten(hex, 0.90))
  root.style.setProperty('--primary-mid', `rgba(${r},${g},${b},0.15)`)
}

const COR_PADRAO = '#00A99D'
let cacheCor: string | null = null

// Lê a cor salva no banco (configuracoes) e aplica
export async function carregarCorSalva() {
  // aplica o cache na hora (evita piscar)
  if (cacheCor) aplicarCor(cacheCor)
  try {
    const { data } = await supabase.from('configuracoes')
      .select('valor').eq('chave', 'cor_primaria').maybeSingle()
    const cor = data?.valor || COR_PADRAO
    cacheCor = cor
    aplicarCor(cor)
    return cor
  } catch {
    aplicarCor(COR_PADRAO)
    return COR_PADRAO
  }
}

// Salva a nova cor no banco e aplica
export async function salvarCor(hex: string) {
  cacheCor = hex
  aplicarCor(hex)
  try {
    await supabase.from('configuracoes')
      .upsert({ chave: 'cor_primaria', valor: hex }, { onConflict: 'chave' })
    return true
  } catch {
    return false
  }
}

// ===== Config genérica (chave/valor em `configuracoes`) — logo, etc. =====
export async function carregarConfig(chave: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('configuracoes').select('valor').eq('chave', chave).maybeSingle()
    return data?.valor ?? null
  } catch { return null }
}
export async function salvarConfig(chave: string, valor: string): Promise<boolean> {
  try {
    await supabase.from('configuracoes').upsert({ chave, valor }, { onConflict: 'chave' })
    return true
  } catch { return false }
}

// Define o ícone (favicon) do app dinamicamente para a logo
export function aplicarFavicon(url: string) {
  if (!url) return
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
  link.href = url
}

export { COR_PADRAO }
