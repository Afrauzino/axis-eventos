// Regras de notificação — fonte única de tudo que PODE virar notificação.
// O admin liga/desliga cada uma (Administração → Notificações → Regras).
// Cada gatilho no app chama notificarRegra('chave', {...}) e só dispara se ligada.
// Guardado em configuracoes(chave='notif_regras') como JSON { chave: true/false }.
import { carregarConfig, salvarConfig } from './tema'
import { enviarPush } from './push'
import { supabase } from './supabase'

export type Regra = {
  key: string
  area: string
  label: string
  desc: string
  padrao: boolean        // liga por padrão?
  agendado?: boolean     // depende do agendador (cron) — não dispara na hora
  pendente?: boolean     // ainda não tem gatilho ligado (aparece como "em breve")
}

export const AREAS: { id: string; nome: string; emoji: string }[] = [
  { id: 'conta',     nome: 'Inscrição e conta',   emoji: '🙋' },
  { id: 'equipe',    nome: 'Equipes',              emoji: '🛡️' },
  { id: 'escala',    nome: 'Escalas',              emoji: '📋' },
  { id: 'ministracao', nome: 'Ministrações',       emoji: '🎤' },
  { id: 'teatro',    nome: 'Teatro',               emoji: '🎭' },
  { id: 'cronograma',nome: 'Cronograma',           emoji: '📅' },
  { id: 'mural',     nome: 'Mural de gratidão',    emoji: '🙌' },
  { id: 'foto',      nome: 'Carrossel de fotos',   emoji: '📸' },
  { id: 'aviso',     nome: 'Avisos e alertas',     emoji: '📢' },
  { id: 'saude',     nome: 'Saúde e remédios',     emoji: '⚕️' },
  { id: 'ocorrencia',nome: 'Ocorrências',          emoji: '🚨' },
  { id: 'financeiro',nome: 'Financeiro',           emoji: '💰' },
  { id: 'cozinha',   nome: 'Cozinha',              emoji: '🍴' },
  { id: 'aniversario', nome: 'Aniversário',        emoji: '🎂' },
  { id: 'correio',   nome: 'Correio',              emoji: '📬' },
  { id: 'ranking',   nome: 'Ranking',              emoji: '🏆' },
]

