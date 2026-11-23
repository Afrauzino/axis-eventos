// Palco ↔ Mesa de som — utilidades compartilhadas pelas telas públicas
// (/ped/:token no palco, /mesa/:token na mesa) e pela configuração (/palco).
import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// Etapa = uma tela de escolha antes de enviar (máx. 2 → até 3 toques). Ver sql/101.
export type PalcoEtapa = { titulo: string; opcoes: string[] }
export type PalcoBotao = { posicao: number; nome: string; mensagem: string; cor: string; etapas?: PalcoEtapa[]; tecla?: string | null }
// Chamado do PRÓPRIO pedal (retorno ENVIADO / MESA VIU / RESOLVIDO no palco)
export type MeuChamado = { id: string; posicao: number; status: 'aberto' | 'visto' | 'resolvido'; detalhe?: string; repeticoes: number }

export type PalcoChamado = {
  id: string
  pedal_id: string | null
  pedal_nome: string
  posicao: number
  nome: string
  mensagem: string
  cor: string
  detalhe?: string
  status: 'aberto' | 'visto' | 'resolvido' | 'cancelado'
  repeticoes: number
  criado_em: string
  atualizado_em: string
  visto_em: string | null
  resolvido_em: string | null
}

export const PALCO_CORES = ['#2F855A', '#2B6CB0', '#D69E2E', '#E8821A', '#C53030', '#6B46C1', '#00A99D', '#D53F8C', '#1A202C', '#718096']

// Token vem no caminho: /ped/<token> ou /mesa/<token>. 32 hex (ver sql/100).
export function tokenDaUrl(): string | null {
  const t = window.location.pathname.split('/')[2] ?? ''
  return /^[0-9a-f]{32}$/i.test(t) ? t.toLowerCase() : null
}

export function linkPedal(token: string) { return `${window.location.origin}/ped/${token}` }
export function linkMesa(token: string)  { return `${window.location.origin}/mesa/${token}` }
export function linkCelular(token: string) { return `${window.location.origin}/cel/${token}` }

/**
 * Busca o estado por RPC em intervalo (fonte da verdade) + escuta um "aviso" em
 * tempo real (broadcast) pra buscar NA HORA quando o outro lado muda algo.
 * O aviso não carrega dados — só "mudou". Se o tempo real falhar, o intervalo garante.
 */
