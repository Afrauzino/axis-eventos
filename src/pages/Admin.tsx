import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDataHora, isAdmin } from '../utils'
import type { Profile } from '../App'
import EmojiPicker from '../components/EmojiPicker'

type Usuario = { id:string; user_id:string; name:string|null; full_name?:string|null; user_role:string; email?:string }
type Evento  = { id:string; name:string; status:string; location:string|null; valor_encontrista:number|null; valor_encontreiro:number|null; created_at:string }

const ROLES = ['visitante','aprovado','encontreiro','lider','financeiro','secretaria','coordenador','pastor','admin']
const ROLE_LABEL: Record<string,string> = { visitante:'Visitante', aprovado:'Aprovado', encontreiro:'Encontreiro', lider:'Líder', financeiro:'Financeiro', secretaria:'Secretaria', coordenador:'Coordenador', pastor:'Pastor', admin:'Admin' }

const TIPOS_PADRÃO = [
  {nome:'Ministração', cor:'#6B46C1', ordem:1},
  {nome:'Teatro',      cor:'#E8821A', ordem:2},
  {nome:'Louvor',      cor:'#D53F8C', ordem:3},
  {nome:'Refeição',    cor:'#2F855A', ordem:4},
  {nome:'Pausa',       cor:'#718096', ordem:5},
  {nome:'Atividade',   cor:'#00A99D', ordem:6},
]

const CORES_TIPO = ['#00A99D','#6B46C1','#E8821A','#2F855A','#D53F8C','#2B6CB0','#C53030','#D69E2E','#718096','#1A202C']

