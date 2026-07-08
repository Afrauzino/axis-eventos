import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import ConfigCor from './ConfigCor'
import { limparCachePermissoes } from '../hooks/usePermissao'
import { fmtDataHora, isAdmin } from '../utils'
import { invalidarEventoAtivo } from '../hooks/useEvento'
import { registrarLog } from '../lib/audit'
import { useNavigate } from 'react-router-dom'
import { NAV_GROUPS } from '../lib/navGroups'
import { toast } from '../components/Toast'
import Seletor from '../components/Seletor'
import DataHora from '../components/DataHora'
import CardItem from '../components/CardItem'
import FotoAmpliada from '../components/FotoAmpliada'
import { useRegistrarChrome } from '../lib/chrome'
import type { Profile } from '../App'
import EmojiGrid from '../components/EmojiGrid'
import { PERM_CATALOGO, MENUS_CATALOGO } from '../lib/permCatalog'
import CadastroPessoa, { FORM_VAZIO, type PessoaForm } from '../components/CadastroPessoa'
import { carregarConfig, salvarConfig } from '../lib/tema'

type LogRow = { id:string; actor_name:string|null; action:string; entity:string; entity_id:string|null; description:string|null; metadata:any; created_at:string }
const ACAO_LABEL: Record<string,string> = { create:'Criou', update:'Editou', delete:'Excluiu', approve:'Aprovou', reject:'Rejeitou', payment:'Pagamento', medication:'Medicação', login:'Login', export:'Exportou', other:'Ação' }
// Nome amigável das tabelas para o log
const ENTITY_LABEL: Record<string,string> = {
  people:'Pessoa', profiles:'Perfil/Conta', teams:'Equipe', people_teams:'Vínculo de equipe', escalas:'Escala',
  'ministrações':'Ministração', theaters:'Teatro', teatro_cenas:'Cena de teatro', teatro_elenco:'Elenco de teatro',
  cronograma_eventos:'Cronograma', cronograma_tipos:'Tipo de cronograma', financeiro:'Pagamento', doacoes:'Doação',
  saude_fichas:'Ficha médica', med_controlados:'Medicamento', med_agenda:'Agenda de medicação', medicamento_entregas:'Entrega de medicação',
  correio_padrinhos:'Padrinho (Correio)', correio_checklist_itens:'Item de checklist (Correio)', correio_checklist_status:'Checklist (Correio)',
  correio_arquivos:'Arquivo (Correio)', ranking_categorias:'Categoria de ranking', ranking_votos:'Voto', cozinha_cardapios:'Cardápio',
  refeicao_tipos:'Tipo de refeição', locais:'Local', crachas:'Crachá', permissoes:'Permissão', events:'Evento',
  alertas:'Alerta', occurrences:'Ocorrência', midias:'Mídia', arquivos_modulo:'Arquivo', menu_config:'Menu', home_midias:'Carrossel',
}
const nomeEntidade = (e:string) => ENTITY_LABEL[e] ?? e
// Campos técnicos que não interessam mostrar no detalhe
const CAMPOS_OCULTOS = new Set(['id','created_at','updated_at','event_id'])
const valorLegivel = (v:any) => v===null||v===undefined ? '—' : typeof v==='object' ? JSON.stringify(v) : String(v)

// Seções selecionáveis para exportar/importar backup
const SECOES_BACKUP: { key:string; label:string }[] = [
  { key:'pessoas',      label:'Pessoas' },
  { key:'equipes',      label:'Equipes' },
  { key:'ministracoes', label:'Ministrações' },
  { key:'teatros',      label:'Teatros' },
  { key:'locais',       label:'Locais' },
  { key:'financeiro',   label:'Financeiro' },
  { key:'ocorrencias',  label:'Ocorrências' },
  { key:'cronograma',   label:'Cronograma' },
  { key:'ranking',      label:'Ranking' },
]
const TODAS_SECOES = () => Object.fromEntries(SECOES_BACKUP.map(s => [s.key, true])) as Record<string,boolean>

type Usuario = { id:string; user_id:string; name:string|null; full_name?:string|null; user_role:string; email?:string }
type Evento  = { id:string; name:string; status:string; location:string|null; valor_encontrista:number|null; valor_encontreiro:number|null; created_at:string; start_date?:string|null; end_date?:string|null }

const ROLES = ['visitante','aprovado','encontreiro','lider','financeiro','secretaria','coordenador','pastor','admin']
const ROLE_LABEL: Record<string,string> = { visitante:'Visitante', aprovado:'Aprovado', encontreiro:'Encontreiro', lider:'Líder', financeiro:'Financeiro', secretaria:'Secretaria', coordenador:'Coordenador', pastor:'Pastor', admin:'Admin' }

// Cargos oferecidos na aprovação/definição de acesso (o resto do controle é por permissões de equipe/individuais)
const CARGOS_APROVACAO = [
  { role:'visitante',   label:'Visitante' },
  { role:'encontreiro', label:'Encontreiro' },
  { role:'admin',       label:'Administrador' },
]

const TIPOS_PADRÃO = [
  {nome:'Ministração', cor:'#6B46C1', ordem:1},
  {nome:'Teatro',      cor:'#E8821A', ordem:2},
  {nome:'Louvor',      cor:'#D53F8C', ordem:3},
  {nome:'Refeição',    cor:'#2F855A', ordem:4},
  {nome:'Pausa',       cor:'#718096', ordem:5},
  {nome:'Atividade',   cor:'#00A99D', ordem:6},
]

const CORES_TIPO = ['#00A99D','#6B46C1','#E8821A','#2F855A','#D53F8C','#2B6CB0','#C53030','#D69E2E','#718096','#1A202C']

// #18 — mensagem padrão que acompanha o código de acesso (editável no Admin → MSG)
const MSG_CODIGO_PADRAO =
`Olá {nome}! 🙌

Seu código de acesso ao AXIS Eventos é: {codigo}

👉 Acesse direto por este link (já abre no "Primeiro acesso" com o código preenchido):
{link}

Ou faça manual:
1) Abra o app
2) Toque em "Primeiro acesso"
3) Digite o código {codigo}
4) Crie seu e-mail e senha

Qualquer dúvida, chame a gente. Deus abençoe! 🙏`

const montarMsg = (template:string, nome:string, codigo:string) =>
  (template || MSG_CODIGO_PADRAO)
    .split('{nome}').join((nome||'').split(' ')[0] || 'participante')
    .split('{codigo}').join(codigo || '')
    .split('{link}').join(`${window.location.origin}/?codigo=${codigo || ''}`)

