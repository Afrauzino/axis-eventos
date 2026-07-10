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