export function usePalcoSync(puxar: () => void, sinal: string | null, intervaloMs: number) {
  const puxarRef = useRef(puxar)
  puxarRef.current = puxar
  const canalRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    const p = () => puxarRef.current()
    p()
    const t = setInterval(p, intervaloMs)
    const aoVoltar = () => { if (document.visibilityState === 'visible') p() }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', p)
    window.addEventListener('online', p)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', p)
      window.removeEventListener('online', p)
    }
  }, [intervaloMs])

  useEffect(() => {
    if (!sinal) return
    const ch = supabase.channel(`palco:${sinal}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'mudou' }, () => puxarRef.current())
      .subscribe()
    canalRef.current = ch
    return () => { canalRef.current = null; supabase.removeChannel(ch) }
  }, [sinal])

  // avisa o outro lado (não bloqueia; se falhar, o intervalo dele pega)
  return function avisar() {
    try { canalRef.current?.send({ type: 'broadcast', event: 'mudou', payload: {} }) } catch {}
  }
}

/** Mantém a tela acesa (tablet no palco / PC da mesa). Reativa ao voltar o foco. */
export function useTelaAcesa(ativo = true) {
  useEffect(() => {
    if (!ativo || !('wakeLock' in navigator)) return
    let lock: any = null
    let vivo = true
    const pedir = async () => {
      try { if (document.visibilityState === 'visible') lock = await (navigator as any).wakeLock.request('screen') } catch {}
    }
    pedir()
    const aoVoltar = () => { if (vivo && document.visibilityState === 'visible') pedir() }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => { vivo = false; document.removeEventListener('visibilitychange', aoVoltar); try { lock?.release() } catch {} }
  }, [ativo])
}

/** Fundo escuro no documento inteiro enquanto a tela está aberta. */
export function useFundoEscuro(cor = '#0b0f17') {
  useEffect(() => {
    const b = document.body, h = document.documentElement
    const ab = b.style.background, ah = h.style.background
    b.style.background = cor; h.style.background = cor
    return () => { b.style.background = ab; h.style.background = ah }
  }, [cor])
}

export function alternarTelaCheia() {
  try {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.()
  } catch {}
}

// ── Som (Web Audio) — precisa de um toque do usuário antes (regra dos navegadores) ──
let ctx: AudioContext | null = null
export function destravarSom(): boolean {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return false
    if (!ctx) ctx = new AC()
    if (ctx!.state === 'suspended') ctx!.resume()
    return true
  } catch { return false }
}
export function bipe(tipo: 'novo' | 'reforco' | 'ok' = 'novo') {
  if (!ctx) return
  const notas = tipo === 'novo' ? [880, 1175, 880] : tipo === 'reforco' ? [1175, 1175, 1175, 1175] : [660, 990]
  const dur = tipo === 'ok' ? 0.09 : 0.12
  const t0 = ctx.currentTime + 0.01
  notas.forEach((f, i) => {
    const o = ctx!.createOscillator(), g = ctx!.createGain()
    o.type = 'square'; o.frequency.value = f
    const ini = t0 + i * (dur + 0.05)
    g.gain.setValueAtTime(0.0001, ini)
    g.gain.exponentialRampToValueAtTime(0.25, ini + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, ini + dur)
    o.connect(g).connect(ctx!.destination)
    o.start(ini); o.stop(ini + dur + 0.02)
  })
}

/**
 * Detecta recado NOVO ou REFORÇADO (repeticoes subiu) entre um poll e outro.
 * Na 1ª carga só registra (não alerta o que já estava lá).
 */
export function useDeteccaoNovos() {
  const ref = useRef<Map<string, number> | null>(null)
  return function detectar(abertos: PalcoChamado[]): { tipo: 'novo' | 'reforco'; chamado: PalcoChamado } | null {
    const ant = ref.current
    ref.current = new Map(abertos.map(c => [c.id, c.repeticoes]))
    if (!ant) return null
    let achou: { tipo: 'novo' | 'reforco'; chamado: PalcoChamado } | null = null
    for (const c of abertos) {
      const r = ant.get(c.id)
      if (r === undefined) return { tipo: 'novo', chamado: c }
      if (c.repeticoes > r) achou = { tipo: 'reforco', chamado: c }
    }
    return achou
  }
}

/** Texto legível de erro das RPCs do palco. */
export function erroPalco(msg: string | undefined): string {
  const m = msg ?? ''
  if (m.includes('pedal_invalido')) return 'Este pedal não vale mais. Peça um novo link ao responsável.'
  if (m.includes('botao_inativo')) return 'Este botão foi desativado.'
  if (m.includes('escolha_invalida')) return 'As opções deste botão mudaram. Tente de novo.'
  if (m.includes('limite_apertos')) return 'Muitos apertos seguidos. Aguarde alguns segundos.'
  return navigator.onLine ? 'Não foi enviado. Toque de novo.' : 'Sem internet — não foi enviado.'
}

export function vibrar(ms: number | number[]) { try { navigator.vibrate?.(ms) } catch {} }

/** "agora", "há 12s", "há 3 min" — usando a hora do servidor (offset). */
export function haQuanto(iso: string, agoraMs: number): string {
  const s = Math.max(0, Math.floor((agoraMs - Date.parse(iso)) / 1000))
  if (s < 5) return 'agora'
  if (s < 60) return `há ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `há ${m} min`
  return `há ${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

export const MAX_BOTOES = 12

/** Teclas aceitas no palco (até 12 botões): 1–9 e 0 (= 10), ou letras A–L (= 1–12).
 *  Pedais USB/Bluetooth programáveis enviam teclas — programe cada pedal numa delas. */
export function posicaoDaTecla(e: KeyboardEvent): number | null {
  const k = e.key?.toLowerCase()
  if (/^[1-9]$/.test(k)) return Number(k)
  if (k === '0') return 10
  const letra = 'abcdefghijkl'.indexOf(k)
  if (k?.length === 1 && letra >= 0) return letra + 1
  return null
}

/** Tecla do evento no formato salvo no banco (KeyboardEvent.key em minúsculas). */
export function normalizarTecla(e: KeyboardEvent): string {
  return (e.key ?? '').toLowerCase()
}

const NOMES_TECLA: Record<string, string> = {
  ' ': 'Espaço', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
  pageup: 'PgUp', pagedown: 'PgDn', enter: 'Enter', tab: 'Tab', home: 'Home', end: 'End',
  insert: 'Ins', delete: 'Del', backspace: '⌫', escape: 'Esc',
}
/** Nome amigável da tecla salva ("f1" → "F1", "a" → "A", " " → "Espaço"). */
export function nomeTecla(k: string): string {
  return NOMES_TECLA[k] ?? (k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1))
}

/** Teclas que o palco usa pra outras coisas e não podem ser atalho de botão. */
export const TECLAS_RESERVADAS = ['escape', 'backspace', 'control', 'alt', 'shift', 'meta', 'capslock']

/** Tecla que aciona o botão: a configurada ou a automática da posição. */
export function teclaDoBotao(b: { posicao: number; tecla?: string | null }): string {
  return b.tecla ? nomeTecla(b.tecla) : teclaDe(b.posicao)
}

/** Qual botão a tecla aperta: 1º a tecla configurada; senão a automática (1–9, 0, A–L)
 *  — mas só pra botão que NÃO tem tecla própria. */
export function botaoDaTecla<T extends { posicao: number; tecla?: string | null }>(botoes: T[], e: KeyboardEvent): T | null {
  const k = normalizarTecla(e)
  const proprio = botoes.find(b => b.tecla && b.tecla === k)
  if (proprio) return proprio
  const p = posicaoDaTecla(e)
  if (!p) return null
  return botoes.find(b => b.posicao === p && !b.tecla) ?? null
}

/** Rótulo da tecla de uma posição (1–9, 0, depois só a letra). */
export function teclaDe(posicao: number): string {
  if (posicao <= 9) return String(posicao)
  if (posicao === 10) return '0'
  return 'abcdefghijkl'[posicao - 1].toUpperCase()
}