export const REGRAS: Regra[] = [
  // A. Inscrição e conta
  { key:'insc_nova',       area:'conta', label:'Nova inscrição aguardando aprovação', desc:'Avisa os admins quando alguém se inscreve.', padrao:true },
  { key:'senha_pedido',    area:'conta', label:'Pedido de recuperação de senha', desc:'Avisa os admins quando alguém não consegue entrar e pede senha nova.', padrao:true },
  { key:'insc_aprovada',   area:'conta', label:'Inscrição aprovada', desc:'Avisa a pessoa que foi aprovada.', padrao:true },
  { key:'insc_recusada',   area:'conta', label:'Inscrição recusada/bloqueada', desc:'Avisa a pessoa que foi recusada ou bloqueada.', padrao:false },
  { key:'acesso_mudou',    area:'conta', label:'Nível de acesso mudou', desc:'Avisa a pessoa quando ganha ou perde permissões.', padrao:true },
  // B. Equipes
  { key:'equipe_entrou',   area:'equipe', label:'Entrou numa equipe', desc:'Avisa quem foi adicionado a uma equipe.', padrao:true },
  { key:'equipe_lider',    area:'equipe', label:'Virou líder/vice', desc:'Avisa quem foi definido como líder ou vice.', padrao:true },
  { key:'equipe_removido', area:'equipe', label:'Removido de uma equipe', desc:'Avisa quem foi tirado de uma equipe.', padrao:false },
  { key:'equipe_novo_membro', area:'equipe', label:'Novo membro na sua equipe', desc:'Avisa o líder quando entra gente na equipe dele.', padrao:true },
  // C. Escalas
  { key:'escala_nova',     area:'escala', label:'Você foi escalado', desc:'Avisa quem foi colocado numa escala.', padrao:true },
  { key:'escala_alterada', area:'escala', label:'Escala alterada', desc:'Avisa quando muda horário/local da escala da pessoa.', padrao:true },
  { key:'escala_cancelada',area:'escala', label:'Escala cancelada', desc:'Avisa quando a escala da pessoa é cancelada.', padrao:true },
  { key:'escala_breve',    area:'escala', label:'Escala começa em breve', desc:'Lembrete antes da hora da escala.', padrao:true, agendado:true },
  { key:'escala_pediu_troca', area:'escala', label:'Pediram troca de escala', desc:'Avisa o líder quando alguém pede troca.', padrao:true },
  { key:'escala_troca_resp',  area:'escala', label:'Pedido de troca respondido', desc:'Avisa quem pediu quando o líder responde.', padrao:true },
  // D. Ministrações
  { key:'min_nova',        area:'ministracao', label:'Você vai ministrar', desc:'Avisa o ministrante escolhido.', padrao:true },
  { key:'min_comecou',     area:'ministracao', label:'Sua ministração começou', desc:'Avisa o ministrante quando o item começa.', padrao:true },
  { key:'min_terminou',    area:'ministracao', label:'Sua ministração terminou', desc:'Avisa o ministrante quando o item termina.', padrao:false },
  { key:'min_alterada',    area:'ministracao', label:'Ministração alterada', desc:'Avisa o ministrante quando algo muda.', padrao:true },
  { key:'min_breve',       area:'ministracao', label:'Ministração começa em breve', desc:'Lembrete antes da hora.', padrao:true, agendado:true },
  // E. Teatro
  { key:'teatro_entrou',   area:'teatro', label:'Entrou no elenco', desc:'Avisa quem foi colocado num teatro.', padrao:true },
  { key:'teatro_removido', area:'teatro', label:'Removido do elenco', desc:'Avisa quem saiu do elenco.', padrao:false },
  { key:'teatro_comecou',  area:'teatro', label:'Seu teatro começou', desc:'Avisa o elenco quando o teatro começa.', padrao:true },
  { key:'teatro_terminou', area:'teatro', label:'Seu teatro terminou', desc:'Avisa o elenco quando o teatro termina.', padrao:false },
  { key:'teatro_breve',    area:'teatro', label:'Teatro começa em breve', desc:'Lembrete antes da hora.', padrao:true, agendado:true },
  // F. Cronograma
  { key:'cron_comecou',    area:'cronograma', label:'Um item começou agora', desc:'Avisa todos quando um bloco começa.', padrao:false },
  { key:'cron_proximo',    area:'cronograma', label:'Próximo item em breve', desc:'Lembrete do próximo bloco pra todos.', padrao:false, agendado:true },
  { key:'cron_alterado',   area:'cronograma', label:'Cronograma alterado', desc:'Avisa todos quando entra/muda um item.', padrao:false },
  // G. Mural
  { key:'mural_marcado',   area:'mural', label:'Marcaram você no mural', desc:'Avisa quem foi mencionado no mural.', padrao:true },
  { key:'mural_novo',      area:'mural', label:'Novo recado no mural', desc:'Avisa todos quando tem post novo.', padrao:false },
  { key:'mural_reacao',    area:'mural', label:'Curtiram/comentaram seu recado', desc:'Avisa o autor do post.', padrao:false },
  // H. Carrossel de fotos
  { key:'foto_nova',       area:'foto', label:'Nova foto no carrossel', desc:'Avisa todos quando sobe foto nova.', padrao:false },
  { key:'foto_curtida',    area:'foto', label:'Curtiram sua foto', desc:'Avisa quem postou a foto.', padrao:false },
  { key:'foto_comentario', area:'foto', label:'Comentaram sua foto', desc:'Avisa quem postou a foto.', padrao:false },
  // I. Avisos e alertas
  { key:'aviso_geral',     area:'aviso', label:'Aviso geral publicado', desc:'Manda o aviso pro público escolhido.', padrao:true },
  { key:'alerta_critico',  area:'aviso', label:'Alerta CRÍTICO', desc:'Alerta que trava a tela do público escolhido.', padrao:true },
  { key:'aviso_lideranca', area:'aviso', label:'Aviso da liderança', desc:'Avisa os destinatários de um aviso de líder.', padrao:true },
  // J. Saúde e remédios
  { key:'remedio_hora',    area:'saude', label:'Hora do remédio', desc:'Lembrete antes da dose pra equipe de saúde.', padrao:true, agendado:true },
  { key:'remedio_entregue',area:'saude', label:'Remédio entregue', desc:'Avisa quando uma dose é marcada como entregue.', padrao:false },
  { key:'ficha_alergia',   area:'saude', label:'Ficha com alergia/restrição', desc:'Avisa a equipe de saúde de nova alergia/restrição.', padrao:true },
  { key:'atendimento_novo',area:'saude', label:'Novo atendimento na enfermaria', desc:'Avisa a equipe de saúde de um atendimento novo.', padrao:true },
  // K. Ocorrências
  { key:'ocorr_nova',      area:'ocorrencia', label:'Nova ocorrência aberta', desc:'Avisa os admins de uma ocorrência nova.', padrao:true },
  { key:'ocorr_grave',     area:'ocorrencia', label:'Ocorrência GRAVE aberta', desc:'Avisa os admins de ocorrência grave/crítica.', padrao:true },
  { key:'ocorr_resolvida', area:'ocorrencia', label:'Ocorrência resolvida', desc:'Avisa quem abriu quando é resolvida.', padrao:false },
  // L. Financeiro
  { key:'fin_pago',        area:'financeiro', label:'Pagamento registrado', desc:'Recibo pra pessoa quando registram um pagamento dela.', padrao:true },
  { key:'fin_a_pagar',     area:'financeiro', label:'Lembrete de valor a pagar', desc:'Lembra quem ainda tem valor em aberto.', padrao:false, agendado:true },
  { key:'doacao_nova',     area:'financeiro', label:'Nova doação registrada', desc:'Avisa os admins de uma doação nova.', padrao:false },
  // M. Cozinha
  { key:'cardapio_dia',    area:'cozinha', label:'Cardápio do dia publicado', desc:'Avisa todos quando o cardápio do dia sai.', padrao:false },
  { key:'cardapio_alterado', area:'cozinha', label:'Cardápio alterado', desc:'Avisa a equipe da cozinha quando muda o cardápio.', padrao:false },
  // N. Aniversário
  { key:'aniv_hoje',       area:'aniversario', label:'Aniversário de alguém hoje', desc:'Avisa líderes e admins.', padrao:true },
  { key:'aniv_feliz',      area:'aniversario', label:'Feliz aniversário (tela de parabéns)', desc:'A pessoa vê a tela de parabéns no dia.', padrao:true },
  // O. Correio
  { key:'correio_checklist', area:'correio', label:'Checklist do afilhado avançou', desc:'Avisa o padrinho quando o checklist muda.', padrao:false },
  // P. Ranking
  { key:'ranking_abriu',   area:'ranking', label:'Votação abriu', desc:'Avisa todos que a votação começou.', padrao:true },
  { key:'ranking_resultado', area:'ranking', label:'Resultado do ranking', desc:'Avisa todos quando a votação encerra.', padrao:true },
]