export default function Admin({ profile }: { profile?: Profile }) {
  const [aba, setAba]               = useState<'usuarios'|'equipes_perm'|'eventos'|'tipos'|'backup'|'logs'|'aparencia'|'msg'>('usuarios')
  const [logs, setLogs]             = useState<LogRow[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsErro, setLogsErro]     = useState('')
  const [logAberto, setLogAberto]   = useState<string|null>(null)
  const [desfazendo, setDesfazendo] = useState<string|null>(null)
  const [secoesExport, setSecoesExport] = useState<Record<string,boolean>>(TODAS_SECOES())
  const [importArquivo, setImportArquivo] = useState<any|null>(null)   // conteúdo do JSON carregado
  const [secoesImport, setSecoesImport] = useState<Record<string,boolean>>({})
  const [importando, setImportando] = useState(false)
  // Cargos fixos — não editáveis pelo usuário
  const cargos = [
    {role:'admin',              label:'Administrador',                descricao:'Acesso total ao sistema'},
    {role:'financeiro',         label:'Financeiro',                   descricao:'Acesso ao módulo financeiro'},
    {role:'coordenador',        label:'Ministrante',                  descricao:'Ministrante do encontro'},
    {role:'lider',              label:'Líder Correio',                descricao:'Líder da equipe de Correio'},
    {role:'lider_cozinha',      label:'Líder Cozinha',                descricao:'Líder da equipe de Cozinha'},
    {role:'lider_enfermaria',   label:'Líder Enfermaria',             descricao:'Líder da equipe de Enfermaria'},
    {role:'lider_financeiro',   label:'Líder Financeiro',             descricao:'Líder da equipe Financeira'},
    {role:'lider_intercessao',  label:'Líder Intercessão',            descricao:'Líder da equipe de Intercessão'},
    {role:'lider_limpeza',      label:'Líder Limpeza',                descricao:'Líder da equipe de Limpeza'},
    {role:'lider_logistica',    label:'Líder Logística',              descricao:'Líder da equipe de Logística'},
    {role:'lider_manutencao',   label:'Líder Manutenção',             descricao:'Líder da equipe de Manutenção'},
    {role:'lider_recepcao',     label:'Líder Recepção',               descricao:'Líder da equipe de Recepção'},
    {role:'lider_som',          label:'Líder Som e Equipamentos',     descricao:'Líder da equipe de Som'},
    {role:'lider_teatro',       label:'Líder Teatro',                 descricao:'Líder da equipe de Teatro'},
    {role:'lider_vision',       label:'Líder Vision / Mídia Digital', descricao:'Líder da equipe de Mídia'},
    {role:'encontreiro',        label:'Encontreiro',                  descricao:'Membro da equipe'},
    {role:'aprovado',           label:'Aprovado',                     descricao:'Usuário aprovado'},
    {role:'visitante',          label:'Visitante',                    descricao:'Aguardando aprovação'},
  ]
  const [usuarios, setUsuarios]     = useState<Usuario[]>([])
  const [pessoas, setPessoas]       = useState<{
    id:string; name:string; photo_url:string|null; church:string;
    role_type:string; invite_code:string|null; user_id:string|null;
    // from profiles join:
    user_role:string|null; role_status:string|null; profile_name:string|null;
  }[]>([])
  const [gerandoCodigos, setGerandoCodigos] = useState(false)
  const [pessoaDetalhe, setPessoaDetalhe] = useState<typeof pessoas[0]|null>(null)
  useVoltarFecha(!!pessoaDetalhe, () => setPessoaDetalhe(null))
  const [fotoAmpliada, setFotoAmpliada] = useState<string|null>(null)
  const [buscaUser, setBuscaUser]       = useState('')
  const [filtroUserTipo, setFiltroUserTipo] = useState('todos')  // todos | encounterer | worker
  const navigate = useNavigate()
  // #1 — admin edita 100% do cadastro de qualquer pessoa (reusa CadastroPessoa)
  const [editPessoaId, setEditPessoaId] = useState<string|null>(null)
  useVoltarFecha(!!editPessoaId, () => setEditPessoaId(null))
  const [editEventoId, setEditEventoId] = useState<string|undefined>(undefined)
  const [editForm, setEditForm]         = useState<PessoaForm>(FORM_VAZIO)
  const [salvandoEdit, setSalvandoEdit] = useState(false)
  // #18 — mensagem editável que acompanha o código de acesso
  const [msgCodigo, setMsgCodigo] = useState('')
  const [msgSalva, setMsgSalva]   = useState('')
  const [salvandoMsg, setSalvandoMsg] = useState(false)
  // Permissões
  const [permsPessoa, setPermsPessoa]   = useState<any[]>([])
  const [permsAba, setPermsAba]         = useState<'liberacoes'|'acoes'|'menus_visiveis'>('liberacoes')
  const [equipesPerm, setEquipesPerm]   = useState<any[]>([])
  const [equipePermSel, setEquipePermSel] = useState<any|null>(null)
  const [permsEquipe, setPermsEquipe]   = useState<any[]>([])
  const [equipeSubAba, setEquipeSubAba] = useState<'acoes'|'menus'>('acoes')
  const [eventos, setEventos]       = useState<Evento[]>([])
  const [tipos, setTipos]           = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [salvando, setSalvando]     = useState(false)
  const [modalEvento, setModalEvento] = useState(false)
  useVoltarFecha(modalEvento, () => setModalEvento(false))
  const [editandoEvento, setEditandoEvento] = useState<Evento|null>(null)
  const [modalTipo, setModalTipo]   = useState(false)
  useVoltarFecha(modalTipo, () => setModalTipo(false))
  const [editandoTipo, setEditandoTipo] = useState<any>(null)
  const [formTipo, setFormTipo]     = useState({nome:'',cor:'#00A99D',icone:''})
  const [modalDuplicar, setModalDuplicar] = useState<Evento|null>(null)
  useVoltarFecha(!!modalDuplicar, () => setModalDuplicar(null))
  const [nomeDuplicar, setNomeDuplicar] = useState('')
  const [opcoesDup, setOpcoesDup]   = useState({ ministracoes:true, teatros:true, cronograma:true, equipes:true, personagens:true, locais:true, tipos:true })
  const [duplicando, setDuplicando] = useState(false)
  const [formEvento, setFormEvento] = useState({ name:'', location:'', valor_encontrista:'', valor_encontreiro:'', start_date:'', end_date:'' })

  useEffect(() => { carregar() }, [])
  useEffect(() => { carregarConfig('msg_codigo').then(v => { const m = v ?? MSG_CODIGO_PADRAO; setMsgCodigo(m); setMsgSalva(m) }) }, [])

  async function salvarMsgCodigo() {
    setSalvandoMsg(true)
    await salvarConfig('msg_codigo', msgCodigo)
    setMsgSalva(msgCodigo)
    setSalvandoMsg(false)
  }
  function copiarComMsg(nome:string, codigo:string) {
    const txt = montarMsg(msgSalva, nome, codigo)
    if (navigator.clipboard) navigator.clipboard.writeText(txt)
    else { const el=document.createElement('textarea');el.value=txt;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el) }
  }

  // Catálogo de permissões por função (PERM_CATALOGO) e menus (MENUS_CATALOGO) em src/lib/permCatalog.ts

  // ---- PESSOA ----
  async function carregarPermsPessoa(p: any) {
    if (!p?.id) return
    const { data } = await supabase.from('permissoes').select('*').eq('person_id', p.id)
    setPermsPessoa(data ?? [])
  }
  // Define estado explícito: true=liberado, false=bloqueado, null=remove (neutro)
  async function definirPermPessoa(p: any, modulo: string, acao: string, estado: boolean|null) {
    if (!p?.id) return
    const existe = permsPessoa.find(x => x.person_id === p.id && x.modulo === modulo && x.acao === acao)
    if (estado === null) {
      if (existe) {
        await supabase.from('permissoes').delete().eq('id', existe.id)
        setPermsPessoa(prev => prev.filter(x => x.id !== existe.id))
      }
      return
    }
    if (existe) {
      await supabase.from('permissoes').update({ permitido: estado }).eq('id', existe.id)
      setPermsPessoa(prev => prev.map(x => x.id === existe.id ? { ...x, permitido: estado } : x))
    } else {
      const { data: n } = await supabase.from('permissoes').insert({ person_id: p.id, modulo, acao, permitido: estado }).select().single()
      if (n) setPermsPessoa(prev => [...prev, n])
    }
  }
  async function togglePermPessoa(p: any, modulo: string, acao: string, atual: boolean|undefined) {
    limparCachePermissoes()
    await definirPermPessoa(p, modulo, acao, atual ? null : true)
  }
  async function removerPermPessoa(p: any, modulo: string, acao: string) {
    limparCachePermissoes()
    await definirPermPessoa(p, modulo, acao, null)
  }
  const permPessoa = (modulo: string, acao: string): boolean|undefined => {
    const x = permsPessoa.find(p => p.modulo === modulo && p.acao === acao)
    return x ? x.permitido : undefined
  }

  // ---- EQUIPE ----
  async function carregarEquipesPerm() {
    // Evento ativo: usa a lista se já tiver; senão busca direto (a lista pode não ter carregado nesta aba)
    let activeId = eventos.find((ev:any)=>ev.status==='active')?.id
    if (!activeId) {
      const { data: ev } = await supabase.from('events').select('id').eq('status','active').order('created_at',{ascending:false}).limit(1).maybeSingle()
      activeId = ev?.id
    }
    if (!activeId) { setEquipesPerm([]); return }
    const { data } = await supabase.from('teams').select('id,name,color,emoji').eq('event_id', activeId).order('name')
    setEquipesPerm(data ?? [])
  }
  // Rebusca as equipes quando a aba abre (carregarEquipesPerm acha o evento ativo sozinho)
  useEffect(() => { if (aba === 'equipes_perm') carregarEquipesPerm() }, [aba, eventos])
  async function carregarPermsEquipe(team_id: string) {
    const { data } = await supabase.from('permissoes').select('*').eq('team_id', team_id).is('person_id', null).is('role', null)
    setPermsEquipe(data ?? [])
  }
  async function togglePermEquipe(team_id: string, modulo: string, acao: string = 'ver') {
    limparCachePermissoes()
    const existe = permsEquipe.find(x => x.team_id === team_id && x.modulo === modulo && x.acao === acao)
    if (existe) {
      await supabase.from('permissoes').update({ permitido: !existe.permitido }).eq('id', existe.id)
      setPermsEquipe(prev => prev.map(x => x.id === existe.id ? { ...x, permitido: !existe.permitido } : x))
    } else {
      const { data: n } = await supabase.from('permissoes').insert({ team_id, modulo, acao, permitido: true }).select().single()
      if (n) setPermsEquipe(prev => [...prev, n])
    }
  }
  async function removerPermEquipe(team_id: string, modulo: string, acao: string = 'ver') {
    limparCachePermissoes()
    const existe = permsEquipe.find(x => x.team_id === team_id && x.modulo === modulo && x.acao === acao)
    if (existe) {
      await supabase.from('permissoes').delete().eq('id', existe.id)
      setPermsEquipe(prev => prev.filter(x => x.id !== existe.id))
    }
  }
  const permEquipe = (modulo: string, acao: string): boolean => {
    const x = permsEquipe.find(p => p.modulo === modulo && p.acao === acao)
    return x ? x.permitido : false
  }


  async function carregar() {
    setLoading(true)
    // u=profiles, e=events, ti=tipos, pe=people — ORDER MATTERS
    const [u, e, ti] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('events').select('*').order('created_at',{ascending:false}),
      supabase.from('cronograma_tipos').select('*').order('ordem'),
    ])
    setUsuarios(u.data??[])
    setEventos(e.data??[])
    setTipos(ti.data??[])
    // People + profiles join for active event
    const activeId = (e.data??[]).find((ev:any)=>ev.status==='active')?.id
    
    // Always load all profiles (includes admin accounts without people record)
    const { data: allProfs } = await supabase.from('profiles').select('user_id,user_role,role_status,name')
    const profsMap: Record<string,any> = {}
    for (const pr of allProfs??[]) profsMap[pr.user_id] = pr

    if (activeId) {
      const { data: pe } = await supabase
        .from('people')
        .select('id,name,photo_url,church,role_type,invite_code,user_id')
        .eq('event_id', activeId).order('name')
      
      const pessoasComInfo = (pe??[]).map((p:any) => {
        const prof = p.user_id ? profsMap[p.user_id] : null
        return { ...p, user_role:prof?.user_role??null, role_status:prof?.role_status??null, profile_name:prof?.name??null }
      })

      // TODAS as contas (profiles) que não têm cadastro de pessoa neste evento — mostrar todas
      const contasSemCadastro = (allProfs??[]).filter(pr =>
        !(pe??[]).find((p:any)=>p.user_id===pr.user_id)
      ).map(pr => {
        const ehAdmin = ['admin','coordenador','financeiro'].includes(pr.user_role)
        return {
          id: pr.user_id, // usa user_id como id de fallback (conta sem people)
          name: pr.name || '(conta sem nome)', photo_url: null,
          church: ehAdmin ? 'Administrador do sistema' : 'Conta — sem cadastro no evento',
          role_type: ehAdmin ? 'admin' : 'conta', invite_code: null, user_id: pr.user_id,
          user_role: pr.user_role, role_status: pr.role_status, profile_name: pr.name
        }
      })

      setPessoas([...contasSemCadastro, ...pessoasComInfo])
    } else {
      // No active event - just show admin profiles
      const admins = (allProfs??[]).map(pr => ({
        id: pr.user_id, name: pr.name, photo_url: null, church: '',
        role_type: 'admin', invite_code: null, user_id: pr.user_id,
        user_role: pr.user_role, role_status: pr.role_status, profile_name: pr.name
      }))
      setPessoas(admins)
    }
    setLoading(false)
  }

  async function alterarRole(userId:string, role:string) {
    const novoStatus = role === 'visitante' ? 'pending' : 'approved'
    await supabase.from('profiles').update({ user_role: role, role_status: novoStatus }).eq('user_id', userId)
    setPessoas(prev => prev.map(p => p.user_id === userId ? { ...p, user_role: role, role_status: novoStatus } : p))
    carregar()
  }

  // Aprovar com 1 clique — mantém o cargo atual ou usa encontreiro como padrão
  const eventoAtivoId = () => eventos.find(e => e.status === 'active')?.id ?? null

  async function carregarLogs() {
    setLogsLoading(true); setLogsErro('')
    const { data, error } = await supabase.from('audit_logs')
      .select('id,actor_name,action,entity,entity_id,description,metadata,created_at')
      .order('created_at', { ascending: false }).limit(300)
    if (error) {
      const code = (error as any).code ?? ''
      if (code === '42P01' || error.message?.includes('does not exist'))
        setLogsErro('Tabela de logs não existe. Rode o SQL sql/05_audit_logs.sql no Supabase.')
      else setLogsErro('Erro ao carregar logs: ' + error.message)
    } else setLogs(data ?? [])
    setLogsLoading(false)
  }

  // O que mudou (campo: de -> para) a partir do metadata do trigger
  function detalhesLog(l: LogRow): { campo:string; de:any; para:any }[] {
    const m = l.metadata || {}
    if (l.action === 'update' && m.old && m.new) {
      const keys = new Set([...Object.keys(m.old), ...Object.keys(m.new)])
      return [...keys]
        .filter(k => !CAMPOS_OCULTOS.has(k) && JSON.stringify(m.old[k]) !== JSON.stringify(m.new[k]))
        .map(k => ({ campo:k, de:m.old[k], para:m.new[k] }))
    }
    if (l.action === 'delete' && m.old) return Object.entries(m.old).filter(([k])=>!CAMPOS_OCULTOS.has(k)).map(([k,v])=>({ campo:k, de:v, para:undefined }))
    if (l.action === 'create' && m.new) return Object.entries(m.new).filter(([k])=>!CAMPOS_OCULTOS.has(k)).map(([k,v])=>({ campo:k, de:undefined, para:v }))
    return []
  }
  const podeDesfazer = (l: LogRow) => {
    const m = l.metadata || {}
    return (l.action==='delete' && m.old) || (l.action==='update' && m.old && l.entity_id) || (l.action==='create' && l.entity_id)
  }

  // Desfaz a ação usando o metadata (old/new) gravado pelo trigger
  async function desfazerLog(l: LogRow) {
    if (!podeDesfazer(l)) { toast.aviso('Esta ação não tem dados suficientes para desfazer automaticamente.'); return }
    if (!confirm(`Desfazer "${ACAO_LABEL[l.action]??l.action}" em ${nomeEntidade(l.entity)}?\n\nIsso reverte a alteração no banco.`)) return
    setDesfazendo(l.id)
    const m = l.metadata || {}
    try {
      let error:any = null
      if (l.action === 'delete') {
        ({ error } = await supabase.from(l.entity).insert(m.old))
      } else if (l.action === 'update') {
        const { id, created_at, ...rest } = m.old
        ;({ error } = await supabase.from(l.entity).update(rest).eq('id', l.entity_id))
      } else if (l.action === 'create') {
        ({ error } = await supabase.from(l.entity).delete().eq('id', l.entity_id))
      }
      if (error) throw error
      registrarLog({ action:'update', entity:l.entity, entityId:l.entity_id, description:`Desfez ${ACAO_LABEL[l.action]?.toLowerCase()??l.action} em ${nomeEntidade(l.entity)}`, eventId:eventoAtivoId() })
      toast.sucesso('Ação desfeita.')
      carregarLogs()
    } catch (e:any) {
      toast.falha('Não foi possível desfazer.', e)
    }
    setDesfazendo(null)
  }

  async function aprovarPessoa(p: typeof pessoas[0]) {
    if (!p.user_id) return
    const cargo = (p.user_role && p.user_role !== 'visitante') ? p.user_role : 'encontreiro'
    await supabase.from('profiles').update({ user_role: cargo, role_status: 'approved' }).eq('user_id', p.user_id)
    setPessoas(prev => prev.map(x => x.user_id === p.user_id ? { ...x, user_role: cargo, role_status: 'approved' } : x))
    setPessoaDetalhe(prev => prev && prev.user_id === p.user_id ? { ...prev, user_role: cargo, role_status: 'approved' } : prev)
    registrarLog({ action:'approve', entity:'profiles', entityId:p.id, description:`Aprovou o usuário ${p.name} como ${cargo}`, eventId:eventoAtivoId() })
  }

  // Gerar (ou regenerar) código de acesso
  async function gerarNovoCodigo(p: typeof pessoas[0]) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    await supabase.from('people').update({ invite_code: code }).eq('id', p.id)
    setPessoas(prev => prev.map(x => x.id === p.id ? { ...x, invite_code: code } : x))
    setPessoaDetalhe(prev => prev && prev.id === p.id ? { ...prev, invite_code: code } : prev)
  }

  // Trocar tipo: encontrista <-> encontreiro
  async function trocarTipoPessoa(p: typeof pessoas[0]) {
    const novo = p.role_type === 'encounterer' ? 'worker' : 'encounterer'
    const label = novo === 'worker' ? 'Encontreiro' : 'Encontrista'
    if (!confirm(`Transformar "${p.name}" em ${label}?`)) return
    await supabase.from('people').update({ role_type: novo }).eq('id', p.id)
    setPessoas(prev => prev.map(x => x.id === p.id ? { ...x, role_type: novo } : x))
    setPessoaDetalhe(prev => prev && prev.id === p.id ? { ...prev, role_type: novo } : prev)
  }

  // #1 — abrir edição COMPLETA do cadastro (foto + todos os dados)
  async function abrirEdicaoCompleta(p: typeof pessoas[0]) {
    const { data, error } = await supabase.from('people').select('*').eq('id', p.id).maybeSingle()
    if (error || !data) { toast.falha('Não foi possível carregar o cadastro desta pessoa.', error); return }
    setEditEventoId(data.event_id)
    setEditForm({
      ...FORM_VAZIO,
      name: data.name ?? '', phone: data.phone ?? '', contact_phone: data.contact_phone ?? '',
      church: data.church ?? '', ano_encontro: data.ano_encontro ? String(data.ano_encontro) : '',
      sexo: data.sexo ?? '', birth_date: data.birth_date ?? '', cpf: data.cpf ?? '', rg: data.rg ?? '',
      cidade: data.cidade ?? '', estado: data.estado ?? '', endereco: data.endereco ?? '',
      bairro: data.bairro ?? '', cep: data.cep ?? '', role_type: data.role_type ?? 'encounterer',
      team_pref: data.team_pref ?? '', notes: data.notes ?? '', photo_url: data.photo_url ?? null,
    })
    setEditPessoaId(p.id)
  }

  async function salvarEdicaoCompleta() {
    if (!editPessoaId) return
    if (!editForm.name.trim()) { toast.aviso('O nome é obrigatório.'); return }
    setSalvandoEdit(true)
    const { error } = await supabase.from('people').update({
      name: editForm.name,
      phone: (editForm.phone || '').replace(/\D/g,'') || editForm.phone || '',
      contact_phone: editForm.contact_phone || null,
      church: editForm.church || null,
      ano_encontro: editForm.ano_encontro ? Number(editForm.ano_encontro) : null,
      sexo: editForm.sexo || null,
      birth_date: editForm.birth_date || null,
      cpf: editForm.cpf || null,
      rg: editForm.rg || null,
      cidade: editForm.cidade || null,
      estado: editForm.estado || null,
      endereco: editForm.endereco || null,
      bairro: editForm.bairro || null,
      cep: editForm.cep || null,
      notes: editForm.notes || null,
      photo_url: editForm.photo_url || null,
      role_type: editForm.role_type,
      team_pref: editForm.team_pref || null,
    }).eq('id', editPessoaId)
    if (error) { setSalvandoEdit(false); toast.falha('Não foi possível salvar.', error); return }

    // Espelha nome/foto no profile (conta) quando houver login vinculado
    const alvo = pessoas.find(x => x.id === editPessoaId)
    if (alvo?.user_id) {
      await supabase.from('profiles').update({ name: editForm.name }).eq('user_id', alvo.user_id)
    }
    await registrarLog({ action:'update', entity:'people', entityId:editPessoaId, description:`Editou o cadastro de ${editForm.name}` })

    // Atualiza a lista e o detalhe sem recarregar tudo
    setPessoas(prev => prev.map(x => x.id === editPessoaId
      ? { ...x, name: editForm.name, photo_url: editForm.photo_url, church: editForm.church, role_type: editForm.role_type }
      : x))
    setPessoaDetalhe(prev => prev && prev.id === editPessoaId
      ? { ...prev, name: editForm.name, photo_url: editForm.photo_url, church: editForm.church, role_type: editForm.role_type }
      : prev)
    setSalvandoEdit(false)
    setEditPessoaId(null)
    toast.sucesso('Cadastro salvo!')
  }

  // Excluir COMPLETAMENTE — remove de todas as tabelas, como se nunca tivesse existido
  async function excluirCadastro(p: typeof pessoas[0]) {
    if (p.user_role === 'admin') { toast.aviso('Administradores não podem ser excluídos. Rebaixe o cargo antes, se precisar.'); return }
    const msg = p.user_id
      ? `Excluir "${p.name}" de TODOS os sistemas?\n\nSerá removido de teatro, escalas, equipes, saúde, ranking e a conta será bloqueada. Esta ação é permanente.`
      : `Excluir "${p.name}" de TODOS os sistemas?\n\nSerá removido de teatro, escalas, equipes, saúde e ranking. Esta ação é permanente.`
    if (!confirm(msg)) return

    const pid = p.id
    await Promise.all([
      supabase.from('saude_fichas').delete().eq('person_id', pid),
      supabase.from('escalas').delete().eq('person_id', pid),
      supabase.from('people_teams').delete().eq('person_id', pid),
      supabase.from('teatro_elenco').delete().eq('person_id', pid),
      supabase.from('teatro_cenas').delete().eq('person_id', pid),
      supabase.from('teatro_objetos_uso').delete().eq('person_id', pid),
      supabase.from('ranking_votos').delete().eq('votado_id', pid),
      supabase.from('doacoes').delete().eq('person_id', pid),
    ])
    try { await supabase.from('med_agenda').delete().eq('person_id', pid) } catch {}
    try { await supabase.from('med_controlados').delete().eq('person_id', pid) } catch {}
    try { await supabase.from('medicamento_entregas').delete().eq('person_id', pid) } catch {}
    try { await supabase.from('people').update({ referencia_id: null }).eq('referencia_id', pid) } catch {}

    await supabase.from('people').delete().eq('id', pid)

    // Excluir a CONTA de verdade (perfil + login auth) via Edge Function
    if (p.user_id) {
      const { error: fnErr } = await supabase.functions.invoke('admin-delete-user', { body: { target_user_id: p.user_id } })
      if (fnErr) {
        // Fallback: função ainda não publicada — bloqueia a conta e avisa
        await supabase.from('profiles').update({ role_status: 'rejected', user_role: 'visitante' }).eq('user_id', p.user_id)
        toast.aviso('Cadastro removido, mas o login ainda não foi apagado (recurso de servidor pendente). Detalhes em docs/EDGE_FUNCTION_DELETE.md.')
      }
    }
    registrarLog({ action:'delete', entity:'people', entityId:pid, description:`Excluiu completamente o cadastro de ${p.name}`, eventId:eventoAtivoId() })
    setPessoaDetalhe(null)
    setPessoas(prev => prev.filter(x => x.id !== pid))
    toast.sucesso('Cadastro excluído.')
  }

  // Cria a estrutura obrigatória de um evento novo (o que o sistema precisa pra funcionar).
  async function seedNovoEvento(eventId: string) {
    // Equipes padrão (Correio e Saúde marcadas para os módulos correspondentes)
    const equipesPadrao = [
      { name:'Cozinha',     color:'#2F855A' },
      { name:'Intercessão', color:'#6B46C1' },
      { name:'Louvor',      color:'#D53F8C' },
      { name:'Recepção',    color:'#2B6CB0' },
      { name:'Limpeza',     color:'#718096' },
      { name:'Teatro',      color:'#E8821A' },
      { name:'Correio',     color:'#00A99D', equipe_correio:true },
      { name:'Saúde',       color:'#C53030', equipe_saude:true },
    ]
    // Categorias de ranking padrão
    const rankingPadrao = [
      {nome:'Quem mais conversou',                   descricao:'O encontrista mais comunicativo', icone:'chat',          cor:'#48BB78',ordem:1},
      {nome:'O que mais dormiu nas ministrações',     descricao:'Especialista em cochilos',         icone:'bedtime',       cor:'#667EEA',ordem:2},
      {nome:'O que mais resistiu... mas se entregou', descricao:'Teimoso mas abençoado',            icone:'change_circle', cor:'#F6AD55',ordem:3},
      {nome:'O que mais se entregou',                 descricao:'Coração aberto desde o início',    icone:'favorite',      cor:'#FC8181',ordem:4},
      {nome:'O mais quebrado',                        descricao:'Passagem de lágrimas',             icone:'water_drop',    cor:'#63B3ED',ordem:5},
    ]
    // Locais padrão
    const locaisPadrao = [
      {nome:'Cozinha',              tipo:'trabalho'},
      {nome:'Sala de Oração',       tipo:'trabalho'},
      {nome:'Sala de Ministração',  tipo:'trabalho'},
      {nome:'Refeitório',           tipo:'refeicao'},
      {nome:'Banheiro Masculino',   tipo:'sanitario'},
      {nome:'Banheiro Feminino',    tipo:'sanitario'},
      {nome:'Alojamento Masculino', tipo:'alojamento'},
      {nome:'Alojamento Feminino',  tipo:'alojamento'},
    ]
    // Obs: o checklist do Correio NÃO é criado automaticamente — é configurado pelo líder do Correio.
    // cada insert é independente; um erro num módulo não impede os outros
    await Promise.allSettled([
      supabase.from('teams').insert(equipesPadrao.map(t => ({ ...t, event_id:eventId }))),
      supabase.from('ranking_categorias').insert(rankingPadrao.map(c => ({ ...c, event_id:eventId }))),
      supabase.from('locais').insert(locaisPadrao.map(l => ({ ...l, event_id:eventId }))),
    ])
  }

  async function salvarEvento(e:React.FormEvent) {
    e.preventDefault(); setSalvando(true)
    const payload = { name:formEvento.name, location:formEvento.location||null, valor_encontrista:parseFloat(formEvento.valor_encontrista)||0, valor_encontreiro:parseFloat(formEvento.valor_encontreiro)||0, start_date:formEvento.start_date||null, end_date:formEvento.end_date||null }
    if (editandoEvento) {
      await supabase.from('events').update(payload).eq('id',editandoEvento.id)
    } else {
      // Novo evento vira o ativo; os outros ativos passam a inativos (só um ativo por vez)
      await supabase.from('events').update({ status:'inactive' }).eq('status','active')
      const { data: novo } = await supabase.from('events').insert({...payload,status:'active'}).select('id,name').single()
      if (novo) {
        await seedNovoEvento(novo.id)
        registrarLog({ action:'create', entity:'events', entityId:novo.id, description:`Criou o evento ${novo.name} (com estrutura padrão)`, eventId:novo.id })
      }
      invalidarEventoAtivo()
    }
    setModalEvento(false); setSalvando(false); setEditandoEvento(null)
    setFormEvento({name:'',location:'',valor_encontrista:'',valor_encontreiro:'',start_date:'',end_date:''}); carregar()
  }

  // Troca qual evento é o ativo (navegação entre eventos — só em Administração)
  async function tornarEventoAtivo(id:string, nome:string) {
    if (!confirm(`Tornar "${nome}" o evento ativo? Todos passarão a ver este evento.`)) return
    await supabase.from('events').update({ status:'inactive' }).eq('status','active')
    await supabase.from('events').update({ status:'active' }).eq('id', id)
    registrarLog({ action:'update', entity:'events', entityId:id, description:`Tornou "${nome}" o evento ativo`, eventId:id })
    invalidarEventoAtivo()
    carregar()
    toast.sucesso(`"${nome}" agora é o evento ativo. Recarregue as outras telas para ver.`)
  }

  async function finalizarEvento(id:string) {
    if (!confirm('Finalizar este evento? Ele ficará como encerrado.')) return
    await supabase.from('events').update({status:'finished'}).eq('id',id)
    const nome = eventos.find(e=>e.id===id)?.name ?? ''
    registrarLog({ action:'update', entity:'events', entityId:id, description:`Finalizou o evento ${nome}`, eventId:id })
    invalidarEventoAtivo()
    carregar()
  }

  async function excluirEvento(id:string) {
    if (!confirm('ATENÇÃO: Excluir evento apagará TODOS os dados relacionados. Confirma?')) return
    // Delete in order to respect FK constraints
    await supabase.from('escalas').delete().eq('event_id',id)
    await supabase.from('financeiro').delete().eq('event_id',id)
    await supabase.from('doacoes').delete().eq('event_id',id)
    await supabase.from('people_teams').delete().in('team_id',
      (await supabase.from('teams').select('id').eq('event_id',id)).data?.map((t:any)=>t.id)??[]
    )
    await supabase.from('teams').delete().eq('event_id',id)
    await supabase.from('people').delete().eq('event_id',id)
    await supabase.from('cronograma_eventos').delete().eq('event_id',id)
    await supabase.from('ministrações').delete().eq('event_id',id)
    await supabase.from('theaters').delete().eq('event_id',id)
    await supabase.from('locais').delete().eq('event_id',id)
    try { await supabase.from('alertas').delete().eq('event_id',id) } catch {}
    await supabase.from('occurrences').delete().eq('event_id',id)
    const nome = eventos.find(e=>e.id===id)?.name ?? ''
    await supabase.from('events').delete().eq('id',id)
    registrarLog({ action:'delete', entity:'events', entityId:id, description:`Excluiu o evento ${nome} e todos os seus dados` })
    invalidarEventoAtivo()
    carregar()
  }

  async function duplicarEvento() {
    if (!modalDuplicar || !nomeDuplicar.trim()) return
    setDuplicando(true)
    const eid = modalDuplicar.id

    // Criar novo evento
    const { data: novoEvento } = await supabase.from('events').insert({
      name: nomeDuplicar.trim(),
      location: modalDuplicar.location,
      valor_encontrista: modalDuplicar.valor_encontrista,
      valor_encontreiro: modalDuplicar.valor_encontreiro,
      status: 'active',
    }).select().single()

    if (!novoEvento) { setDuplicando(false); return }
    const nid = novoEvento.id

    // Copiar estrutura selecionada
    if (opcoesDup.equipes) {
      const { data: eqs } = await supabase.from('teams').select('*').eq('event_id',eid)
      for (const eq of eqs??[]) {
        await supabase.from('teams').insert({ event_id:nid, name:eq.name, color:eq.color, equipe_saude:eq.equipe_saude })
      }
    }
    if (opcoesDup.locais) {
      const { data: lo } = await supabase.from('locais').select('*').eq('event_id',eid)
      for (const l of lo??[]) {
        await supabase.from('locais').insert({ event_id:nid, nome:l.nome, tipo:l.tipo, capacidade:l.capacidade, observacoes:l.observacoes, icone:l.icone })
      }
    }
    if (opcoesDup.personagens) {
      // Personagens são globais, nada a fazer
    }
    if (opcoesDup.teatros) {
      const { data: te } = await supabase.from('theaters').select('*').eq('event_id',eid)
      for (const t of te??[]) {
        await supabase.from('theaters').insert({ event_id:nid, nome:t.nome, descricao:t.descricao, local:t.local, status:'planejamento', cor:t.cor })
      }
    }
    if (opcoesDup.ministracoes) {
      const { data: mi } = await supabase.from('ministrações').select('*').eq('event_id',eid)
      for (const m of mi??[]) {
        // Shift datas para o futuro (+365 dias)
        const ini = new Date(m.hora_inicio); ini.setFullYear(ini.getFullYear()+1)
        const fim = new Date(m.hora_fim);    fim.setFullYear(fim.getFullYear()+1)
        await supabase.from('ministrações').insert({ event_id:nid, titulo:m.titulo, tema:m.tema, status:'planejado', local:m.local, hora_inicio:ini.toISOString(), hora_fim:fim.toISOString() })
      }
    }
    if (opcoesDup.tipos) {
      const { data: ti } = await supabase.from('cronograma_tipos').select('*')
      // Tipos são globais, nada a fazer
    }

    setDuplicando(false); setModalDuplicar(null); setNomeDuplicar('')
    toast.sucesso(`Evento "${nomeDuplicar}" criado com sucesso!`); carregar()
  }

  async function salvarTipo(e:React.FormEvent) {
    e.preventDefault(); setSalvando(true)
    if (editandoTipo) await supabase.from('cronograma_tipos').update({nome:formTipo.nome,cor:formTipo.cor,icone:formTipo.icone||null}).eq('id',editandoTipo.id)
    else await supabase.from('cronograma_tipos').insert({nome:formTipo.nome,cor:formTipo.cor,icone:formTipo.icone||null,ordem:tipos.length+1})
    setModalTipo(false); setSalvando(false); setEditandoTipo(null); setFormTipo({nome:'',cor:'#00A99D',icone:''}); carregar()
  }

  async function excluirTipo(id:string) {
    const t = tipos.find(x=>x.id===id)
    if (t?.protegido) { toast.aviso('Este tipo tem regras e não pode ser excluído. Você pode alterar nome e cor.'); return }
    if (!confirm('Excluir este tipo?')) return
    await supabase.from('cronograma_tipos').delete().eq('id',id)
    carregar()
  }

  async function restaurarTipos() {
    if (!confirm('Restaurar tipos padrão? Isso não remove os tipos existentes.')) return
    for (const t of TIPOS_PADRÃO) {
      await supabase.from('cronograma_tipos').upsert({nome:t.nome,cor:t.cor,ordem:t.ordem},{onConflict:'nome'})
    }
    carregar()
  }

  async function exportarBackup() {
    const evento = eventos.find(e=>e.status==='active')
    if (!evento) return
    const eid = evento.id
    const sel = secoesExport
    const q = (t:string) => supabase.from(t).select('*').eq('event_id',eid)
    const backup: any = { evento, exportado_em:new Date().toISOString(), secoes:Object.keys(sel).filter(k=>sel[k]) }

    if (sel.pessoas)      backup.pessoas      = (await q('people')).data
    if (sel.equipes) {
      backup.equipes = (await q('teams')).data
      const ids = (backup.equipes ?? []).map((x:any)=>x.id)
      backup.people_teams = ids.length ? (await supabase.from('people_teams').select('*').in('team_id',ids)).data : []
    }
    if (sel.ministracoes) backup.ministracoes = (await q('ministrações')).data
    if (sel.teatros)      backup.teatros      = (await q('theaters')).data
    if (sel.locais)       backup.locais       = (await q('locais')).data
    if (sel.financeiro)   backup.financeiro   = (await q('financeiro')).data
    if (sel.ocorrencias)  backup.ocorrencias  = (await q('occurrences')).data
    if (sel.cronograma)   backup.cronograma   = (await q('cronograma_eventos')).data
    if (sel.ranking) {
      backup.ranking_categorias = (await q('ranking_categorias')).data
      backup.ranking_votos      = (await q('ranking_votos')).data
    }

    const blob = new Blob([JSON.stringify(backup,null,2)],{type:'application/json'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href=url; a.download=`backup-${evento.name}-${new Date().toISOString().slice(0,10)}.json`; a.click()
    URL.revokeObjectURL(url)
    registrarLog({ action:'export', entity:'backup', description:`Exportou backup do evento ${evento.name} (${backup.secoes.join(', ')})`, eventId:evento.id })
  }

  // Lê o arquivo JSON escolhido e pré-seleciona as seções que existem nele
  function carregarArquivoImport(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        setImportArquivo(data)
        const disponiveis: Record<string,boolean> = {}
        SECOES_BACKUP.forEach(s => {
          const tem = s.key==='ranking' ? (data.ranking_categorias?.length || data.ranking_votos?.length)
                    : s.key==='equipes' ? (data.equipes?.length)
                    : (data[s.key]?.length)
          if (tem) disponiveis[s.key] = true
        })
        setSecoesImport(disponiveis)
      } catch { toast.erro('Arquivo inválido: não é um backup JSON válido.') }
    }
    reader.readAsText(file)
  }

  // Importa as seções escolhidas criando um NOVO evento (remapeia os ids antigos → novos)
  async function importarBackup() {
    if (!importArquivo) return
    const nome = prompt('Nome do novo evento que receberá esta importação:', (importArquivo.evento?.name ?? 'Importado') + ' (importado)')
    if (!nome) return
    setImportando(true)
    const sel = secoesImport
    const src = importArquivo

    // 1) cria o evento (inativo, pra não trocar o ativo sem querer)
    const ev = src.evento ?? {}
    const { data: novo, error: eErr } = await supabase.from('events').insert({
      name:nome, location:ev.location??null, valor_encontrista:ev.valor_encontrista??0,
      valor_encontreiro:ev.valor_encontreiro??0, start_date:ev.start_date??null, end_date:ev.end_date??null, status:'inactive',
    }).select('id').single()
    if (eErr || !novo) { setImportando(false); toast.falha('Não foi possível criar o evento.', eErr); return }
    const nid = novo.id

    // remapa id antigo → novo por tabela
    const mapPessoa: Record<string,string> = {}
    const mapEquipe: Record<string,string> = {}
    const mapMin: Record<string,string> = {}

    // helper: insere linhas limpando id/created_at e trocando event_id
    const limpa = (row:any, extra:any={}) => { const { id, created_at, updated_at, ...rest } = row; return { ...rest, event_id:nid, ...extra } }

    try {
      if (sel.pessoas && src.pessoas?.length) {
        for (const p of src.pessoas) {
          const { data } = await supabase.from('people').insert(limpa(p, { user_id:null, invite_code:null, referencia_id:null })).select('id').single()
          if (data) mapPessoa[p.id] = data.id
        }
      }
      if (sel.equipes && src.equipes?.length) {
        for (const t of src.equipes) {
          const { data } = await supabase.from('teams').insert(limpa(t, {
            leader_id: t.leader_id ? mapPessoa[t.leader_id] ?? null : null,
            co_leader_id: t.co_leader_id ? mapPessoa[t.co_leader_id] ?? null : null,
          })).select('id').single()
          if (data) mapEquipe[t.id] = data.id
        }
        // vínculos pessoa-equipe
        for (const v of src.people_teams ?? []) {
          if (mapPessoa[v.person_id] && mapEquipe[v.team_id])
            await supabase.from('people_teams').insert({ person_id:mapPessoa[v.person_id], team_id:mapEquipe[v.team_id] })
        }
      }
      if (sel.locais && src.locais?.length)
        for (const l of src.locais) await supabase.from('locais').insert(limpa(l))
      if (sel.ministracoes && src.ministracoes?.length) {
        for (const m of src.ministracoes) {
          const { data } = await supabase.from('ministrações').insert(limpa(m, { ministrante_id: m.ministrante_id ? mapPessoa[m.ministrante_id] ?? null : null })).select('id').single()
          if (data) mapMin[m.id] = data.id
        }
      }
      if (sel.teatros && src.teatros?.length)
        for (const t of src.teatros) await supabase.from('theaters').insert(limpa(t, { ministracao_id: t.ministracao_id ? mapMin[t.ministracao_id] ?? null : null }))
      if (sel.financeiro && src.financeiro?.length)
        for (const f of src.financeiro) if (mapPessoa[f.person_id]) await supabase.from('financeiro').insert(limpa(f, { person_id:mapPessoa[f.person_id] }))
      if (sel.ocorrencias && src.ocorrencias?.length)
        for (const o of src.ocorrencias) await supabase.from('occurrences').insert(limpa(o, { created_by:null, resolved_by:null }))
      if (sel.cronograma && src.cronograma?.length)
        for (const c of src.cronograma) await supabase.from('cronograma_eventos').insert(limpa(c, { ministracao_id: c.ministracao_id ? mapMin[c.ministracao_id] ?? null : null }))
      if (sel.ranking) {
        for (const rc of src.ranking_categorias ?? []) await supabase.from('ranking_categorias').insert(limpa(rc))
        // votos dependem de pessoa; só importa se a pessoa veio junto
      }
    } catch (err:any) {
      setImportando(false); toast.falha('Importação parcial: algo deu errado no meio.', err); carregar(); return
    }

    registrarLog({ action:'create', entity:'events', entityId:nid, description:`Importou o evento "${nome}" de um backup`, eventId:nid })
    invalidarEventoAtivo()
    setImportando(false); setImportArquivo(null); setSecoesImport({})
    toast.sucesso(`Evento "${nome}" importado! Ele está como Inativo — use "Tornar ativo" na aba Eventos para acessá-lo.`)
    setAba('eventos'); carregar()
  }

  async function gerarCodigos() {
    setGerandoCodigos(true)
    const semCodigo = pessoas.filter(p=>!p.invite_code)
    for (const p of semCodigo) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let code = ''
      for (let i=0;i<8;i++) code += chars[Math.floor(Math.random()*chars.length)]
      await supabase.from('people').update({invite_code:code}).eq('id',p.id)
    }
    setGerandoCodigos(false); carregar()
  }

  // ⚙️ do topo — só a aba Usuários tem busca + filtro; nas outras o ⚙️ some.
  // ⚙️ do topo — navegação (2 níveis de abas) organizada + busca/filtro na aba Usuários
  useRegistrarChrome({
    navegacao: [
      { titulo:'Administração', itens: NAV_GROUPS.admin.map(it => ({ label:it.label, ativo: it.rota==='/admin', onClick:()=>{ if (it.rota!=='/admin') navigate(it.rota) } })) },
      { titulo:'Seção', itens: [
        { label:'Usuários',  ativo:aba==='usuarios',     onClick:()=>setAba('usuarios') },
        { label:'Equipes',   ativo:aba==='equipes_perm', onClick:()=>{setAba('equipes_perm');carregarEquipesPerm()} },
        { label:'Eventos',   ativo:aba==='eventos',      onClick:()=>setAba('eventos') },
        { label:'Tipos',     ativo:aba==='tipos',        onClick:()=>setAba('tipos') },
        { label:'Backup',    ativo:aba==='backup',       onClick:()=>setAba('backup') },
        { label:'Logs',      ativo:aba==='logs',         onClick:()=>{setAba('logs');carregarLogs()} },
        { label:'Aparência', ativo:aba==='aparencia',    onClick:()=>setAba('aparencia') },
        { label:'MSG',       ativo:aba==='msg',          onClick:()=>setAba('msg') },
      ] },
    ],
    ...(aba==='usuarios' ? {
      busca: { value: buscaUser, onChange: setBuscaUser, placeholder: 'Buscar usuário...' },
      grupos: [{ chave:'tipo', label:'Tipo', opcoes:[{value:'todos',label:'Todos'},{value:'encounterer',label:'Encontristas'},{value:'worker',label:'Encontreiros'}] }],
      valores: { tipo: filtroUserTipo },
      onFiltro: (_:string,v:string)=>setFiltroUserTipo(v),
    } : {}),
  }, [aba, buscaUser, filtroUserTipo])

  return (
    <div className="page">
      {/* Abas migradas pro ⚙️ do topo (Administração + Seção) — tela mais limpa */}

      {/* USUÁRIOS */}
      {aba==='usuarios' && (
        <>
          {/* Cabeçalho com stats e ação */}
          <div className="stats-grid mb-3" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
            <div className="stat-card"><div className="stat-label">Encontristas</div><div className="stat-value" style={{color:'#6B46C1'}}>{pessoas.filter(p=>p.role_type==='encounterer').length}</div></div>
            <div className="stat-card"><div className="stat-label">Encontreiros</div><div className="stat-value" style={{color:'var(--primary)'}}>{pessoas.filter(p=>p.role_type==='worker').length}</div></div>
            <div className="stat-card"><div className="stat-label">Com conta</div><div className="stat-value" style={{color:'var(--success)'}}>{pessoas.filter(p=>p.user_id).length}</div></div>
          </div>

          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <button onClick={gerarCodigos} disabled={gerandoCodigos}
              style={{background:'var(--primary-light)',color:'var(--primary)',border:'none',borderRadius:8,padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
              <span className="icon icon-sm">key</span> {gerandoCodigos?'Gerando...':'Gerar códigos'}
            </button>
          </div>
          <p style={{fontSize:11,color:'var(--muted)',marginBottom:14,lineHeight:1.6}}>
            Sem conta: compartilhe o código → pessoa abre o app → <strong>Primeiro acesso</strong> → cria email e senha → entra automaticamente.
          </p>

          {/* Lista única — mesmo padrão visual do Cadastros */}
          {loading ? [1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:72,marginBottom:8,borderRadius:14}}/>) :
          pessoas.length === 0 ? (
            <div className="empty"><p className="empty-desc">Nenhuma pessoa cadastrada no evento ativo.</p></div>
          ) : <>
          {/* PENDENTES - destaque no topo */}
          {pessoas.filter(p=>p.user_id && p.role_status==='pending').length > 0 && (
            <div className="alert-box alert-warning mb-3" style={{display:'flex',alignItems:'center',gap:8}}>
              <span className="icon icon-sm">pending</span>
              <strong>{pessoas.filter(p=>p.user_id && p.role_status==='pending').length} pessoa(s) aguardando aprovação</strong>
              — defina o cargo abaixo para liberar o acesso
            </div>
          )}
          {pessoas
            .filter(p => filtroUserTipo==='todos' || p.role_type===filtroUserTipo)
            .filter(p => !buscaUser || p.name.toLowerCase().includes(buscaUser.toLowerCase()))
            .map(p => {
            const corPessoa = p.role_type==='worker' ? 'var(--primary)' : '#6B46C1'
            const sub = [p.role_type==='worker'?'Encontreiro':'Encontrista', p.church||'Igreja não informada', (p.user_role && p.user_role!=='visitante') ? (cargos.find(cg=>cg.role===p.user_role)?.label ?? p.user_role) : ''].filter(Boolean).join(' · ')
            const direita = p.user_id ? (
              <>
                <button
                  onClick={e=>{e.stopPropagation(); if(p.role_status==='pending') aprovarPessoa(p)}}
                  title={p.role_status==='pending'?'Clique para aprovar':'Ativo'}
                  className={`badge ${p.role_status==='pending'?'badge-warning':'badge-success'}`}
                  style={{fontSize:9,border:'none',cursor:p.role_status==='pending'?'pointer':'default',fontFamily:'inherit'}}>
                  {p.role_status==='pending'?'⏳ Aprovar':'✓ Ativo'}
                </button>
                <Seletor sheet compact titulo="Cargo / Nível de acesso"
                  value={p.user_role??'visitante'} onChange={v=>alterarRole(p.user_id!,v)}
                  opcoes={CARGOS_APROVACAO.map(cg=>({value:cg.role, label:cg.label}))}/>
              </>
            ) : p.invite_code ? (
              <div style={{display:'flex',alignItems:'center',gap:4}}>
                <span style={{fontFamily:'monospace',fontSize:13,fontWeight:800,letterSpacing:'0.1em',color:'var(--primary)',background:'var(--primary-light)',padding:'3px 8px',borderRadius:6}}>{p.invite_code}</span>
                <button onClick={()=>copiarComMsg(p.name, p.invite_code??'')} title="Copiar mensagem com o código"
                  style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:0,fontFamily:'inherit',display:'flex',alignItems:'center'}}>
                  <span className="icon" style={{fontSize:16}}>content_copy</span>
                </button>
              </div>
            ) : (
              <span className="badge badge-neutral" style={{fontSize:9}}>Sem código</span>
            )
            return (
              <CardItem
                key={p.id}
                cor={corPessoa}
                ehPessoa
                fotoUrl={p.photo_url}
                iniciais={p.name.slice(0,2).toUpperCase()}
                titulo={p.name}
                subtitulo={sub}
                direita={direita}
                onVer={()=>{setPessoaDetalhe(p);setPermsAba('liberacoes');carregarPermsPessoa(p)}}
                onFoto={()=>p.photo_url && setFotoAmpliada(p.photo_url)}
              />
            )
          })}
          </>
          }
        </>
      )}

      {/* MODAL DETALHE PESSOA */}
      {pessoaDetalhe && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}
          onClick={e=>e.target===e.currentTarget&&setPessoaDetalhe(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'85vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 16px'}}/>

            {/* Header */}
            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20,paddingBottom:16,borderBottom:'1px solid var(--border)'}}>
              <div style={{width:56,height:56,borderRadius:'50%',background:pessoaDetalhe.role_type==='worker'?'var(--primary-light)':'#F3F0FF',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {pessoaDetalhe.photo_url
                  ? <img src={pessoaDetalhe.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : <span style={{fontWeight:700,fontSize:20,color:pessoaDetalhe.role_type==='worker'?'var(--primary)':'#6B46C1'}}>{pessoaDetalhe.name.slice(0,2).toUpperCase()}</span>
                }
              </div>
              <div style={{flex:1}}>
                <p style={{fontWeight:800,fontSize:17}}>{pessoaDetalhe.name}</p>
                <p style={{fontSize:13,color:'var(--muted)'}}>{pessoaDetalhe.church||'Igreja não informada'}</p>
                <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:99,background:pessoaDetalhe.role_type==='worker'?'var(--primary-light)':'#F3F0FF',color:pessoaDetalhe.role_type==='worker'?'var(--primary)':'#6B46C1'}}>
                  {pessoaDetalhe.role_type==='worker'?'Encontreiro':'Encontrista'}
                </span>
              </div>
            </div>

            {/* Status da conta */}
            {/* Abas do detalhe */}
            <div className="tabs mb-4" style={{flexWrap:'wrap'}}>
              <button type="button" className={`tab ${permsAba==='liberacoes'?'active':''}`} onClick={()=>setPermsAba('liberacoes')}>Conta</button>
              <button type="button" className={`tab ${permsAba==='acoes'?'active':''}`} onClick={()=>{setPermsAba('acoes');if(pessoaDetalhe)carregarPermsPessoa(pessoaDetalhe)}}>Liberações</button>
              <button type="button" className={`tab ${permsAba==='menus_visiveis'?'active':''}`} onClick={()=>{setPermsAba('menus_visiveis');if(pessoaDetalhe)carregarPermsPessoa(pessoaDetalhe)}}>Menus visíveis</button>
            </div>

            {permsAba==='acoes' && (
              <div style={{marginBottom:14}}>
                <p style={{fontSize:12,color:'var(--muted)',marginBottom:10,lineHeight:1.5}}>Liberações extras desta pessoa — <strong>acumulam</strong> com as da(s) equipe(s) dela (união, não substitui). Ex.: <strong>Ver</strong> a lista sem poder <strong>Criar/editar</strong>.</p>
                {PERM_CATALOGO.map(area => (
                  <div key={area.modulo} style={{background:'white',borderRadius:12,boxShadow:'var(--shadow-sm)',marginBottom:8,overflow:'hidden'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,padding:'9px 14px',background:'var(--bg)',borderBottom:'1px solid var(--border)'}}>
                      <span style={{fontSize:17,lineHeight:1}}>{area.emoji}</span>
                      <p style={{fontSize:13,fontWeight:700}}>{area.label}</p>
                    </div>
                    {area.funcoes.map(fn => {
                      const liberado = permPessoa(area.modulo, fn.acao)
                      return (
                        <div key={fn.acao} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 14px',borderBottom:'1px solid var(--border)'}}>
                          <div>
                            <p style={{fontSize:13}}>{fn.label}</p>
                            {liberado===undefined && <p style={{fontSize:10,color:'var(--muted)'}}>Segue a equipe</p>}
                            {liberado===true && <p style={{fontSize:10,color:'var(--success)',fontWeight:700}}>✓ Liberado</p>}
                          </div>
                          <div style={{display:'flex',gap:6}}>
                            <button onClick={()=>togglePermPessoa(pessoaDetalhe,area.modulo,fn.acao,liberado)}
                              title={liberado?'Desativar':'Ativar'}
                              style={{width:40,height:22,borderRadius:11,border:'none',cursor:'pointer',background:liberado?'var(--success)':'var(--border)',transition:'background 0.2s',position:'relative',flexShrink:0}}>
                              <span style={{position:'absolute',top:2,left:liberado?20:2,width:18,height:18,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
                            </button>
                            {liberado!==undefined && (
                              <button onClick={()=>removerPermPessoa(pessoaDetalhe,area.modulo,fn.acao)} title="Voltar ao padrão da equipe"
                                style={{width:22,height:22,borderRadius:6,border:'1px solid var(--border)',background:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                                <span className="icon" style={{fontSize:14,color:'var(--muted)'}}>undo</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

            {permsAba==='menus_visiveis' && (
              <div style={{marginBottom:14}}>
                <p style={{fontSize:12,color:'var(--muted)',marginBottom:10,lineHeight:1.5}}>Menus que esta pessoa pode ver. Ativar mostra o menu. Vazio = segue a equipe.</p>
                <div style={{background:'white',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow-sm)'}}>
                  {MENUS_CATALOGO.map(({modulo,label,emoji})=>{
                    const liberado = permPessoa(modulo,'ver')
                    return (
                      <div key={modulo} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:'1px solid var(--border)'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <span style={{fontSize:17,lineHeight:1}}>{emoji}</span>
                          <div>
                            <p style={{fontSize:13,fontWeight:600}}>{label}</p>
                            {liberado===undefined && <p style={{fontSize:10,color:'var(--muted)'}}>Segue a equipe</p>}
                            {liberado===true && <p style={{fontSize:10,color:'var(--success)',fontWeight:700}}>✓ Menu visível</p>}
                          </div>
                        </div>
                        <div style={{display:'flex',gap:6}}>
                          <button onClick={()=>togglePermPessoa(pessoaDetalhe,modulo,'ver',liberado)}
                            style={{width:40,height:22,borderRadius:11,border:'none',cursor:'pointer',background:liberado?'var(--primary)':'var(--border)',transition:'background 0.2s',position:'relative',flexShrink:0}}>
                            <span style={{position:'absolute',top:2,left:liberado?20:2,width:18,height:18,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
                          </button>
                          {liberado!==undefined && (
                            <button onClick={()=>removerPermPessoa(pessoaDetalhe,modulo,'ver')} title="Voltar ao padrão"
                              style={{width:22,height:22,borderRadius:6,border:'1px solid var(--border)',background:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                              <span className="icon" style={{fontSize:14,color:'var(--muted)'}}>undo</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {permsAba==='liberacoes' && (
            <div style={{background:'var(--bg)',borderRadius:12,padding:'14px 16px',marginBottom:14}}>
              <p style={{fontSize:11,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Conta no sistema</p>
              {pessoaDetalhe.user_id ? (
                <>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <span style={{fontSize:13,color:'var(--text2)'}}>Status</span>
                    <span className={`badge ${pessoaDetalhe.role_status==='pending'?'badge-warning':'badge-success'}`}>
                      {pessoaDetalhe.role_status==='pending'?'⏳ Aguardando aprovação':'✓ Ativo'}
                    </span>
                  </div>
                  <div style={{marginBottom:6}}>
                    <label style={{fontSize:12,color:'var(--muted)',display:'block',marginBottom:4}}>Cargo / Nível de acesso</label>
                    <Seletor titulo="Cargo / Nível de acesso"
                      value={pessoaDetalhe.user_role??'visitante'}
                      onChange={v=>{alterarRole(pessoaDetalhe.user_id!,v);setPessoaDetalhe(prev=>prev?{...prev,user_role:v,role_status:v==='visitante'?'pending':'approved'}:null)}}
                      opcoes={CARGOS_APROVACAO.map(cg=>({value:cg.role, label:cg.label}))}/>
                  </div>
                  {pessoaDetalhe.role_status==='pending' && (
                    <button onClick={()=>aprovarPessoa(pessoaDetalhe)}
                      style={{width:'100%',marginTop:8,padding:'10px',background:'var(--success)',color:'white',border:'none',borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                      <span className="icon icon-sm" style={{color:'white'}}>check_circle</span> Aprovar agora
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p style={{fontSize:13,color:'var(--muted)',marginBottom:10}}>Esta pessoa ainda não criou uma conta.</p>
                  {pessoaDetalhe.invite_code ? (
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:8,background:'white',border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px'}}>
                        <span style={{fontFamily:'monospace',fontSize:18,fontWeight:800,letterSpacing:'0.12em',color:'var(--primary)',flex:1}}>{pessoaDetalhe.invite_code}</span>
                        <button onClick={()=>copiarComMsg(pessoaDetalhe.name, pessoaDetalhe.invite_code??'')}
                          title="Copia a mensagem completa (Admin → MSG) com o código"
                          style={{background:'var(--primary)',color:'white',border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
                          <span className="icon icon-sm" style={{color:'white'}}>content_copy</span> Copiar msg
                        </button>
                      </div>
                      <button onClick={()=>gerarNovoCodigo(pessoaDetalhe)}
                        style={{width:'100%',marginTop:8,padding:'8px',background:'var(--bg)',color:'var(--primary)',border:'1px solid var(--primary)',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                        <span className="icon icon-sm" style={{color:'var(--primary)'}}>autorenew</span> Gerar novo código
                      </button>
                    </div>
                  ) : (
                    <button onClick={()=>gerarNovoCodigo(pessoaDetalhe)} className="btn btn-primary btn-sm">
                      <span className="icon icon-sm">key</span> Gerar código de acesso
                    </button>
                  )}
                </>
              )}
            </div>

            )}

            {/* Permissão exclusiva: Cronograma Inteligente */}
            {(() => {
              const cp = permsPessoa.find(x=>x.modulo==='cronograma_inteligente' && x.acao==='ver')
              const ativo = cp ? cp.permitido : false
              return (
                <div onClick={()=>definirPermPessoa(pessoaDetalhe,'cronograma_inteligente','ver', ativo?null:true)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'white',borderRadius:12,boxShadow:'var(--shadow-sm)',marginBottom:12,cursor:'pointer'}}>
                  <div>
                    <p style={{fontSize:13,fontWeight:700}}>Cronograma Inteligente</p>
                    <p style={{fontSize:11,color:'var(--muted)'}}>Pode iniciar e ajustar o tempo dos blocos</p>
                  </div>
                  <div style={{width:40,height:22,borderRadius:11,background:ativo?'var(--primary)':'var(--border)',position:'relative',flexShrink:0,transition:'background 0.2s'}}>
                    <span style={{position:'absolute',top:2,left:ativo?20:2,width:18,height:18,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
                  </div>
                </div>
              )
            })()}

            {/* #1 — editar 100% do cadastro (foto + todos os dados) — só p/ quem tem cadastro no evento */}
            {(pessoaDetalhe.role_type==='worker' || pessoaDetalhe.role_type==='encounterer') && (
              <button onClick={()=>abrirEdicaoCompleta(pessoaDetalhe)} className="btn btn-primary btn-full" style={{marginBottom:8}}>
                <span className="icon icon-sm">edit</span> Editar cadastro completo
              </button>
            )}

            <button onClick={()=>trocarTipoPessoa(pessoaDetalhe)} className="btn btn-ghost btn-full" style={{marginBottom:8}}>
              <span className="icon icon-sm">swap_horiz</span>
              Transformar em {pessoaDetalhe.role_type==='encounterer'?'Encontreiro':'Encontrista'}
            </button>

            <button className="btn btn-ghost btn-full" onClick={()=>setPessoaDetalhe(null)}>Fechar</button>
            {pessoaDetalhe.user_role !== 'admin' && (
              <button
                onClick={()=>excluirCadastro(pessoaDetalhe)}
                style={{marginTop:8,width:'100%',padding:'10px',background:'var(--danger-bg)',color:'var(--danger)',border:'1px solid var(--danger)',borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                <span className="icon icon-sm">person_remove</span>
                {pessoaDetalhe.user_id ? 'Bloquear e excluir cadastro' : 'Excluir cadastro'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ===== #1 — EDITAR CADASTRO COMPLETO (admin edita tudo) ===== */}
      {editPessoaId && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setEditPessoaId(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>Editar cadastro</span>
              <button onClick={()=>setEditPessoaId(null)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <CadastroPessoa
              form={editForm}
              onChange={setEditForm}
              eventoId={editEventoId}
              showRole={true}
              showStatus={false}
              showTeam={true}
              showReferencia={false}
            />
            <div style={{display:'flex',gap:8,marginTop:18}}>
              <button className="btn btn-primary" style={{flex:1}} onClick={salvarEdicaoCompleta} disabled={salvandoEdit}>{salvandoEdit?'Salvando...':'Salvar alterações'}</button>
              <button className="btn btn-ghost" onClick={()=>setEditPessoaId(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}


      {/* ===== EQUIPES (PERMISSÕES) ===== */}
      {aba==='equipes_perm' && (
        !equipePermSel ? (
          <>
            <p style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>Selecione uma equipe para ver e editar as liberações dela. Isso não altera nada na tela de Equipes.</p>
            {equipesPerm.length === 0
              ? <div className="empty"><p className="empty-title">Nenhuma equipe criada</p></div>
              : equipesPerm.map(eq=>(
                <button key={eq.id} onClick={()=>{setEquipePermSel(eq);carregarPermsEquipe(eq.id)}}
                  style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:'white',border:'none',borderRadius:14,marginBottom:8,boxShadow:'var(--shadow-sm)',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                  <span style={{fontSize:24}}>{eq.emoji??'👥'}</span>
                  <div style={{flex:1}}>
                    <p style={{fontWeight:700,fontSize:14}}>{eq.name}</p>
                    <p style={{fontSize:11,color:'var(--muted)'}}>Ver liberações desta equipe</p>
                  </div>
                  <span className="icon" style={{color:'var(--muted)'}}>chevron_right</span>
                </button>
              ))
            }
          </>
        ) : (
          <>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
              <button onClick={()=>{setEquipePermSel(null);setPermsEquipe([])}} style={{background:'none',border:'none',cursor:'pointer',padding:4,display:'flex',alignItems:'center'}}>
                <span className="icon">arrow_back</span>
              </button>
              <span style={{fontSize:20}}>{equipePermSel.emoji??'👥'}</span>
              <p style={{fontWeight:700,fontSize:16}}>{equipePermSel.name}</p>
            </div>
            <div style={{background:'var(--primary-light)',borderRadius:10,padding:'10px 14px',marginBottom:12}}>
              <p style={{fontSize:12,color:'var(--primary)',fontWeight:600}}>Liberações aqui acumulam com as individuais de cada membro (união).</p>
            </div>
            <div className="tabs mb-3">
              <button className={`tab ${equipeSubAba==='acoes'?'active':''}`} onClick={()=>setEquipeSubAba('acoes')}>Liberações</button>
              <button className={`tab ${equipeSubAba==='menus'?'active':''}`} onClick={()=>setEquipeSubAba('menus')}>Menus visíveis</button>
            </div>
            {equipeSubAba==='acoes' ? (
              PERM_CATALOGO.map(area => (
                <div key={area.modulo} style={{background:'white',borderRadius:12,boxShadow:'var(--shadow-sm)',marginBottom:8,overflow:'hidden'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'9px 16px',background:'var(--bg)',borderBottom:'1px solid var(--border)'}}>
                    <span style={{fontSize:17,lineHeight:1}}>{area.emoji}</span>
                    <p style={{fontSize:13,fontWeight:700}}>{area.label}</p>
                  </div>
                  {area.funcoes.map(fn => {
                    const perm = permsEquipe.find(x=>x.modulo===area.modulo && x.acao===fn.acao)
                    const liberado = perm ? perm.permitido : false
                    return (
                      <div key={fn.acao} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',borderBottom:'1px solid var(--border)'}}>
                        <p style={{fontSize:13}}>{fn.label}</p>
                        <div style={{display:'flex',gap:6,alignItems:'center'}}>
                          <button onClick={()=>togglePermEquipe(equipePermSel.id,area.modulo,fn.acao)}
                            style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',background:liberado?'var(--primary)':'var(--border)',transition:'background 0.2s',position:'relative',flexShrink:0}}>
                            <span style={{position:'absolute',top:3,left:liberado?23:3,width:18,height:18,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
                          </button>
                          {perm && (
                            <button onClick={()=>removerPermEquipe(equipePermSel.id,area.modulo,fn.acao)} title="Remover"
                              style={{width:24,height:24,borderRadius:6,border:'1px solid var(--border)',background:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                              <span className="icon" style={{fontSize:14,color:'var(--muted)'}}>delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            ) : (
              <div style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',overflow:'hidden'}}>
                {MENUS_CATALOGO.map(({modulo,label,emoji})=>{
                  const perm = permsEquipe.find(x=>x.modulo===modulo && x.acao==='ver')
                  const liberado = perm ? perm.permitido : false
                  return (
                    <div key={modulo} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px',borderBottom:'1px solid var(--border)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:17,lineHeight:1}}>{emoji}</span>
                        <p style={{fontSize:13,fontWeight:600}}>{label}</p>
                      </div>
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <button onClick={()=>togglePermEquipe(equipePermSel.id,modulo,'ver')}
                          style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',background:liberado?'var(--primary)':'var(--border)',transition:'background 0.2s',position:'relative',flexShrink:0}}>
                          <span style={{position:'absolute',top:3,left:liberado?23:3,width:18,height:18,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
                        </button>
                        {perm && (
                          <button onClick={()=>removerPermEquipe(equipePermSel.id,modulo,'ver')} title="Remover"
                            style={{width:24,height:24,borderRadius:6,border:'1px solid var(--border)',background:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <span className="icon" style={{fontSize:14,color:'var(--muted)'}}>delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )
      )}

      {/* EVENTOS */}
      {aba==='eventos' && (
        <>
          {loading ? [1,2].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:8,borderRadius:14}}/>) :
          eventos.map(ev=>(
            <div key={ev.id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,padding:'14px 16px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <p style={{fontWeight:700,fontSize:15}}>{ev.name}</p>
                <span className={`badge ${ev.status==='active'?'badge-success':'badge-neutral'}`} style={{fontSize:10}}>{ev.status==='active'?'Ativo':ev.status==='finished'?'Encerrado':'Inativo'}</span>
              </div>
              {ev.location && <p style={{fontSize:12,color:'var(--muted)',marginBottom:8}}>{ev.location}</p>}
              <p style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>Encontrista: R$ {ev.valor_encontrista??0} · Encontreiro: R$ {ev.valor_encontreiro??0}</p>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>{setEditandoEvento(ev);setFormEvento({name:ev.name,location:ev.location??'',valor_encontrista:String(ev.valor_encontrista??0),valor_encontreiro:String(ev.valor_encontreiro??0),start_date:ev.start_date??'',end_date:ev.end_date??''});setModalEvento(true)}}>
                  <span className="icon icon-sm">edit</span> Editar
                </button>
                <button className="btn btn-sm" style={{background:'#EBF8FF',color:'#2B6CB0',border:'none'}} onClick={()=>{setModalDuplicar(ev);setNomeDuplicar(ev.name+' (cópia)')}}>
                  <span className="icon icon-sm">content_copy</span> Duplicar
                </button>
                {ev.status!=='active' && (
                  <button className="btn btn-sm" style={{background:'var(--success-bg)',color:'var(--success)',border:'none'}} onClick={()=>tornarEventoAtivo(ev.id, ev.name)}>
                    <span className="icon icon-sm">play_circle</span> Tornar ativo
                  </button>
                )}
                {ev.status==='active' && (
                  <button className="btn btn-sm" style={{background:'var(--warning-bg)',color:'var(--warning)',border:'none'}} onClick={()=>finalizarEvento(ev.id)}>
                    <span className="icon icon-sm">check_circle</span> Finalizar
                  </button>
                )}
                <button className="btn btn-sm" style={{background:'var(--danger-bg)',color:'var(--danger)',border:'none'}} onClick={()=>excluirEvento(ev.id)}>
                  <span className="icon icon-sm">delete</span> Excluir
                </button>
              </div>
            </div>
          ))}
          <button className="fab" onClick={()=>{setEditandoEvento(null);setFormEvento({name:'',location:'',valor_encontrista:'',valor_encontreiro:'',start_date:'',end_date:''});setModalEvento(true)}}><span className="icon">add</span></button>
        </>
      )}

      {/* TIPOS */}
      {aba==='tipos' && (
        <>
          <p style={{fontSize:13,color:'var(--text2)',marginBottom:14}}>Tipos de atividade do cronograma com cores personalizáveis.</p>
          {tipos.map(t=>(
            <div key={t.id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,display:'flex',alignItems:'center',gap:12,padding:'12px 14px'}}>
              <div style={{width:36,height:36,borderRadius:10,background:t.cor,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,lineHeight:1}}>
                {t.icone && /\p{Emoji}/u.test(t.icone) ? t.icone : ''}
              </div>
              <p style={{flex:1,fontWeight:600,fontSize:14}}>{t.nome}{t.protegido && <span style={{marginLeft:6,fontSize:10,color:'var(--muted)',fontWeight:600}}>🔒 protegido</span>}</p>
              <button onClick={()=>{setEditandoTipo(t);setFormTipo({nome:t.nome,cor:t.cor,icone:t.icone??''});setModalTipo(true)}} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,padding:'5px 10px',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'inherit'}}>Editar</button>
              {!t.protegido && <button onClick={()=>excluirTipo(t.id)} style={{background:'var(--danger-bg)',color:'var(--danger)',border:'none',borderRadius:8,padding:'5px 10px',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'inherit'}}>Excluir</button>}
            </div>
          ))}
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button className="btn btn-outline btn-sm" onClick={restaurarTipos}>Restaurar padrões</button>
          </div>
          <button className="fab" onClick={()=>{setEditandoTipo(null);setFormTipo({nome:'',cor:'#00A99D',icone:''});setModalTipo(true)}}><span className="icon">add</span></button>
        </>
      )}

      {/* LOGS / AUDITORIA */}
      {aba==='logs' && (
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.6}}>Histórico das ações realizadas no sistema (últimas 300).</p>
            <button className="btn btn-outline btn-sm" onClick={carregarLogs}><span className="icon icon-sm">refresh</span> Atualizar</button>
          </div>
          {logsErro && <div className="alert-box alert-error mb-3">{logsErro}</div>}
          {logsLoading ? [1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:56,marginBottom:8,borderRadius:12}}/>) :
           (!logsErro && logs.length===0) ? <div className="empty"><p className="empty-desc">Nenhuma ação registrada ainda. Rode sql/16_audit_triggers.sql para registrar tudo automaticamente.</p></div> :
           logs.map(l => {
            const acaoCor = l.action==='delete'?'var(--danger)':l.action==='create'?'var(--success)':'var(--primary)'
            const mudancas = detalhesLog(l)
            const aberto = logAberto===l.id
            return (
            <div key={l.id} style={{background:'white',borderRadius:12,boxShadow:'var(--shadow-sm)',marginBottom:8,padding:'11px 14px',borderLeft:`3px solid ${acaoCor}`}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                <span style={{fontSize:11,fontWeight:800,color:acaoCor,textTransform:'uppercase'}}>{ACAO_LABEL[l.action]??l.action}</span>
                <span style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{nomeEntidade(l.entity)}</span>
                <span style={{flex:1}}/>
                <span style={{fontSize:11,color:'var(--muted)'}}>{fmtDataHora(l.created_at)}</span>
              </div>
              {l.description && <p style={{fontSize:13,color:'var(--text)'}}>{l.description}</p>}
              <p style={{fontSize:11,color:'var(--muted)',marginTop:2}}>
                por <strong>{l.actor_name || 'desconhecido'}</strong>{l.entity_id ? ` · id ${String(l.entity_id).slice(0,8)}` : ''}
              </p>

              {/* Ações: ver detalhes / desfazer */}
              <div style={{display:'flex',gap:8,marginTop:8}}>
                {mudancas.length>0 && (
                  <button className="btn btn-ghost btn-sm" onClick={()=>setLogAberto(aberto?null:l.id)}>
                    <span className="icon icon-sm">{aberto?'expand_less':'expand_more'}</span> {aberto?'Ocultar':'Detalhes'} ({mudancas.length})
                  </button>
                )}
                {podeDesfazer(l) && (
                  <button className="btn btn-sm" style={{background:'var(--warning-bg)',color:'var(--warning)',border:'1px solid var(--warning)'}} onClick={()=>desfazerLog(l)} disabled={desfazendo===l.id}>
                    <span className="icon icon-sm">undo</span> {desfazendo===l.id?'Desfazendo...':'Desfazer'}
                  </button>
                )}
              </div>

              {/* Detalhes do que mudou */}
              {aberto && mudancas.length>0 && (
                <div style={{marginTop:8,background:'var(--bg)',borderRadius:8,padding:'8px 10px'}}>
                  {mudancas.map((c,i)=>(
                    <div key={i} style={{fontSize:12,padding:'3px 0',borderBottom:i<mudancas.length-1?'1px solid var(--border)':'none'}}>
                      <span style={{fontWeight:700,color:'var(--text2)'}}>{c.campo}: </span>
                      {l.action==='update'
                        ? <span><span style={{color:'var(--danger)',textDecoration:'line-through'}}>{valorLegivel(c.de)}</span> → <span style={{color:'var(--success)'}}>{valorLegivel(c.para)}</span></span>
                        : <span style={{color:'var(--text)'}}>{valorLegivel(l.action==='delete'?c.de:c.para)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}

      {/* BACKUP — exportar/importar seletivo */}
      {aba==='backup' && (
        <div>
          {/* EXPORTAR */}
          <div className="section-label mb-2">Exportar backup</div>
          <p style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>Escolha o que exportar do evento ativo. Gera um arquivo JSON.</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
            {SECOES_BACKUP.map(s => {
              const on = secoesExport[s.key]
              return (
                <button key={s.key} onClick={()=>setSecoesExport(p=>({...p,[s.key]:!p[s.key]}))}
                  style={{padding:'7px 12px',borderRadius:20,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600,
                    border:on?'2px solid var(--primary)':'1px solid var(--border)',background:on?'var(--primary-light)':'white',color:on?'var(--primary)':'var(--text2)',display:'flex',alignItems:'center',gap:5}}>
                  <span className="icon" style={{fontSize:15}}>{on?'check_box':'check_box_outline_blank'}</span>{s.label}
                </button>
              )
            })}
          </div>
          <button className="btn btn-primary btn-full mb-2" onClick={exportarBackup} disabled={!Object.values(secoesExport).some(Boolean)}>
            <span className="icon icon-sm">download</span> Exportar selecionados
          </button>
          <div className="alert-box alert-info mb-4" style={{fontSize:12}}>Não inclui logs/auditoria (histórico é imutável e separado).</div>

          {/* IMPORTAR */}
          <div className="section-label mb-2">Importar backup</div>
          <p style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>Carregue um arquivo de backup. Ele cria um <strong>novo evento (inativo)</strong> com o que você escolher — sem tocar nos eventos atuais.</p>
          <label className="btn btn-outline btn-full mb-3" style={{cursor:'pointer'}}>
            <span className="icon icon-sm">upload_file</span> {importArquivo ? 'Trocar arquivo' : 'Escolher arquivo JSON'}
            <input type="file" accept="application/json,.json" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0]; if(f) carregarArquivoImport(f); e.target.value=''}}/>
          </label>
          {importArquivo && (
            <>
              <p style={{fontSize:12,color:'var(--muted)',marginBottom:8}}>Backup de <strong>{importArquivo.evento?.name ?? '—'}</strong>. Selecione o que importar:</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
                {SECOES_BACKUP.filter(s => {
                  return s.key==='ranking' ? (importArquivo.ranking_categorias?.length || importArquivo.ranking_votos?.length)
                       : (importArquivo[s.key]?.length)
                }).map(s => {
                  const on = secoesImport[s.key]
                  return (
                    <button key={s.key} onClick={()=>setSecoesImport(p=>({...p,[s.key]:!p[s.key]}))}
                      style={{padding:'7px 12px',borderRadius:20,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600,
                        border:on?'2px solid var(--primary)':'1px solid var(--border)',background:on?'var(--primary-light)':'white',color:on?'var(--primary)':'var(--text2)',display:'flex',alignItems:'center',gap:5}}>
                      <span className="icon" style={{fontSize:15}}>{on?'check_box':'check_box_outline_blank'}</span>{s.label}
                    </button>
                  )
                })}
              </div>
              <button className="btn btn-primary btn-full" onClick={importarBackup} disabled={importando || !Object.values(secoesImport).some(Boolean)}>
                {importando ? 'Importando...' : 'Importar como novo evento'}
              </button>
            </>
          )}
        </div>
      )}

      {/* APARÊNCIA — cor principal */}
      {aba==='aparencia' && (
        <div>
          <ConfigCor />
        </div>
      )}

      {/* #18 — MSG: mensagem que acompanha o código de acesso */}
      {aba==='msg' && (
        <div>
          <p style={{fontSize:13,color:'var(--muted)',marginBottom:12,lineHeight:1.6}}>
            Esta é a mensagem copiada quando você toca em <b>“Copiar msg”</b> no código de acesso de uma pessoa
            (Usuários → pessoa sem conta). Cole no WhatsApp/onde quiser. Pode ter textos, instruções e links.
          </p>
          <div className="alert-box mb-3" style={{fontSize:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px'}}>
            <b>Atalhos:</b> use <code>{'{codigo}'}</code> onde entra o código e <code>{'{nome}'}</code> onde entra o primeiro nome da pessoa.
          </div>
          <textarea className="form-textarea" value={msgCodigo} onChange={e=>setMsgCodigo(e.target.value)}
            style={{minHeight:220,fontFamily:'inherit',fontSize:14,lineHeight:1.6}} placeholder="Escreva a mensagem..."/>
          <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
            <button className="btn btn-primary" onClick={salvarMsgCodigo} disabled={salvandoMsg||msgCodigo===msgSalva}>
              {salvandoMsg?'Salvando...':(msgCodigo===msgSalva?'Salvo':'Salvar mensagem')}
            </button>
            <button className="btn btn-ghost" onClick={()=>setMsgCodigo(MSG_CODIGO_PADRAO)}>Restaurar padrão</button>
          </div>
          <p className="section-label" style={{marginTop:20,marginBottom:6}}>Prévia (código de exemplo)</p>
          <div style={{background:'white',border:'1px solid var(--border)',borderRadius:12,padding:14,whiteSpace:'pre-wrap',fontSize:14,lineHeight:1.6,color:'var(--text)'}}>
            {montarMsg(msgCodigo, 'Maria Silva', 'AB12CD')}
          </div>
        </div>
      )}

      {/* Modal evento */}
      {modalEvento && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModalEvento(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editandoEvento?'Editar evento':'Novo evento'}</span>
              <button onClick={()=>setModalEvento(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <form onSubmit={salvarEvento}>
              <div className="form-group"><label className="form-label">Nome do evento <span className="req">*</span></label>
                <input className="form-input" value={formEvento.name} onChange={e=>setFormEvento(f=>({...f,name:e.target.value}))} required placeholder="Ex: Encontro com Deus 2027"/>
              </div>
              <div className="form-group"><label className="form-label">Local</label>
                <input className="form-input" value={formEvento.location} onChange={e=>setFormEvento(f=>({...f,location:e.target.value}))} placeholder="Ex: Sítio do João"/>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Data início</label>
                  <DataHora modo="date" value={formEvento.start_date} onChange={v=>setFormEvento(f=>({...f,start_date:v}))}/>
                </div>
                <div className="form-group"><label className="form-label">Data fim</label>
                  <DataHora modo="date" value={formEvento.end_date} onChange={v=>setFormEvento(f=>({...f,end_date:v}))}/>
                </div>
              </div>
              <p style={{fontSize:11,color:'var(--muted)',marginTop:-8,marginBottom:12}}>As datas são usadas para o agendamento automático de medicamentos controlados.</p>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Valor Encontrista (R$)</label>
                  <input className="form-input" type="number" step="0.01" value={formEvento.valor_encontrista} onChange={e=>setFormEvento(f=>({...f,valor_encontrista:e.target.value}))}/>
                </div>
                <div className="form-group"><label className="form-label">Valor Encontreiro (R$)</label>
                  <input className="form-input" type="number" step="0.01" value={formEvento.valor_encontreiro} onChange={e=>setFormEvento(f=>({...f,valor_encontreiro:e.target.value}))}/>
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Salvando...':editandoEvento?'Salvar':'Criar evento'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal duplicar evento */}
      {modalDuplicar && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModalDuplicar(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <p style={{fontSize:17,fontWeight:700,marginBottom:4}}>Duplicar evento</p>
              <p style={{fontSize:12,color:'var(--muted)'}}>Copiando estrutura de: {modalDuplicar.name}</p>
            </div>

            <div className="form-group"><label className="form-label">Nome do novo evento <span className="req">*</span></label>
              <input className="form-input" value={nomeDuplicar} onChange={e=>setNomeDuplicar(e.target.value)} placeholder="Ex: Encontro com Deus 2027"/>
            </div>

            <p style={{fontSize:13,fontWeight:700,marginBottom:10}}>O que copiar:</p>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
              {[
                {key:'equipes',      label:'Equipes',      desc:'Nomes e cores das equipes'},
                {key:'locais',       label:'Locais',       desc:'Salas, alojamentos e espaços'},
                {key:'ministracoes', label:'Ministrações', desc:'Títulos e temas (sem datas)'},
                {key:'teatros',      label:'Teatros',      desc:'Nomes e descrições das peças'},
                {key:'personagens',  label:'Personagens',  desc:'Biblioteca global (sempre copiada)'},
                {key:'tipos',        label:'Tipos',        desc:'Tipos do cronograma (sempre copiados)'},
              ].map(({key,label,desc})=>(
                <button key={key} type="button" onClick={()=>setOpcoesDup(o=>({...o,[key]:!(o as any)[key]}))} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',textAlign:'left',border:`2px solid ${(opcoesDup as any)[key]?'var(--primary)':'var(--border)'}`,background:(opcoesDup as any)[key]?'var(--primary-light)':'white'}}>
                  <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${(opcoesDup as any)[key]?'var(--primary)':'var(--border)'}`,background:(opcoesDup as any)[key]?'var(--primary)':'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {(opcoesDup as any)[key] && <span className="icon" style={{fontSize:14,color:'white'}}>check</span>}
                  </div>
                  <div>
                    <p style={{fontWeight:600,fontSize:14,color:(opcoesDup as any)[key]?'var(--primary-dark)':'var(--text)'}}>{label}</p>
                    <p style={{fontSize:11,color:'var(--muted)'}}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="alert-box alert-info mb-3">Não serão copiados: encontristas, encontreiros, pagamentos, fichas de saúde, atendimentos e histórico.</div>
            <button className="btn btn-primary btn-full" onClick={duplicarEvento} disabled={duplicando||!nomeDuplicar.trim()}>
              {duplicando?'Criando evento...':'Criar novo evento'}
            </button>
          </div>
        </div>
      )}

      {/* Modal tipo */}
      {modalTipo && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModalTipo(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editandoTipo?'Editar tipo':'Novo tipo'}</span>
              <button onClick={()=>setModalTipo(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <form onSubmit={salvarTipo}>
              <div className="form-group"><label className="form-label">Nome <span className="req">*</span></label>
                <input className="form-input" value={formTipo.nome} onChange={e=>setFormTipo(f=>({...f,nome:e.target.value}))} required/>
              </div>
              <div className="form-group">
                <label className="form-label">Emoji</label>
                <EmojiGrid value={formTipo.icone} onChange={v=>setFormTipo(f=>({...f,icone:v}))}/>
              </div>
              <div className="form-group"><label className="form-label">Cor</label>
                <p className="form-hint mb-2">Atalhos abaixo, ou escolha <strong>qualquer cor</strong> no seletor / digitando o código.</p>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',paddingTop:4,marginBottom:8}}>
                  {CORES_TIPO.map(c=>(
                    <button key={c} type="button" onClick={()=>setFormTipo(f=>({...f,cor:c}))} style={{width:36,height:36,borderRadius:9,background:c,border:'none',cursor:'pointer',boxShadow:formTipo.cor===c?`0 0 0 3px white, 0 0 0 5px ${c}`:'none',transition:'box-shadow 0.15s'}}/>
                  ))}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input type="color" value={formTipo.cor} onChange={e=>setFormTipo(f=>({...f,cor:e.target.value}))} style={{width:44,height:38,borderRadius:8,border:'1px solid var(--border)',cursor:'pointer',padding:2}}/>
                  <input type="text" value={formTipo.cor.toUpperCase()} onChange={e=>{const v=e.target.value; if(/^#[0-9a-fA-F]{0,6}$/.test(v)) setFormTipo(f=>({...f,cor:v}))}} maxLength={7} className="form-input" style={{width:110,fontFamily:'monospace'}} placeholder="#RRGGBB"/>
                  <div style={{height:38,flex:1,borderRadius:9,background:formTipo.cor,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span style={{color:'white',fontWeight:700,fontSize:13}}>{formTipo.nome||'Prévia'}</span>
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>{salvando?'Salvando...':editandoTipo?'Salvar':'Criar'}</button>
            </form>
          </div>
        </div>
      )}
      <FotoAmpliada url={fotoAmpliada} onClose={()=>setFotoAmpliada(null)} />
    </div>
  )
}
