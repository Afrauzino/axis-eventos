// Catálogo central de permissões por FUNÇÃO (não só por menu).
// Cada área tem funções (ver, criar/editar e especiais). A liberação final é a
// SOMA equipe + pessoa (ver hooks/usePermissao.ts). As páginas checam pode(modulo, acao).

export type PermFuncao = { acao: string; label: string; dica?: string }
export type PermArea   = { modulo: string; label: string; emoji: string; funcoes: PermFuncao[] }

const VER_EDITAR: PermFuncao[] = [
  { acao: 'ver',    label: 'Ver' },
  { acao: 'editar', label: 'Criar/editar' },
]

// Funções configuráveis por área. `editar` implica `ver` (regra do hook).
export const PERM_CATALOGO: PermArea[] = [
  { modulo:'cronograma',   label:'Cronograma',   emoji:'📅', funcoes: VER_EDITAR },
  { modulo:'encontristas', label:'Encontristas', emoji:'🙋', funcoes: VER_EDITAR },
  { modulo:'cadastros',    label:'Cadastros',    emoji:'📝', funcoes: VER_EDITAR },
  { modulo:'ministracoes', label:'Ministrações', emoji:'🎤', funcoes: VER_EDITAR },
  { modulo:'ranking',      label:'Ranking',      emoji:'🏆', funcoes:[{acao:'ver',label:'Ver'},{acao:'votar',label:'Votar'}] },
  { modulo:'correio',      label:'Correio',      emoji:'📬', funcoes:[{acao:'ver',label:'Ver afilhados'},{acao:'checklist',label:'Configurar checklist/padrinhos'}] },
  { modulo:'logistica',    label:'Logística',    emoji:'📦', funcoes:[{acao:'ver',label:'Ver / Imprimir'},{acao:'checklist',label:'Criar/editar checklist'}] },
  { modulo:'equipes',      label:'Equipes',      emoji:'🛡️', funcoes: VER_EDITAR },
  { modulo:'escalas',      label:'Escalas',      emoji:'🗓️', funcoes: VER_EDITAR },
  { modulo:'teatro',       label:'Teatro',       emoji:'🎭', funcoes: VER_EDITAR },
  { modulo:'cozinha',      label:'Cozinha',      emoji:'🍴', funcoes: VER_EDITAR },
  { modulo:'saude',        label:'Saúde',        emoji:'⛑️', funcoes:[{acao:'ver',label:'Ver'},{acao:'editar',label:'Editar fichas/atendimentos'}] },
  { modulo:'medicamentos', label:'Medicamentos', emoji:'💊', funcoes:[{acao:'ver',label:'Ver'},{acao:'editar',label:'Registrar entrega'}] },
  { modulo:'financeiro',   label:'Financeiro',   emoji:'💰', funcoes:[{acao:'ver',label:'Ver'},{acao:'editar',label:'Registrar pagamento'}] },
  { modulo:'doacoes',      label:'Doações',      emoji:'🤝', funcoes:[{acao:'ver',label:'Ver'},{acao:'editar',label:'Registrar'}] },
  { modulo:'midia',        label:'Mídia',        emoji:'🎬', funcoes:[{acao:'ver',label:'Ver'},{acao:'editar',label:'Adicionar'}] },
  { modulo:'cracha',       label:'Crachá',       emoji:'🪪', funcoes:[{acao:'ver',label:'Ver / Imprimir'},{acao:'editar',label:'Configurar'}] },
  { modulo:'locais',       label:'Locais',       emoji:'📍', funcoes: VER_EDITAR },
  { modulo:'ocorrencias',  label:'Ocorrências',  emoji:'⚠️', funcoes:[{acao:'ver',label:'Ver'},{acao:'editar',label:'Registrar/resolver'}] },
  { modulo:'alertas',      label:'Alertas',      emoji:'📢', funcoes:[{acao:'ver',label:'Ver'},{acao:'editar',label:'Criar'}] },
  { modulo:'relatorios',   label:'Relatórios',   emoji:'📊', funcoes:[{acao:'ver',label:'Ver / Exportar'}] },
]

// Menus (visibilidade no menu lateral) — o que aparece pra pessoa/equipe
export type MenuItemCat = { modulo: string; label: string; emoji: string }
export const MENUS_CATALOGO: MenuItemCat[] = [
  { modulo:'menu_inicio',          label:'Início',              emoji:'🏠' },
  { modulo:'menu_atividades',      label:'Minhas Atividades',   emoji:'✅' },
  { modulo:'menu_cronograma',      label:'Cronograma',          emoji:'📅' },
  { modulo:'menu_encontristas',    label:'Encontristas',        emoji:'🙋' },
  { modulo:'menu_cadastros',       label:'Cadastros',           emoji:'📝' },
  { modulo:'menu_ministracoes',    label:'Ministrações',        emoji:'🎤' },
  { modulo:'menu_ranking',         label:'Ranking',             emoji:'🏆' },
  { modulo:'menu_correio',         label:'Correio',             emoji:'📬' },
  { modulo:'menu_logistica',       label:'Logística',           emoji:'📦' },
  { modulo:'menu_midia',           label:'Mídia',               emoji:'🎬' },
  { modulo:'menu_cracha',          label:'Crachá',              emoji:'🪪' },
  { modulo:'menu_equipes',         label:'Equipes & Escalas',   emoji:'🛡️' },
  { modulo:'menu_teatro',          label:'Teatro',              emoji:'🎭' },
  { modulo:'menu_evento',          label:'Evento (Locais/Ocorrências)', emoji:'📍' },
  { modulo:'menu_alertas_lideres', label:'Alertas entre Líderes', emoji:'📢' },
  { modulo:'menu_cozinha',         label:'Cozinha / Cardápio',  emoji:'🍴' },
  { modulo:'menu_saude',           label:'Saúde',               emoji:'⛑️' },
  { modulo:'menu_financeiro',      label:'Financeiro',          emoji:'💰' },
  { modulo:'menu_admin',           label:'Administração',       emoji:'⚙️' },
]