// ----- estado (cache) -----
let cache: Record<string, boolean> | null = null
let carregando: Promise<Record<string, boolean>> | null = null

export async function carregarRegrasNotif(force = false): Promise<Record<string, boolean>> {
  if (cache && !force) return cache
  if (carregando && !force) return carregando
  carregando = (async () => {
    let map: Record<string, boolean> = {}
    const v = await carregarConfig('notif_regras')
    if (v) { try { map = JSON.parse(v) } catch {} }
    cache = map
    return map
  })()
  const r = await carregando
  carregando = null
  return r
}

const padraoDe = (key: string) => REGRAS.find(r => r.key === key)?.padrao ?? true

// Síncrono (usa cache; se não carregou ainda, usa o padrão da regra).
export function regraLigadaSync(key: string): boolean {
  if (!cache) return padraoDe(key)
  return cache[key] ?? padraoDe(key)
}

export async function regraLigada(key: string): Promise<boolean> {
  await carregarRegrasNotif()
  return regraLigadaSync(key)
}

// Dispara o push SÓ se a regra estiver ligada. Mesmo formato do enviarPush.
export async function notificarRegra(
  key: string,
  opts: Parameters<typeof enviarPush>[0],
): Promise<any> {
  try {
    if (!(await regraLigada(key))) return { pulado: true, regra: key }
    return await enviarPush(opts)
  } catch (e) { return { error: String(e) } }
}

export async function salvarRegrasNotif(map: Record<string, boolean>): Promise<boolean> {
  cache = { ...map }
  return salvarConfig('notif_regras', JSON.stringify(map))
}

// Notifica uma equipe marcada por flag (equipe_saude / equipe_cardapio).
// Se não houver equipe marcada, cai pros admins — nunca fica sem avisar.
export async function notificarEquipeFlag(
  key: string,
  eventId: string,
  flag: 'equipe_saude' | 'equipe_cardapio',
  msg: { title: string; body: string; url?: string },
): Promise<any> {
  let ids: string[] = []
  try { const { data } = await supabase.from('teams').select('id').eq('event_id', eventId).eq(flag, true); ids = (data ?? []).map((t: any) => t.id) } catch {}
  return notificarRegra(key, ids.length
    ? { alerta: { event_id: eventId, target_type: 'team', target_team_ids: ids }, ...msg }
    : { notify_admins: true, ...msg })
}
