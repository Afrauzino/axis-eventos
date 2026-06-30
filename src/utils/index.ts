// ── Nome formatado (primeira letra maiúscula) ──────
export function formatName(name: string): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim()
}

// ── Iniciais do nome ───────────────────────────────
export function getInitials(name: string): string {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(n => n.length > 0)
    .map(n => n[0].toUpperCase())
    .slice(0, 2)
    .join('')
}

// ── Formatar data e hora ───────────────────────────
export function fmtBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

export function fmtDataLonga(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

// ── Data/hora local para input datetime-local ──────
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function nowLocalInput(): string {
  return toLocalInput(new Date().toISOString())
}

// ── Verificar menor de idade ───────────────────────
export function isMenor(birthDate: string): boolean {
  if (!birthDate) return false
  const birth = new Date(birthDate)
  const hoje = new Date()
  const idade = hoje.getFullYear() - birth.getFullYear()
  const m = hoje.getMonth() - birth.getMonth()
  return idade < 18 || (idade === 18 && m < 0)
}

// ── Hierarquia de permissões ───────────────────────
export type UserRole =
  | 'visitante' | 'aprovado' | 'encontreiro'
  | 'lider' | 'lider_cozinha' | 'lider_enfermaria' | 'lider_financeiro'
  | 'lider_intercessao' | 'lider_limpeza' | 'lider_logistica' | 'lider_manutencao'
  | 'lider_recepcao' | 'lider_som' | 'lider_teatro' | 'lider_vision'
  | 'financeiro' | 'secretaria' | 'coordenador' | 'pastor' | 'admin'

const ROLE_LEVEL: Record<string, number> = {
  visitante:          0,
  aprovado:           1,
  encontreiro:        2,
  lider:              3,
  lider_cozinha:      3,
  lider_enfermaria:   3,
  lider_financeiro:   3,
  lider_intercessao:  3,
  lider_limpeza:      3,
  lider_logistica:    3,
  lider_manutencao:   3,
  lider_recepcao:     3,
  lider_som:          3,
  lider_teatro:       3,
  lider_vision:       3,
  financeiro:         3,
  secretaria:         3,
  coordenador:        4,
  pastor:             5,
  admin:              5,
}

export function hasRole(userRole: string, minRole: UserRole): boolean {
  const level = ROLE_LEVEL[userRole] ?? 0
  const min   = ROLE_LEVEL[minRole] ?? 0
  return level >= min
}

export function isAdmin(userRole: string): boolean {
  return userRole === 'admin' || userRole === 'pastor'
}

export function isLider(userRole: string): boolean {
  return hasRole(userRole, 'lider')
}

export function canEditPessoas(userRole: string): boolean {
  return userRole === 'admin' || userRole === 'pastor' || userRole === 'secretaria'
}

export function canSeeFinanceiro(userRole: string): boolean {
  return userRole === 'admin' || userRole === 'pastor' || userRole === 'financeiro'
}

export function canSeeSaude(userRole: string): boolean {
  return isAdmin(userRole) || isLider(userRole)
}

// ── Label dos papéis ──────────────────────────────
export const ROLE_LABELS: Record<string, string> = {
  visitante:          'Visitante',
  aprovado:           'Aprovado',
  encontreiro:        'Encontreiro',
  lider:              'Líder Correio',
  lider_cozinha:      'Líder Cozinha',
  lider_enfermaria:   'Líder Enfermaria',
  lider_financeiro:   'Líder Financeiro',
  lider_intercessao:  'Líder Intercessão',
  lider_limpeza:      'Líder Limpeza',
  lider_logistica:    'Líder Logística',
  lider_manutencao:   'Líder Manutenção',
  lider_recepcao:     'Líder Recepção',
  lider_som:          'Líder Som e Equipamentos',
  lider_teatro:       'Líder Teatro',
  lider_vision:       'Líder Vision / Mídia Digital',
  financeiro:         'Financeiro',
  secretaria:         'Secretaria',
  coordenador:        'Ministrante',
  pastor:             'Pastor',
  admin:              'Admin',
}

// ── Status badge config ────────────────────────────
export const STATUS_PESSOA: Record<string, { label: string; badge: string }> = {
  inscrito:   { label: 'Inscrito',   badge: 'badge-info' },
  confirmado: { label: 'Confirmado', badge: 'badge-success' },
  cancelado:  { label: 'Cancelado',  badge: 'badge-danger' },
  concluiu:   { label: 'Concluiu',   badge: 'badge-neutral' },
}

export const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
export const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
