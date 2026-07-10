// Grupos de menu com submenus. Usado tanto pela gaveta (Nav) quanto pelas
// sub-abas dentro de cada página (SubTabs) — assim os dois nunca ficam fora de sincronia.
export type NavSub = { label: string; rota: string }

export const NAV_GROUPS: Record<string, NavSub[]> = {
  equipes:    [{ label:'Equipes', rota:'/equipes' }, { label:'Escalas', rota:'/escalas' }],
  teatro:     [{ label:'Teatros', rota:'/teatro' }, { label:'Atores', rota:'/teatro/atores' }, { label:'Personagens', rota:'/teatro/personagens' }, { label:'Objetos', rota:'/teatro/objetos' }],
  evento:     [{ label:'Locais', rota:'/locais' }, { label:'Ocorrências', rota:'/ocorrencias' }],
  saude:      [{ label:'Atendimentos', rota:'/saude' }, { label:'Fichas Médicas', rota:'/saude/ficha' }, { label:'Medicamentos', rota:'/saude/medicamentos' }, { label:'Configuração', rota:'/saude/config' }],
  financeiro: [{ label:'Pagamentos', rota:'/financeiro' }, { label:'Doações', rota:'/doacoes' }],
  admin:      [{ label:'Usuários', rota:'/admin' }, { label:'Menus', rota:'/admin/menus' }, { label:'Notificações', rota:'/admin/notificacoes' }, { label:'Saúde do Sistema', rota:'/admin/saude-sistema' }, { label:'Comparativo', rota:'/relatorios' }],
}

// Administração organizada por ASSUNTO (o ⚙️ do topo monta o meno a partir daqui).
// A "rota" pode ser uma página de verdade (/admin/menus) OU uma aba dentro da
// tela Usuários (/admin?aba=xxx). Assim páginas e abas convivem no mesmo menu.
export type AdminItem = { label: string; rota: string; icone?: string; emoji?: string }
export type AdminGrupo = { titulo: string; curto?: string; emoji?: string; itens: AdminItem[] }

export const ADMIN_GRUPOS: AdminGrupo[] = [
  { titulo: 'Pessoas e acessos', curto: 'Pessoas', emoji: '👥', itens: [
    { label: 'Usuários',         rota: '/admin?aba=usuarios',     emoji: '👥' },
    { label: 'Tipos de atividade', rota: '/admin?aba=tipos',       emoji: '🪪' },
    { label: 'Liberações',       rota: '/admin?aba=equipes_perm', emoji: '🔓' },
    { label: 'Convite / código', rota: '/admin?aba=msg',          emoji: '🔑' },
  ] },
  { titulo: 'App e conteúdo', curto: 'App', emoji: '📱', itens: [
    { label: 'Menus do app',     rota: '/admin/menus',            emoji: '🧩' },
    { label: 'Aparência',        rota: '/admin?aba=aparencia',    emoji: '🎨' },
    { label: 'Notificações',     rota: '/admin/notificacoes',     emoji: '🔔' },
  ] },
  { titulo: 'Evento', curto: 'Evento', emoji: '📅', itens: [
    { label: 'Eventos',          rota: '/admin?aba=eventos',      emoji: '📅' },
    { label: 'Comparativo',      rota: '/relatorios',             emoji: '📊' },
  ] },
  { titulo: 'Sistema', curto: 'Sistema', emoji: '🛠️', itens: [
    { label: 'Backup',           rota: '/admin?aba=backup',       emoji: '💾' },
    { label: 'Logs',             rota: '/admin?aba=logs',         emoji: '📜' },
    { label: 'Saúde do sistema', rota: '/admin/saude-sistema',    emoji: '🩺' },
  ] },
]