export default function Admin({ profile }: { profile?: Profile }) {
  const [aba, setAba]               = useState<'usuarios'|'cargos'|'equipes_perm'|'eventos'|'tipos'|'backup'>('usuarios')
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
  const [editandoCargo, setEditandoCargo] = useState<{role:string;label:string;descricao:string}|null>(null)
  const [formCargo, setFormCargo]   = useState({label:'',descricao:''})

  const [usuarios, setUsuarios]     = useState<Usuario[]>([])
  const [pessoas, setPessoas]       = useState<{
    id:string; name:string; photo_url:string|null; church:string;
    role_type:string; invite_code:string|null; user_id:string|null;
    // from profiles join:
    user_role:string|null; role_status:string|null; profile_name:string|null;
  }[]>([])
  const [gerandoCodigos, setGerandoCodigos] = useState(false)
  const [pessoaDetalhe, setPessoaDetalhe] = useState<typeof pessoas[0]|null>(null)
  // Permissões
  const [permsPessoa, setPermsPessoa]   = useState<any[]>([])
  const [permsAba, setPermsAba]         = useState<'liberacoes'|'acoes'|'menus_visiveis'>('liberacoes')
  const [cargoPerm, setCargoPerm]       = useState<string>('encontreiro')
  const [permsCargo, setPermsCargo]     = useState<any[]>([])
  const [equipesPerm, setEquipesPerm]   = useState<any[]>([])
  const [equipePermSel, setEquipePermSel] = useState<any|null>(null)
  const [permsEquipe, setPermsEquipe]   = useState<any[]>([])
  const [cargoSubAba, setCargoSubAba]   = useState<'acoes'|'menus'>('acoes')
  const [equipeSubAba, setEquipeSubAba] = useState<'acoes'|'menus'>('acoes')
  const [eventos, setEventos]       = useState<Evento[]>([])
  const [tipos, setTipos]           = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [salvando, setSalvando]     = useState(false)
  const [modalEvento, setModalEvento] = useState(false)
  const [editandoEvento, setEditandoEvento] = useState<Evento|null>(null)
  const [modalTipo, setModalTipo]   = useState(false)
  const [editandoTipo, setEditandoTipo] = useState<any>(null)
  const [formTipo, setFormTipo]     = useState({nome:'',cor:'#00A99D',icone:''})
  const [modalDuplicar, setModalDuplicar] = useState<Evento|null>(null)
  const [nomeDuplicar, setNomeDuplicar] = useState('')
  const [opcoesDup, setOpcoesDup]   = useState({ ministracoes:true, teatros:true, cronograma:true, equipes:true, personagens:true, locais:true, tipos:true })
  const [duplicando, setDuplicando] = useState(false)
  const [formEvento, setFormEvento] = useState({ name:'', location:'', valor_encontrista:'', valor_encontreiro:'', start_date:'', end_date:'' })

  useEffect(() => { carregar() }, [])

  // ===== PERMISSÕES: módulos (ações) e menus (visualização) =====
  const TODOS_MODULOS = [
    { modulo:'cronograma',   label:'Cronograma' },
    { modulo:'encontristas', label:'Encontristas' },
    { modulo:'cadastros',    label:'Cadastros' },
    { modulo:'ministracoes', label:'Ministrações' },
    { modulo:'ranking',      label:'Ranking' },
    { modulo:'equipes',      label:'Equipes' },
    { modulo:'escalas',      label:'Escalas' },
    { modulo:'teatro',       label:'Teatro' },
    { modulo:'alertas',      label:'Alertas' },
    { modulo:'saude',        label:'Saúde' },
    { modulo:'medicamentos', label:'Medicamentos' },
    { modulo:'financeiro',   label:'Financeiro' },
    { modulo:'doacoes',      label:'Doações' },
    { modulo:'relatorios',   label:'Relatórios' },
  ]
  // Menus visíveis (o que aparece no menu lateral)
  const TODOS_MENUS = [
    { modulo:'menu_inicio',       label:'Início' },
    { modulo:'menu_atividades',   label:'Minhas Atividades' },
    { modulo:'menu_cronograma',   label:'Cronograma' },
    { modulo:'menu_encontristas', label:'Encontristas' },
    { modulo:'menu_cadastros',    label:'Cadastros' },
    { modulo:'menu_ministracoes', label:'Ministrações' },
    { modulo:'menu_ranking',      label:'Ranking' },
    { modulo:'menu_correio',      label:'Correio' },
    { modulo:'menu_equipes',      label:'Equipes' },
    { modulo:'menu_teatro',       label:'Teatro' },
    { modulo:'menu_evento',       label:'Evento / Alertas' },
    { modulo:'menu_alertas_lideres', label:'Alertas entre Líderes' },
    { modulo:'menu_cozinha',      label:'Cozinha / Cardápio' },
    { modulo:'menu_cozinha',      label:'Cozinha / Cardápio' },
    { modulo:'menu_saude',        label:'Saúde' },
    { modulo:'menu_financeiro',   label:'Financeiro' },
    { modulo:'menu_admin',        label:'Administração' },
  ]
  const TODOS_CARGOS = ['visitante','aprovado','encontreiro','lider','lider_cozinha','lider_enfermaria','lider_financeiro','lider_intercessao','lider_limpeza','lider_logistica','lider_manutencao','lider_recepcao','lider_som','lider_teatro','lider_vision','financeiro','secretaria','coordenador','pastor','admin']
  const LABEL_CARGO: Record<string,string> = { visitante:'Visitante',aprovado:'Aprovado',encontreiro:'Encontreiro',lider:'Líder',lider_cozinha:'Líder Cozinha',lider_enfermaria:'Líder Enfermaria',lider_financeiro:'Líder Financeiro',lider_intercessao:'Líder Intercessão',lider_limpeza:'Líder Limpeza',lider_logistica:'Líder Logística',lider_manutencao:'Líder Manutenção',lider_recepcao:'Líder Recepção',lider_som:'Líder Som',lider_teatro:'Líder Teatro',lider_vision:'Líder Vision',financeiro:'Financeiro',secretaria:'Secretaria',coordenador:'Coordenador',pastor:'Pastor',admin:'Admin' }

  // ---- PESSOA ----
  async function carregarPermsPessoa(p: any) {
    if (!p?.id) return
    const { data } = await supabase.from('permissoes').select('*').eq('person_id', p.id)
    setPermsPessoa(data ?? [])
  }
  // Define estado explícito: true=liberado, false=bloqueado, null=remove (neutro)
  async function definirPermPessoa(p: any, modulo: string, estado: boolean|null) {
    if (!p?.id) return
    const existe = permsPessoa.find(x => x.person_id === p.id && x.modulo === modulo && x.acao === 'ver')
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
      const { data: n } = await supabase.from('permissoes').insert({ person_id: p.id, modulo, acao: 'ver', permitido: estado }).select().single()
      if (n) setPermsPessoa(prev => [...prev, n])
    }
  }
  async function togglePermPessoa(p: any, modulo: string, atual: boolean|undefined) {
    // mantido para compatibilidade — alterna liberado/neutro
    await definirPermPessoa(p, modulo, atual ? null : true)
  }
  async function removerPermPessoa(p: any, modulo: string) {
    await definirPermPessoa(p, modulo, null)
  }

  // ---- CARGO ----
  async function carregarPermsCargo(cargo: string) {
    const { data } = await supabase.from('permissoes').select('*').eq('role', cargo).is('person_id', null).is('team_id', null)
    setPermsCargo(data ?? [])
  }
  async function togglePermCargo(cargo: string, modulo: string) {
    const existe = permsCargo.find(x => x.role === cargo && x.modulo === modulo && x.acao === 'ver')
    if (existe) {
      await supabase.from('permissoes').update({ permitido: !existe.permitido }).eq('id', existe.id)
      setPermsCargo(prev => prev.map(x => x.id === existe.id ? { ...x, permitido: !existe.permitido } : x))
    } else {
      const { data: n } = await supabase.from('permissoes').insert({ role: cargo, modulo, acao: 'ver', permitido: true }).select().single()
      if (n) setPermsCargo(prev => [...prev, n])
    }
  }
  async function removerPermCargo(cargo: string, modulo: string) {
    const existe = permsCargo.find(x => x.role === cargo && x.modulo === modulo && x.acao === 'ver')
    if (existe) {
      await supabase.from('permissoes').delete().eq('id', existe.id)
      setPermsCargo(prev => prev.filter(x => x.id !== existe.id))
    }
  }

  // ---- EQUIPE ----
  async function carregarEquipesPerm() {
    const activeId = eventos.find((ev:any)=>ev.status==='active')?.id
    if (!activeId) return
    const { data } = await supabase.from('teams').select('id,name,color,emoji').eq('event_id', activeId).order('name')
    setEquipesPerm(data ?? [])
  }
  async function carregarPermsEquipe(team_id: string) {
    const { data } = await supabase.from('permissoes').select('*').eq('team_id', team_id).is('person_id', null).is('role', null)
    setPermsEquipe(data ?? [])
  }
  async function togglePermEquipe(team_id: string, modulo: string) {
    const existe = permsEquipe.find(x => x.team_id === team_id && x.modulo === modulo && x.acao === 'ver')
    if (existe) {
      await supabase.from('permissoes').update({ permitido: !existe.permitido }).eq('id', existe.id)
      setPermsEquipe(prev => prev.map(x => x.id === existe.id ? { ...x, permitido: !existe.permitido } : x))
    } else {
      const { data: n } = await supabase.from('permissoes').insert({ team_id, modulo, acao: 'ver', permitido: true }).select().single()
      if (n) setPermsEquipe(prev => [...prev, n])
    }
  }
  async function removerPermEquipe(team_id: string, modulo: string) {
    const existe = permsEquipe.find(x => x.team_id === team_id && x.modulo === modulo && x.acao === 'ver')
    if (existe) {
      await supabase.from('permissoes').delete().eq('id', existe.id)
      setPermsEquipe(prev => prev.filter(x => x.id !== existe.id))
    }
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

      // Add admin profiles that have no people record in this event
      const adminPerfs = (allProfs??[]).filter(pr =>
        ['admin','coordenador','financeiro'].includes(pr.user_role) &&
        !(pe??[]).find((p:any)=>p.user_id===pr.user_id)
      ).map(pr => ({
        id: pr.user_id, // use user_id as id fallback
        name: pr.name, photo_url: null, church: 'Administrador do sistema',
        role_type: 'admin', invite_code: null, user_id: pr.user_id,
        user_role: pr.user_role, role_status: pr.role_status, profile_name: pr.name
      }))

      setPessoas([...adminPerfs, ...pessoasComInfo])
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
  async function aprovarPessoa(p: typeof pessoas[0]) {
    if (!p.user_id) return
    const cargo = (p.user_role && p.user_role !== 'visitante') ? p.user_role : 'encontreiro'
    await supabase.from('profiles').update({ user_role: cargo, role_status: 'approved' }).eq('user_id', p.user_id)
    setPessoas(prev => prev.map(x => x.user_id === p.user_id ? { ...x, user_role: cargo, role_status: 'approved' } : x))
    setPessoaDetalhe(prev => prev && prev.user_id === p.user_id ? { ...prev, user_role: cargo, role_status: 'approved' } : prev)
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

  // Excluir COMPLETAMENTE — remove de todas as tabelas, como se nunca tivesse existido
  async function excluirCadastro(p: typeof pessoas[0]) {
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

    if (p.user_id) {
      await supabase.from('profiles').update({ role_status: 'rejected', user_role: 'visitante' }).eq('user_id', p.user_id)
    }

    await supabase.from('people').delete().eq('id', pid)
    setPessoaDetalhe(null)
    setPessoas(prev => prev.filter(x => x.id !== pid))
  }

  async function salvarEvento(e:React.FormEvent) {
    e.preventDefault(); setSalvando(true)
    const payload = { name:formEvento.name, location:formEvento.location||null, valor_encontrista:parseFloat(formEvento.valor_encontrista)||0, valor_encontreiro:parseFloat(formEvento.valor_encontreiro)||0, start_date:formEvento.start_date||null, end_date:formEvento.end_date||null }
    if (editandoEvento) await supabase.from('events').update(payload).eq('id',editandoEvento.id)
    else await supabase.from('events').insert({...payload,status:'active'})
    setModalEvento(false); setSalvando(false); setEditandoEvento(null)
    setFormEvento({name:'',location:'',valor_encontrista:'',valor_encontreiro:'',start_date:'',end_date:''}); carregar()
  }

  async function finalizarEvento(id:string) {
    if (!confirm('Finalizar este evento? Ele ficará como encerrado.')) return
    await supabase.from('events').update({status:'finished'}).eq('id',id)
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
    await supabase.from('alertas').delete().eq('event_id',id).catch(()=>{})
    await supabase.from('occurrences').delete().eq('event_id',id)
    await supabase.from('events').delete().eq('id',id)
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
    alert(`Evento "${nomeDuplicar}" criado com sucesso!`); carregar()
  }

  async function salvarTipo(e:React.FormEvent) {
    e.preventDefault(); setSalvando(true)
    if (editandoTipo) await supabase.from('cronograma_tipos').update({nome:formTipo.nome,cor:formTipo.cor,icone:formTipo.icone||null}).eq('id',editandoTipo.id)
    else await supabase.from('cronograma_tipos').insert({nome:formTipo.nome,cor:formTipo.cor,icone:formTipo.icone||null,ordem:tipos.length+1})
    setModalTipo(false); setSalvando(false); setEditandoTipo(null); setFormTipo({nome:'',cor:'#00A99D',icone:''}); carregar()
  }

  async function excluirTipo(id:string) {
    const t = tipos.find(x=>x.id===id)
    if (t?.protegido) { alert('Este tipo tem regras e não pode ser excluído. Você pode alterar nome e cor.'); return }
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
    const [pe, eq, mi, te, lo, pa, oc] = await Promise.all([
      supabase.from('people').select('*').eq('event_id',evento.id),
      supabase.from('teams').select('*').eq('event_id',evento.id),
      supabase.from('ministrações').select('*').eq('event_id',evento.id),
      supabase.from('theaters').select('*').eq('event_id',evento.id),
      supabase.from('locais').select('*').eq('event_id',evento.id),
      supabase.from('financeiro').select('*').eq('event_id',evento.id),
      supabase.from('occurrences').select('*').eq('event_id',evento.id),
    ])
    const backup = { evento, pessoas:pe.data, equipes:eq.data, ministracoes:mi.data, teatros:te.data, locais:lo.data, financeiro:pa.data, ocorrencias:oc.data, exportado_em:new Date().toISOString() }
    const blob = new Blob([JSON.stringify(backup,null,2)],{type:'application/json'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href=url; a.download=`backup-${evento.name}-${new Date().toISOString().slice(0,10)}.json`; a.click()
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

  return (
    <div className="page">
      <div className="tabs">
        <button className={`tab ${aba==='usuarios'?'active':''}`}  onClick={()=>setAba('usuarios')}>Usuários</button>
        <button className={`tab ${aba==='equipes_perm'?'active':''}`} onClick={()=>{setAba('equipes_perm');carregarEquipesPerm()}}>Equipes</button>
        <button className={`tab ${aba==='eventos'?'active':''}`}   onClick={()=>setAba('eventos')}>Eventos</button>
        <button className={`tab ${aba==='tipos'?'active':''}`}     onClick={()=>setAba('tipos')}>Tipos</button>
        <button className={`tab ${aba==='backup'?'active':''}`}    onClick={()=>setAba('backup')}>Backup</button>
      </div>

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
          {pessoas.map(p => (
            <div key={p.id} onClick={()=>{setPessoaDetalhe(p);setPermsAba('liberacoes');carregarPermsPessoa(p)}} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,overflow:'hidden',borderLeft:`3px solid ${p.role_type==='worker'?'var(--primary)':'#6B46C1'}`,cursor:'pointer'}}>
              <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px'}}>
                {/* Avatar */}
                <div style={{width:42,height:42,borderRadius:'50%',background:p.role_type==='worker'?'var(--primary-light)':'#F3F0FF',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {p.photo_url
                    ? <img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : <span style={{fontWeight:700,fontSize:14,color:p.role_type==='worker'?'var(--primary)':'#6B46C1'}}>{p.name.slice(0,2).toUpperCase()}</span>
                  }
                </div>

                {/* Info */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                    <p style={{fontWeight:700,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</p>
                    <span style={{fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:99,background:p.role_type==='worker'?'var(--primary-light)':'#F3F0FF',color:p.role_type==='worker'?'var(--primary)':'#6B46C1',flexShrink:0}}>
                      {p.role_type==='worker'?'Encontreiro':'Encontrista'}
                    </span>
                  </div>
                  <p style={{fontSize:11,color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {p.church||'Igreja não informada'}
                    {p.user_role && p.user_role !== 'visitante' && (
                      <span style={{marginLeft:6,color:'var(--primary)',fontWeight:600}}>
                        · {cargos.find(cg=>cg.role===p.user_role)?.label ?? p.user_role}
                      </span>
                    )}
                  </p>
                </div>

                {/* Status de conta */}
                <div style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                  {p.user_id ? (
                    <>
                      <button
                        onClick={e=>{e.stopPropagation(); if(p.role_status==='pending') aprovarPessoa(p)}}
                        title={p.role_status==='pending'?'Clique para aprovar':'Ativo'}
                        className={`badge ${p.role_status==='pending'?'badge-warning':'badge-success'}`}
                        style={{fontSize:9,border:'none',cursor:p.role_status==='pending'?'pointer':'default',fontFamily:'inherit'}}>
                        {p.role_status==='pending'?'⏳ Aprovar':'✓ Ativo'}
                      </button>
                      <select
                        value={p.user_role??'visitante'}
                        onChange={e=>{e.stopPropagation();alterarRole(p.user_id!,e.target.value)}}
                        style={{fontSize:11,padding:'2px 6px',borderRadius:6,border:`1px solid ${p.role_status==='pending'?'var(--warning)':'var(--border)'}`,background:p.role_status==='pending'?'var(--warning-bg)':'var(--bg)',cursor:'pointer',fontFamily:'inherit',maxWidth:130,fontWeight:p.role_status==='pending'?700:400}}
                      >
                        {cargos.map(cg=><option key={cg.role} value={cg.role}>{cg.label}</option>)}
                      </select>
                    </>
                  ) : p.invite_code ? (
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <span style={{fontFamily:'monospace',fontSize:13,fontWeight:800,letterSpacing:'0.1em',color:'var(--primary)',background:'var(--primary-light)',padding:'3px 8px',borderRadius:6}}>{p.invite_code}</span>
                      <button onClick={()=>navigator.clipboard?.writeText(p.invite_code??'')} title="Copiar código"
                        style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:0,fontFamily:'inherit',display:'flex',alignItems:'center'}}>
                        <span className="icon" style={{fontSize:16}}>content_copy</span>
                      </button>
                    </div>
                  ) : (
                    <span className="badge badge-neutral" style={{fontSize:9}}>Sem código</span>
                  )}
                </div>
              </div>
            </div>
          ))}
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
                <p style={{fontSize:12,color:'var(--muted)',marginBottom:10,lineHeight:1.5}}>Liberações individuais desta pessoa. A liberação final é a <strong>soma</strong> da equipe + aqui. Ativar aqui dá acesso mesmo que a equipe não dê.</p>
                <div style={{background:'white',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow-sm)'}}>
                  {TODOS_MODULOS.map(({modulo,label})=>{
                    const perm = permsPessoa.find(x=>x.modulo===modulo && x.acao==='ver')
                    const liberado = perm ? perm.permitido : undefined
                    return (
                      <div key={modulo} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:'1px solid var(--border)'}}>
                        <div>
                          <p style={{fontSize:13,fontWeight:600}}>{label}</p>
                          {liberado===undefined && <p style={{fontSize:10,color:'var(--muted)'}}>Segue a equipe</p>}
                          {liberado===true && <p style={{fontSize:10,color:'var(--success)',fontWeight:700}}>✓ Liberado individualmente</p>}
                        </div>
                        <div style={{display:'flex',gap:6}}>
                          <button onClick={()=>togglePermPessoa(pessoaDetalhe,modulo,liberado)}
                            title={liberado?'Desativar':'Ativar'}
                            style={{width:40,height:22,borderRadius:11,border:'none',cursor:'pointer',background:liberado?'var(--success)':'var(--border)',transition:'background 0.2s',position:'relative',flexShrink:0}}>
                            <span style={{position:'absolute',top:2,left:liberado?20:2,width:18,height:18,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
                          </button>
                          {liberado!==undefined && (
                            <button onClick={()=>removerPermPessoa(pessoaDetalhe,modulo)} title="Remover (volta ao padrão da equipe)"
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

            {permsAba==='menus_visiveis' && (
              <div style={{marginBottom:14}}>
                <p style={{fontSize:12,color:'var(--muted)',marginBottom:10,lineHeight:1.5}}>Menus que esta pessoa pode ver. Ativar mostra o menu. Vazio = segue a equipe.</p>
                <div style={{background:'white',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow-sm)'}}>
                  {TODOS_MENUS.map(({modulo,label})=>{
                    const perm = permsPessoa.find(x=>x.modulo===modulo && x.acao==='ver')
                    const liberado = perm ? perm.permitido : undefined
                    return (
                      <div key={modulo} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:'1px solid var(--border)'}}>
                        <div>
                          <p style={{fontSize:13,fontWeight:600}}>{label}</p>
                          {liberado===undefined && <p style={{fontSize:10,color:'var(--muted)'}}>Segue a equipe</p>}
                          {liberado===true && <p style={{fontSize:10,color:'var(--success)',fontWeight:700}}>✓ Menu visível</p>}
                        </div>
                        <div style={{display:'flex',gap:6}}>
                          <button onClick={()=>togglePermPessoa(pessoaDetalhe,modulo,liberado)}
                            style={{width:40,height:22,borderRadius:11,border:'none',cursor:'pointer',background:liberado?'var(--primary)':'var(--border)',transition:'background 0.2s',position:'relative',flexShrink:0}}>
                            <span style={{position:'absolute',top:2,left:liberado?20:2,width:18,height:18,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
                          </button>
                          {liberado!==undefined && (
                            <button onClick={()=>removerPermPessoa(pessoaDetalhe,modulo)} title="Voltar ao padrão"
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
                    <select className="form-select"
                      value={pessoaDetalhe.user_role??'visitante'}
                      onChange={e=>{alterarRole(pessoaDetalhe.user_id!,e.target.value);setPessoaDetalhe(prev=>prev?{...prev,user_role:e.target.value,role_status:e.target.value==='visitante'?'pending':'approved'}:null)}}
                    >
                      {cargos.map(cg=><option key={cg.role} value={cg.role}>{cg.label}</option>)}
                    </select>
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
                        <button onClick={()=>{
                          const txt = pessoaDetalhe.invite_code??''
                          if (navigator.clipboard) navigator.clipboard.writeText(txt)
                          else { const el=document.createElement('textarea');el.value=txt;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el) }
                        }} style={{background:'var(--primary)',color:'white',border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
                          <span className="icon icon-sm" style={{color:'white'}}>content_copy</span> Copiar
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
                <div onClick={()=>definirPermPessoa(pessoaDetalhe,'cronograma_inteligente', ativo?null:true)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'white',borderRadius:12,boxShadow:'var(--shadow-sm)',marginBottom:12,cursor:'pointer'}}>
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

            <button onClick={()=>trocarTipoPessoa(pessoaDetalhe)} className="btn btn-ghost btn-full" style={{marginBottom:8}}>
              <span className="icon icon-sm">swap_horiz</span>
              Transformar em {pessoaDetalhe.role_type==='encounterer'?'Encontreiro':'Encontrista'}
            </button>

            <button className="btn btn-ghost btn-full" onClick={()=>setPessoaDetalhe(null)}>Fechar</button>
            <button
              onClick={()=>excluirCadastro(pessoaDetalhe)}
              style={{marginTop:8,width:'100%',padding:'10px',background:'var(--danger-bg)',color:'var(--danger)',border:'1px solid var(--danger)',borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              <span className="icon icon-sm">person_remove</span>
              {pessoaDetalhe.user_id ? 'Bloquear e excluir cadastro' : 'Excluir cadastro'}
            </button>
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
              <p style={{fontSize:12,color:'var(--primary)',fontWeight:600}}>Liberações aqui se somam ao cargo de quem faz parte desta equipe.</p>
            </div>
            <div className="tabs mb-3">
              <button className={`tab ${equipeSubAba==='acoes'?'active':''}`} onClick={()=>setEquipeSubAba('acoes')}>Liberações</button>
              <button className={`tab ${equipeSubAba==='menus'?'active':''}`} onClick={()=>setEquipeSubAba('menus')}>Menus visíveis</button>
            </div>
            <div style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',overflow:'hidden'}}>
              {(equipeSubAba==='acoes'?TODOS_MODULOS:TODOS_MENUS).map(({modulo,label})=>{
                const perm = permsEquipe.find(x=>x.modulo===modulo && x.acao==='ver')
                const liberado = perm ? perm.permitido : false
                return (
                  <div key={modulo} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px',borderBottom:'1px solid var(--border)'}}>
                    <p style={{fontSize:13,fontWeight:600}}>{label}</p>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <button onClick={()=>togglePermEquipe(equipePermSel.id,modulo)}
                        style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',background:liberado?'var(--primary)':'var(--border)',transition:'background 0.2s',position:'relative',flexShrink:0}}>
                        <span style={{position:'absolute',top:3,left:liberado?23:3,width:18,height:18,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
                      </button>
                      {perm && (
                        <button onClick={()=>removerPermEquipe(equipePermSel.id,modulo)} title="Remover"
                          style={{width:24,height:24,borderRadius:6,border:'1px solid var(--border)',background:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <span className="icon" style={{fontSize:14,color:'var(--muted)'}}>delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
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
                <span className={`badge ${ev.status==='active'?'badge-success':'badge-neutral'}`} style={{fontSize:10}}>{ev.status==='active'?'Ativo':'Encerrado'}</span>
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
          <button className="fab" onClick={()=>{setEditandoEvento(null);setFormEvento({name:'',location:'',valor_encontrista:'',valor_encontreiro:''});setModalEvento(true)}}><span className="icon">add</span></button>
        </>
      )}

      {/* TIPOS */}
      {aba==='tipos' && (
        <>
          <p style={{fontSize:13,color:'var(--text2)',marginBottom:14}}>Tipos de atividade do cronograma com cores personalizáveis.</p>
          {tipos.map(t=>(
            <div key={t.id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,display:'flex',alignItems:'center',gap:12,padding:'12px 14px'}}>
              <div style={{width:36,height:36,borderRadius:10,background:t.cor,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {t.icone && <span style={{fontFamily:"'Material Symbols Outlined'",color:'white',fontSize:20,fontWeight:'normal',fontStyle:'normal',lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',WebkitFontSmoothing:'antialiased',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24"}}>{t.icone}</span>}
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

      {/* BACKUP */}
      {aba==='backup' && (
        <div>
          <p style={{fontSize:13,color:'var(--text2)',marginBottom:20,lineHeight:1.6}}>Exporte todos os dados do evento ativo em formato JSON para backup ou importação futura.</p>
          <button className="btn btn-primary btn-full mb-3" onClick={exportarBackup}>
            <span className="icon icon-sm">download</span> Exportar backup completo
          </button>
          <div className="alert-box alert-info">O backup inclui: pessoas, equipes, ministrações, teatros, locais, financeiro e ocorrências. Não inclui logs e histórico de auditorias.</div>
        </div>
      )}

      {/* CARGOS */}
      {(aba as string)==='cargos' && (
        <div>
          <p style={{fontSize:13,color:'var(--text2)',marginBottom:16,lineHeight:1.6}}>Edite os nomes e descrições dos cargos exibidos no sistema. Os identificadores internos (chaves) não podem ser alterados.</p>
          {cargos.map(cargo=>(
            <div key={cargo.role} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,padding:'12px 16px'}}>
              {editandoCargo?.role===cargo.role ? (
                <div>
                  <div className="form-group"><label className="form-label">Nome exibido</label>
                    <input className="form-input" value={formCargo.label} onChange={e=>setFormCargo(f=>({...f,label:e.target.value}))}/>
                  </div>
                  <div className="form-group"><label className="form-label">Descrição</label>
                    <input className="form-input" value={formCargo.descricao} onChange={e=>setFormCargo(f=>({...f,descricao:e.target.value}))}/>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn btn-primary btn-sm" onClick={()=>{setCargos(prev=>prev.map(c=>c.role===cargo.role?{...c,label:formCargo.label,descricao:formCargo.descricao}:c));setEditandoCargo(null)}}>Salvar</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setEditandoCargo(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <p style={{fontWeight:700,fontSize:14}}>{cargo.label}</p>
                      <span className="badge badge-neutral" style={{fontSize:9}}>{cargo.role}</span>
                    </div>
                    <p style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{cargo.descricao}</p>
                  </div>
                  <button onClick={()=>{setEditandoCargo(cargo);setFormCargo({label:cargo.label,descricao:cargo.descricao})}} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,padding:'5px 10px',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'inherit'}}>Editar</button>
                </div>
              )}
            </div>
          ))}
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
                  <input className="form-input" type="date" value={formEvento.start_date} onChange={e=>setFormEvento(f=>({...f,start_date:e.target.value}))}/>
                </div>
                <div className="form-group"><label className="form-label">Data fim</label>
                  <input className="form-input" type="date" value={formEvento.end_date} onChange={e=>setFormEvento(f=>({...f,end_date:e.target.value}))}/>
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
                <label className="form-label">Ícone</label>
                <EmojiPicker value={formTipo.icone} onChange={v=>setFormTipo(f=>({...f,icone:v}))} label="Escolher ícone Material"/>
              </div>
              <div className="form-group"><label className="form-label">Cor</label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',paddingTop:4,marginBottom:8}}>
                  {CORES_TIPO.map(c=>(
                    <button key={c} type="button" onClick={()=>setFormTipo(f=>({...f,cor:c}))} style={{width:36,height:36,borderRadius:9,background:c,border:'none',cursor:'pointer',boxShadow:formTipo.cor===c?`0 0 0 3px white, 0 0 0 5px ${c}`:'none',transition:'box-shadow 0.15s'}}/>
                  ))}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <input type="color" value={formTipo.cor} onChange={e=>setFormTipo(f=>({...f,cor:e.target.value}))} style={{width:40,height:36,borderRadius:8,border:'1px solid var(--border)',cursor:'pointer',padding:2}}/>
                  <div style={{height:36,flex:1,borderRadius:9,background:formTipo.cor,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span style={{color:'white',fontWeight:700,fontSize:13}}>{formTipo.nome||'Prévia'}</span>
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>{salvando?'Salvando...':editandoTipo?'Salvar':'Criar'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
