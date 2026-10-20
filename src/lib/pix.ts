// Pix "copia e cola" (BR Code estático, padrão EMV do Banco Central) — sem dependências.
// Mesmo código serve no Koinonia: copie este arquivo.

export type PixTipo = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'
export type PixConfig = { chave: string; tipo?: string | null; nome?: string | null; cidade?: string | null }

// Campo EMV: ID (2) + tamanho (2) + valor
function campo(id: string, valor: string): string {
  return id + String(valor.length).padStart(2, '0') + valor
}

// CRC16-CCITT (polinômio 0x1021, início 0xFFFF) — exigido no fim do BR Code
function crc16(txt: string): string {
  let crc = 0xFFFF
  for (let i = 0; i < txt.length; i++) {
    crc ^= txt.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1)
    crc &= 0xFFFF
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Nome/cidade no Pix: sem acento, só letras/números/espaço, tamanho limitado
function limpar(s: string, max: number): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, max)
}

// Normaliza a chave conforme o tipo (telefone vira +55DDDNUMERO, CPF/CNPJ só dígitos…)
export function normalizarChave(chave: string, tipo?: string | null): string {
  const c = (chave || '').trim()
  const dig = c.replace(/\D/g, '')
  switch (tipo) {
    case 'cpf': case 'cnpj': return dig
    case 'email': return c.toLowerCase()
    case 'telefone': return c.startsWith('+') ? '+' + dig : '+55' + dig.replace(/^55(?=\d{10,11}$)/, '')
    default: return c
  }
}

// txid: só letras/números, até 25. Ex.: AXIS + pedaço do id da pessoa + nº da parcela
export function txidDe(personId: string, sufixo = ''): string {
  return ('AXIS' + personId.replace(/[^A-Za-z0-9]/g, '').slice(0, 12) + sufixo).replace(/[^A-Za-z0-9]/g, '').slice(0, 25)
}

export function gerarPixCopiaECola(cfg: PixConfig & { valor?: number | null; txid?: string }): string {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', normalizarChave(cfg.chave, cfg.tipo))
  let payload =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    (cfg.valor && cfg.valor > 0 ? campo('54', cfg.valor.toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', limpar(cfg.nome || 'RECEBEDOR', 25) || 'RECEBEDOR') +
    campo('60', limpar(cfg.cidade || 'BRASIL', 15) || 'BRASIL') +
    campo('62', campo('05', (cfg.txid || '***').slice(0, 25)))
  payload += '6304'
  return payload + crc16(payload)
}

// ── Parcelas: entrada primeiro, depois (N-1) parcelas iguais ───────────────────
export type Plano = { total: number; parcelas: number; entrada: number; valorParcela: number }

export function montarPlano(total: number, parcelas: number, entrada: number): Plano {
  const n = Math.max(1, Math.floor(parcelas || 1))
  if (n === 1) return { total, parcelas: 1, entrada: total, valorParcela: total }
  const e = Math.min(Math.max(0, entrada || 0), total)
  return { total, parcelas: n, entrada: e, valorParcela: Math.round(((total - e) / (n - 1)) * 100) / 100 }
}

// Próximo valor a pagar, dado quanto já foi pago
export function proximoPagamento(plano: Plano, pago: number): { valor: number; numero: number } {
  const falta = Math.max(0, plano.total - pago)
  if (falta <= 0) return { valor: 0, numero: plano.parcelas }
  if (pago < plano.entrada) return { valor: Math.round((plano.entrada - pago) * 100) / 100, numero: 1 }
  const pagasDepois = plano.valorParcela > 0 ? Math.floor((pago - plano.entrada + 0.005) / plano.valorParcela) : 0
  return { valor: Math.min(falta, plano.valorParcela), numero: Math.min(plano.parcelas, 2 + pagasDepois) }
}

export function descreverPlano(p: Plano, fmt: (v: number) => string): string {
  if (p.parcelas === 1) return `à vista (${fmt(p.total)})`
  return `entrada de ${fmt(p.entrada)} + ${p.parcelas - 1}x de ${fmt(p.valorParcela)}`
}

// Link do WhatsApp com a mensagem pronta
export function linkWhatsApp(telefone: string, texto: string): string {
  let d = (telefone || '').replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) d = '55' + d
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`
}
