import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useNavigationType } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtHora, isAdmin, nowLocalInput, toLocalInput, getInitials } from '../utils'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import { useRegistrarChrome } from '../lib/chrome'
import DataHora from '../components/DataHora'
import BarraData from '../components/BarraData'
import PrintOverlay from '../components/PrintOverlay'
import CronogramaImpressao from '../components/CronogramaImpressao'
import { type DiaPoster } from '../components/CronogramaPoster'
import Seletor from '../components/Seletor'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import CronometroPopup from '../components/CronometroPopup'
import CronometroDisplay from '../components/CronometroDisplay'
import { notificarRegra } from '../lib/notifRegras'
import type { Profile } from '../App'

type TipoAtividade = { id:string; nome:string; cor:string; icone?:string|null; chave?:string|null; protegido?:boolean }
// Abreviação do cargo eclesiástico na frente do nome (Pr., Pra., Ev., Pb.…).
// Se não conhecer o cargo, mostra ele como está.
function abrevCargo(cargo?: string | null): string {
  if (!cargo) return ''
  const c = cargo.trim().toLowerCase()
  const map: Record<string, string> = {
    'pastor': 'Pr.', 'pastora': 'Pra.',
    'presbítero': 'Pb.', 'presbitero': 'Pb.', 'presbítera': 'Pb.', 'presbitera': 'Pb.',
    'diácono': 'Dc.', 'diacono': 'Dc.', 'diaconisa': 'Dca.',
    'evangelista': 'Ev.',
    'missionário': 'Miss.', 'missionario': 'Miss.', 'missionária': 'Miss.', 'missionaria': 'Miss.',
    'bispo': 'Bp.', 'bispa': 'Bpa.',
    'apóstolo': 'Ap.', 'apostolo': 'Ap.', 'apóstola': 'Ap.', 'apostola': 'Ap.',
    'reverendo': 'Rev.', 'reverenda': 'Rev.',
    'presidente': 'Pres.', 'vice-presidente': 'Vice-Pres.',
    'ancião': 'Anc.', 'anciao': 'Anc.', 'anciã': 'Anc.',
    'cooperador': 'Coop.', 'cooperadora': 'Coop.',
    'obreiro': 'Obr.', 'obreira': 'Obr.',
    'diácona': 'Dca.',
  }
  return map[c] ?? cargo
}

type Ministracao = { id:string; titulo:string; ministrante_id:string|null; local:string|null; descricao:string|null; tema:string|null; foto_poster:string|null }
type Teatro      = { id:string; nome:string; local:string|null; descricao:string|null; ministracao_id?:string|null }
type Local       = { id:string; nome:string; tipo:string }
type Ministrante = { id:string; name:string }

type Item = {
  id:string; titulo:string; tipo:string
  hora_inicio:string; hora_fim:string
  status:string; local:string|null; descricao:string|null
  ministracao_id:string|null; theater_id:string|null
  duracao_minutos?:number|null
  cron_iniciado_em?:string|null
  cron_ajuste_segundos?:number|null
  cron_estado?:string|null
}

const TIPO_COR_FALLBACK: Record<string,string> = {
  ministracao:'#6B46C1', teatro:'#E8821A', pausa:'#718096',
  refeicao:'#2F855A', louvor:'#D53F8C', atividade:'#00A99D'
}
const STATUS_CFG: Record<string,{label:string;badge:string}> = {
  planejado:    {label:'Planejado',     badge:'badge-neutral'},
  em_andamento: {label:'Em andamento',  badge:'badge-warning'},
  concluido:    {label:'Concluido',     badge:'badge-success'},
  cancelado:    {label:'Cancelado',     badge:'badge-danger'},
}

// Guarda o último dia visto no Cronograma (sobrevive à saída p/ teatro/ministração).
// Só é restaurado quando o retorno é pelo Voltar (navegação POP); abrir pelo menu recomeça em hoje.
let ultimoDiaCronograma: number | null = null

export default function Cronograma({ profile }: { profile?: Profile }) {
  const navigate = useNavigate()
  const navType  = useNavigationType()
  const { evento, loading: evLoading } = useEvento()
  const [itens, setItens]             = useState<Item[]>([])
  const [ministrações, setMinistrações] = useState<Ministracao[]>([])
  const [teatros, setTeatros]         = useState<Teatro[]>([])
  const [locais, setLocais]           = useState<Local[]>([])
  const [ministrantes, setMinistrantes] = useState<Ministrante[]>([])
  const [tiposDB, setTiposDB]         = useState<TipoAtividade[]>([])
  const [loading, setLoading]         = useState(true)
  const [filtro, setFiltro]           = useState('todos')
  const [detalhe, setDetalhe]         = useState<Item|null>(null)
  const [podeCronometro, setPodeCronometro] = useState(false)
  const [cronometro, setCronometro]   = useState<Item|null>(null)
  const [modal, setModal]             = useState(false)
  const [imprimir, setImprimir]       = useState<null|'inteiro'|'detalhado'|'resumido'|'resumido-slim'>(null)
  const [editando, setEditando]       = useState<Item|null>(null)
  const [salvando, setSalvando]       = useState(false)
  const [erro, setErro]               = useState('')

  // Botão VOLTAR do celular fecha a janela aberta (cronômetro/impressão têm o próprio)
  useVoltarFecha(!!detalhe, () => setDetalhe(null))
  useVoltarFecha(modal, () => { setModal(false); setEditando(null) })
  const hoje = new Date()
  // Ao voltar (POP) do teatro/ministração, retoma o dia onde o usuário estava.
  const [dataSel, setDataSel]         = useState(() =>
    (navType === 'POP' && ultimoDiaCronograma != null) ? new Date(ultimoDiaCronograma) : hoje
  )
  // Mantém o "último dia visto" atualizado para o retorno.
  useEffect(() => { ultimoDiaCronograma = dataSel.getTime() }, [dataSel])
  const [form, setForm] = useState({
    titulo:'', tipo:'atividade',
    hora_inicio: nowLocalInput(),
    hora_fim: nowLocalInput(),
    duracao_minutos: '60',
    local:'', descricao:'',
    ministracao_id:'', theater_id:'', cardapio_id:'',
  })
  const [cardapios, setCardapios] = useState<{id:string;tipo_refeicao_nome:string|null;titulo:string|null}[]>([])
  // fotos/elenco para a impressão "com detalhes"
  const [pessoaFoto, setPessoaFoto] = useState<Record<string,{name:string;photo_url:string|null;cargo?:string|null}>>({})
  const [personagensMap, setPersonagensMap] = useState<Record<string,string>>({})
  const [elencoPorTeatro, setElencoPorTeatro] = useState<Record<string,{person_id:string;personagem_id:string|null}[]>>({})

  // chave do tipo selecionado (protege regras de ministração/refeição)
  function ehTipoChave(chave:string){
    const t = tiposDB.find(x=>x.nome.toLowerCase()===form.tipo.toLowerCase())
    if (t?.chave) return t.chave===chave
    // fallback pelo nome
    if (chave==='ministracao') return form.tipo.toLowerCase().includes('ministra')
    if (chave==='refeicao') return form.tipo.toLowerCase().includes('refei')||form.tipo.toLowerCase().includes('aliment')
    return false
  }
  function onSelectCardapio(id:string){
    const cd = cardapios.find(c=>c.id===id)
    setForm(f=>({...f, cardapio_id:id, titulo: cd ? `Refeição - ${cd.tipo_refeicao_nome ?? ''}`.trim() : f.titulo}))
  }

  const { pode } = usePermissao(profile ?? null)
  // Admin OU liberação (individual/equipe) "ver e editar Cronograma" na tela do Admin
  const canEdit = (!!profile && isAdmin(profile.user_role)) || pode('cronograma','editar')
  const ehAdmin = !!profile && (isAdmin(profile.user_role) || !!profile.is_admin)  // reverter status é só admin

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; setLoading(true); carregar() }, [evento, evLoading])

  // #12 — Sincronização em TEMPO REAL do cronograma/cronômetro em todos os dispositivos.
  useEffect(() => {
    if (!evento?.id) return
    const canal = supabase
      .channel('cronograma-rt-' + evento.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cronograma_eventos', filter: `event_id=eq.${evento.id}` },
        async () => {
          const { data } = await supabase.from('cronograma_eventos').select('*').eq('event_id', evento.id).order('hora_inicio')
          if (!data) return
          setItens(data)
          // Atualiza o item do cronômetro aberto (pra quem só acompanha ver o mesmo relógio)
          setCronometro(prev => prev ? (data.find((x:any)=>x.id===prev.id) ?? prev) : prev)
        })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [evento?.id])

  // Permissão Cronograma Inteligente (individual) — direto, sem hook duplicado
  useEffect(() => {
    let ativo = true
    async function checar() {
      if (isAdmin(profile?.user_role) || profile?.is_admin) { if(ativo) setPodeCronometro(true); return }
      if (!profile?.user_id) return
      const { data: p } = await supabase.from('people').select('id').eq('user_id', profile.user_id).maybeSingle()
      if (!p) return
      const { data } = await supabase.from('permissoes').select('id').eq('person_id', p.id).eq('modulo','cronograma_inteligente').eq('permitido', true).limit(1)
      if (ativo) setPodeCronometro((data ?? []).length > 0)
    }
    checar()
    return () => { ativo = false }
  }, [profile])

  async function carregar() {
    if (!evento) return
    const [it, mi, te, lo, pe, ti, cd, peAll, pgAll] = await Promise.all([
      supabase.from('cronograma_eventos').select('*').eq('event_id', evento.id).order('hora_inicio'),
      supabase.from('ministrações').select('id,titulo,ministrante_id,local,descricao,tema,foto_poster').eq('event_id', evento.id).order('titulo'),
      supabase.from('theaters').select('id,nome,local,descricao,ministracao_id').eq('event_id', evento.id).order('nome'),
      supabase.from('locais').select('id,nome,tipo').eq('event_id', evento.id).order('nome'),
      supabase.from('people').select('id,name').eq('event_id', evento.id).eq('role_type','worker').order('name'),
      supabase.from('cronograma_tipos').select('id,nome,cor,icone,chave,protegido').eq('ativo',true).order('ordem'),
      supabase.from('cozinha_cardapios').select('id,tipo_refeicao_nome,titulo').eq('event_id', evento.id),
      supabase.from('people').select('id,name,photo_url,cargo').eq('event_id', evento.id),
      supabase.from('personagens_globais').select('id,nome'),
    ])
    setItens(it.data ?? [])
    setMinistrações(mi.data ?? [])
    setTeatros(te.data ?? [])
    setLocais(lo.data ?? [])
    setMinistrantes(pe.data ?? [])
    setTiposDB(ti.data ?? [])
    setCardapios(cd.data ?? [])
    // mapas para impressão detalhada
    const fmap: Record<string,{name:string;photo_url:string|null;cargo?:string|null}> = {}; (peAll.data ?? []).forEach((p:any)=>{ fmap[p.id]={name:p.name,photo_url:p.photo_url,cargo:p.cargo} })
    setPessoaFoto(fmap)
    const pgmap: Record<string,string> = {}; (pgAll.data ?? []).forEach((p:any)=>{ pgmap[p.id]=p.nome })
    setPersonagensMap(pgmap)
    const teatroIds = (te.data ?? []).map((t:any)=>t.id)
    if (teatroIds.length) {
      const { data: elRows } = await supabase.from('teatro_elenco').select('theater_id,person_id,personagem_id').in('theater_id', teatroIds)
      const emap: Record<string,{person_id:string;personagem_id:string|null}[]> = {}
      ;(elRows ?? []).forEach((e:any)=>{ (emap[e.theater_id]=emap[e.theater_id]||[]).push({person_id:e.person_id,personagem_id:e.personagem_id}) })
      setElencoPorTeatro(emap)
    } else setElencoPorTeatro({})
    setLoading(false)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true)
    if (!evento || !form.titulo.trim()) { setErro('Titulo obrigatorio.'); setSalvando(false); return }

    // Validar data dentro do período do evento
    if ((evento as any).start_date && (evento as any).end_date) {
      const d = new Date(form.hora_inicio).getTime()
      const ini = new Date((evento as any).start_date + 'T00:00:00').getTime()
      const fim = new Date((evento as any).end_date + 'T23:59:59').getTime()
      if (d < ini || d > fim) { setErro('A data deve estar dentro do período do evento.'); setSalvando(false); return }
    }

    // Se vincular uma ministracao, puxar o local dela automaticamente
    let localFinal = form.local
    if (form.ministracao_id && !localFinal) {
      const min = ministrações.find(m => m.id === form.ministracao_id)
      if (min?.local) localFinal = min.local
    }

    const payload = {
      titulo: form.titulo, tipo: form.tipo,
      local: localFinal || null,
      descricao: form.descricao || null,
      hora_inicio: new Date(form.hora_inicio).toISOString(),
      hora_fim: new Date(new Date(form.hora_inicio).getTime() + (Number(form.duracao_minutos)||60)*60000).toISOString(),
      duracao_minutos: Number(form.duracao_minutos)||60,
      status: 'planejado',
      ministracao_id: form.ministracao_id || null,
      theater_id: form.theater_id || null,
      cardapio_id: form.cardapio_id || null,
    }

    let err
    if (editando) {
      const r = await supabase.from('cronograma_eventos').update(payload).eq('id', editando.id); err = r.error
    } else {
      const r = await supabase.from('cronograma_eventos').insert({ ...payload, event_id: evento.id }); err = r.error
    }
    if (err) { setErro('Erro: ' + err.message); setSalvando(false); return }
    // Avisa todos que o cronograma mudou (novo item ou alteração) — se ligado
    notificarRegra('cron_alterado', { alerta: { event_id: evento.id, target_type: 'all' }, title: editando ? 'Cronograma atualizado' : 'Novidade no cronograma', body: form.titulo, url: '/cronograma' })
    setModal(false); setSalvando(false); setEditando(null)
    setForm({ titulo:'', tipo:'atividade', hora_inicio:nowLocalInput(), hora_fim:nowLocalInput(), duracao_minutos:'60', local:'', descricao:'', ministracao_id:'', theater_id:'', cardapio_id:'' })
    carregar()
  }

  async function mudarStatus(id: string, status: string) {
    const extra: any = { status }
    // Amarração: iniciar item -> inicia cronômetro; concluir -> encerra
    if (status === 'em_andamento') {
      extra.cron_iniciado_em = new Date().toISOString()
      extra.cron_estado = 'correndo'
    } else if (status === 'concluido') {
      extra.cron_estado = 'encerrado'
    }
    await supabase.from('cronograma_eventos').update(extra).eq('id', id)
    // Conclusão de teatro/ministração acontece SÓ pelo cronograma → propaga
    if (status === 'concluido') {
      const item = itens.find(i => i.id === id)
      try { if (item?.theater_id)     await supabase.from('theaters').update({ status:'concluido' }).eq('id', item.theater_id) } catch {}
      try { if (item?.ministracao_id) await supabase.from('ministrações').update({ status:'concluido' }).eq('id', item.ministracao_id) } catch {}
    }
    // Notifica quando um item começa/termina
    if (status === 'em_andamento' || status === 'concluido') {
      const item = itens.find(i => i.id === id)
      const comecou = status === 'em_andamento'
      const verbo = comecou ? 'começou' : 'terminou'
      try {
        if (item?.theater_id) {
          const { data: el } = await supabase.from('teatro_elenco').select('person_id').eq('theater_id', item.theater_id)
          const ids = [...new Set((el ?? []).map((e:any)=>e.person_id).filter(Boolean))]
          if (ids.length) notificarRegra(comecou ? 'teatro_comecou' : 'teatro_terminou', { person_ids: ids, title: `Seu teatro ${verbo}`, body: item.titulo, url: '/minhas-atividades' })
        }
        if (item?.ministracao_id) {
          const { data: mi } = await supabase.from('ministrações').select('ministrante_id').eq('id', item.ministracao_id).maybeSingle()
          if ((mi as any)?.ministrante_id) notificarRegra(comecou ? 'min_comecou' : 'min_terminou', { person_ids: [(mi as any).ministrante_id], title: `Sua ministração ${verbo}`, body: item.titulo, url: '/minhas-atividades' })
        }
        // Item começou agora → avisa todos (se ligado)
        if (comecou && evento?.id) notificarRegra('cron_comecou', { alerta: { event_id: evento.id, target_type: 'all' }, title: `Começou: ${item?.titulo ?? 'programação'}`, body: item?.local ? `Local: ${item.local}` : 'Está na hora!', url: '/cronograma' })
      } catch {}
    }
    setItens(prev => prev.map(i => i.id === id ? { ...i, ...extra } : i))
    setDetalhe(prev => prev?.id === id ? { ...prev, ...extra } : prev)
  }

  // Reverter (só admin): volta o item para "Planejado", zera o cronômetro e
  // desfaz a conclusão do teatro/ministração vinculados.
  async function reverterStatus(id: string) {
    if (!confirm('Reverter este item para "Planejado"? Isso também reabre o teatro/ministração ligados.')) return
    const extra: any = { status: 'planejado', cron_estado: null, cron_iniciado_em: null }
    await supabase.from('cronograma_eventos').update(extra).eq('id', id)
    const item = itens.find(i => i.id === id)
    try { if (item?.theater_id)     await supabase.from('theaters').update({ status:'planejado' }).eq('id', item.theater_id) } catch {}
    try { if (item?.ministracao_id) await supabase.from('ministrações').update({ status:'planejado' }).eq('id', item.ministracao_id) } catch {}
    setItens(prev => prev.map(i => i.id === id ? { ...i, ...extra } : i))
    setDetalhe(prev => prev?.id === id ? { ...prev, ...extra } : prev)
  }

  async function excluir(id: string) {
    if (!confirm('Remover este item?')) return
    await supabase.from('cronograma_eventos').delete().eq('id', id)
    setDetalhe(null); carregar()
  }

  function abrirEdicao(item: Item) {
    setEditando(item)
    setForm({
      titulo: item.titulo, tipo: item.tipo,
      hora_inicio: toLocalInput(item.hora_inicio),
      hora_fim: toLocalInput(item.hora_fim),
      duracao_minutos: String(item.duracao_minutos ?? Math.max(1, Math.round((new Date(item.hora_fim).getTime()-new Date(item.hora_inicio).getTime())/60000))),
      local: item.local ?? '',
      descricao: item.descricao ?? '',
      ministracao_id: item.ministracao_id ?? '',
      theater_id: item.theater_id ?? '',
      cardapio_id: (item as any).cardapio_id ?? '',
    })
    setErro(''); setModal(true)
  }

  // Ao vincular ministração, preenche título/local (NÃO troca o tipo — os dois vínculos convivem)
  function onSelectMinistracao(id: string) {
    const min = ministrações.find(m => m.id === id)
    setForm(f => ({
      ...f,
      ministracao_id: id,
      titulo: min ? min.titulo : f.titulo,
      local: min?.local ?? f.local,
      descricao: min?.descricao ?? f.descricao,
    }))
  }

  // Ao vincular teatro, só preenche o título se estiver vazio (não sobrescreve o da ministração)
  function onSelectTeatro(id: string) {
    const te = teatros.find(t => t.id === id)
    setForm(f => ({
      ...f,
      theater_id: id,
      titulo: f.titulo?.trim() ? f.titulo : (te ? te.nome : f.titulo),
    }))
  }

  const mesmodia = (iso: string) => new Date(iso).toDateString() === dataSel.toDateString()
  // Concluído = por qualquer via (botão Concluir OU cronômetro encerrado)
  const ehConcluido = (i: Item) => i.status === 'concluido' || i.cron_estado === 'encerrado'
  // "todos": não concluídos de todos os dias.
  // "concluido": TODOS os concluídos, de QUALQUER dia e por qualquer via.
  // "planejado"/"em_andamento": só do dia selecionado.
  const filtrados =
    filtro === 'todos'     ? itens.filter(i => !ehConcluido(i))
    : filtro === 'concluido' ? itens.filter(ehConcluido)
    : itens.filter(i => mesmodia(i.hora_inicio) && i.status === filtro && !ehConcluido(i))

  // Filtros que juntam vários dias mostram a data no cabeçalho do grupo
  const multiDia = filtro === 'todos' || filtro === 'concluido'

  // Agrupar por hora
  const grupos: Record<string, Item[]> = {}
  filtrados.forEach(item => {
    const d = new Date(item.hora_inicio)
    const key = multiDia
      ? `${d.toLocaleDateString('pt-BR', {day:'2-digit',month:'short'})} · ${d.getHours()}h`
      : `${d.getHours()}h`
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(item)
  })

  // Info extra de um item
  function getInfo(item: Item) {
    const min = item.ministracao_id ? ministrações.find(m => m.id === item.ministracao_id) : null
    // teatro direto do item OU o teatro vinculado à ministração
    let tea = item.theater_id ? teatros.find(t => t.id === item.theater_id) : null
    if (!tea && item.ministracao_id) tea = teatros.find(t => t.ministracao_id === item.ministracao_id) || null
    const ministrante = min?.ministrante_id ? ministrantes.find(p => p.id === min.ministrante_id) : null
    return { min, tea, ministrante }
  }

  // --- Pôster (impressão resumida): agrupa TODOS os itens por DIA ---
  const diasPoster: DiaPoster[] = useMemo(() => {
    const DIAS = ['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO']
    const horaP = (iso:string) => { const d=new Date(iso); return `${String(d.getHours()).padStart(2,'0')}H${String(d.getMinutes()).padStart(2,'0')}` }
    const durP = (it:Item) => {
      const m = it.duracao_minutos ?? Math.round((new Date(it.hora_fim).getTime()-new Date(it.hora_inicio).getTime())/60000)
      if (!m || m<=0) return '—'
      if (m % 60 === 0) return `${String(m/60).padStart(2,'0')}H00`
      if (m < 60) return `${m} MIN.`
      return `${String(Math.floor(m/60)).padStart(2,'0')}H${String(m%60).padStart(2,'0')}`
    }
    const byDay: Record<string, Item[]> = {}
    ;[...itens].sort((a,b)=> a.hora_inicio.localeCompare(b.hora_inicio)).forEach(it=>{
      const d = new Date(it.hora_inicio); const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      ;(byDay[k]=byDay[k]||[]).push(it)
    })
    const MES3 = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ']
    return Object.keys(byDay).sort().map(k => {
      const items = byDay[k]
      const dref = new Date(items[0].hora_inicio)
      const dia = DIAS[dref.getDay()]
      const dataLabel = `${String(dref.getDate()).padStart(2,'0')}. ${MES3[dref.getMonth()]}`
      const linhas = items.map(it => {
        const { min, tea, ministrante } = getInfo(it)
        const tipo = tiposDB.find(t=>t.nome.toLowerCase()===it.tipo.toLowerCase())
        const cor = tipo?.cor ?? TIPO_COR_FALLBACK[it.tipo] ?? '#E8821A'
        const icone = tipo?.icone ?? null
        const sub = it.descricao ?? null
        const mfoto = min?.ministrante_id ? pessoaFoto[min.ministrante_id] : null
        if (min || ministrante) {
          const atores = tea ? (elencoPorTeatro[tea.id] ?? []) : []
          const elenco = atores.map(a => { const pf = pessoaFoto[a.person_id]; return { nome: pf?.name ?? '', foto: pf?.photo_url ?? null } })
          return { kind:'min' as const, horario:horaP(it.hora_inicio), duracao:durP(it), cor, icone, sub,
            ministrante:(mfoto?.name ?? ministrante?.name ?? '').toUpperCase(),
            titulo:(min?.titulo ?? it.titulo).toUpperCase(), fotoUrl:mfoto?.photo_url ?? null,
            fotoPng: min?.foto_poster ?? null,
            teatro: tea?.nome ? tea.nome.toUpperCase() : null, elenco }
        }
        return { kind:'simples' as const, horario:horaP(it.hora_inicio), duracao:durP(it), cor, icone, sub, titulo:it.titulo.toUpperCase() }
      })
      return { dia, dataLabel, linhas }
    })
  }, [itens, ministrações, teatros, ministrantes, tiposDB, pessoaFoto, elencoPorTeatro])

  // Ministrações/teatros já usados em OUTROS itens do cronograma (não reutilizáveis)
  const minUsadas = new Set(itens.filter(i => i.id !== editando?.id && i.ministracao_id).map(i => i.ministracao_id))
  const teaUsados = new Set(itens.filter(i => i.id !== editando?.id && i.theater_id).map(i => i.theater_id))

  useRegistrarChrome({
    grupos: [{ chave:'status', label:'Mostrar', opcoes:[{value:'todos',label:'Todos (todos os dias)'},{value:'planejado',label:'Planejados'},{value:'em_andamento',label:'Em andamento'},{value:'concluido',label:'Concluídos'}] }],
    valores: { status: filtro },
    onFiltro: (_,v)=>setFiltro(v),
    // Impressão só p/ quem EDITA o cronograma (admin/coordenador). Encontreiro que
    // só VÊ o cronograma não imprime (era: qualquer um que via, imprimia).
    impressoes: (canEdit && itens.length>0) ? [
      { label:'Imprimir resumido (A4)', icon:'view_agenda', onClick:()=>setImprimir('resumido-slim') },
      { label:'Imprimir inteiro', onClick:()=>setImprimir('inteiro') },
      { label:'Imprimir com detalhes', onClick:()=>setImprimir('detalhado') },
    ] : undefined,
  }, [filtro, itens.length, canEdit])

  return (
    <div className="page">
      {/* Navegacao por data — barra de semana (rola pro lado; so os dias do evento abrem) */}
      <BarraData value={dataSel} onChange={setDataSel} inicio={evento?.start_date} fim={evento?.end_date} hoje={hoje} />

      {/* Lista */}
      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:8,borderRadius:14}}/>) :
      Object.keys(grupos).length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>calendar_month</span></div>
          <p className="empty-title">Nenhuma atividade</p>
          <p className="empty-desc">Nenhuma atividade agendada para este dia.</p>
        </div>
      ) : Object.entries(grupos).map(([hora, items]) => (
        <div key={hora}>
          <div className="hour-group">{hora}</div>
          {items.map(item => {
            const { min, tea, ministrante } = getInfo(item)
            const mfoto = min?.ministrante_id ? pessoaFoto[min.ministrante_id] : null
            return (
              <div key={item.id} className={"sched-card" + (min?.foto_poster ? ' tem-foto' : '')} onClick={() => setDetalhe(item)}>
                <div className="sched-bar" style={{background: tiposDB.find(t=>t.nome.toLowerCase()===item.tipo.toLowerCase())?.cor ?? TIPO_COR_FALLBACK[item.tipo] ?? 'var(--primary)'}} />
                <div className="sched-body">
                  <div className="sched-time">{fmtHora(item.hora_inicio)} — {fmtHora(item.hora_fim)}</div>
                  <div className="sched-title" style={ehConcluido(item)?{textDecoration:'line-through',opacity:0.6}:undefined}>{min?.titulo ?? item.titulo}{ehConcluido(item) && <span style={{marginLeft:6,fontSize:11,color:'var(--success)'}}>✓ concluído</span>}</div>
                  <div className="sched-desc">
                    {tiposDB.find(t=>t.nome.toLowerCase()===item.tipo.toLowerCase())?.nome ?? item.tipo}
                    {item.local ? ` · ${item.local}` : ''}
                    {ministrante ? ` · ${ministrante.name.split(' ')[0]}` : ''}
                  </div>
                  {tea && (
                    <button onClick={(e)=>{e.stopPropagation(); navigate('/teatro/'+tea.id)}}
                      style={{marginTop:6,display:'inline-flex',alignItems:'center',gap:5,background:'#FFF3E0',border:'1px solid #F0993B55',borderRadius:8,padding:'3px 10px',cursor:'pointer',fontFamily:'inherit'}}
                      title="Abrir teatro">
                      <span style={{fontSize:13}}>🎭</span>
                      <span style={{fontSize:11,fontWeight:700,color:'#9a5b12'}}>Teatro: {tea.nome}</span>
                      <span className="icon" style={{fontSize:14,color:'#c07a2b'}}>chevron_right</span>
                    </button>
                  )}
                  <CronometroDisplay item={item} />
                </div>
                {/* Foto do ministrante: PNG (foto_poster) se tiver, senão a bolinha (avatar) */}
                {(min?.ministrante_id || ministrante) && (() => {
                  const nome = mfoto?.name ?? ministrante?.name ?? ''
                  const primeiro = nome.split(' ')[0]
                  const cg = abrevCargo(mfoto?.cargo)
                  return (
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',alignSelf:'flex-end',marginRight:10,flexShrink:0,pointerEvents:'none'}}>
                      {min?.foto_poster
                        ? <img src={min.foto_poster} alt="" style={{width:70,height:96,marginTop:-24,objectFit:'contain',objectPosition:'bottom center'}} />
                        : <div style={{width:48,height:48,borderRadius:'50%',overflow:'hidden',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {mfoto?.photo_url
                              ? <img src={mfoto.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                              : <span style={{fontWeight:700,color:'#6b7280',fontSize:16}}>{getInitials(nome||'?')}</span>}
                          </div>}
                      {primeiro && (
                        <span style={{marginTop:-7,background:'#EADFCF',color:'#2a1c0c',fontFamily:"'Anton', system-ui, sans-serif",fontSize:13,lineHeight:1.4,letterSpacing:'0.02em',padding:'2px 12px',borderRadius:99,whiteSpace:'nowrap',boxShadow:'0 1px 5px rgba(0,0,0,0.16)'}}>{cg ? cg+' ' : ''}{primeiro}</span>
                      )}
                    </div>
                  )
                })()}
                <button onClick={(e)=>{e.stopPropagation();setCronometro(item)}} title="Cronômetro" style={{background:'none',border:'none',cursor:'pointer',padding:'8px',display:'flex',alignItems:'center'}}>
                  <span className="icon" style={{color: item.cron_estado==='correndo'?'#E53E3E':'var(--primary)'}}>timer</span>
                </button>
                <div className="sched-chevron"><span className="icon icon-sm">chevron_right</span></div>
              </div>
            )
          })}
        </div>
      ))}

      {canEdit && (
        <button className="fab" onClick={() => { setEditando(null); setForm({titulo:'',tipo:'atividade',hora_inicio:nowLocalInput(),hora_fim:nowLocalInput(),duracao_minutos:'60',local:'',descricao:'',ministracao_id:'',theater_id:'',cardapio_id:''}); setErro(''); setModal(true) }}>
          <span className="icon">add</span>
        </button>
      )}

      {/* Modal detalhe do item */}
      {detalhe && (() => {
        const { min, tea, ministrante } = getInfo(detalhe)
        const cfg = STATUS_CFG[detalhe.status] ?? STATUS_CFG.planejado
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setDetalhe(null)}>
            <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'85vh',overflowY:'auto'}}>
              <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>

              {/* Header colorido */}
              <div style={{background:tiposDB.find(t=>t.nome.toLowerCase()===detalhe.tipo.toLowerCase())?.cor ?? TIPO_COR_FALLBACK[detalhe.tipo] ?? 'var(--primary)',borderRadius:12,padding:'16px',margin:'16px 0',color:'white'}}>
                <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',opacity:0.8,marginBottom:4}}>{tiposDB.find(t=>t.nome.toLowerCase()===detalhe.tipo.toLowerCase())?.nome ?? detalhe.tipo}</p>
                <p style={{fontSize:18,fontWeight:800,marginBottom:4}}>{detalhe.titulo}</p>
                <p style={{fontSize:13,opacity:0.9}}>{fmtHora(detalhe.hora_inicio)} — {fmtHora(detalhe.hora_fim)}</p>
              </div>

              {/* Infos */}
              <div className="info-section mb-3">
                <div className="info-section-title">Detalhes</div>
                {detalhe.local && <div className="info-row"><span className="info-label">Local</span><span className="info-value">{detalhe.local}</span></div>}
                <div className="info-row"><span className="info-label">Status</span><span className={`badge ${cfg.badge}`}>{cfg.label}</span></div>
                {detalhe.descricao && <div className="info-row"><span className="info-label">Descricao</span><span className="info-value" style={{fontSize:13}}>{detalhe.descricao}</span></div>}
              </div>

              {/* Ministracao vinculada — clicavel */}
              {min && (
                <button
                  onClick={() => { setDetalhe(null); navigate('/ministracoes/' + min.id) }}
                  style={{width:'100%',background:'white',border:'1px solid var(--border)',borderRadius:14,padding:'14px 16px',marginBottom:12,cursor:'pointer',fontFamily:'inherit',textAlign:'left',boxShadow:'var(--shadow-sm)',transition:'box-shadow 0.12s'}}
                >
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:32,height:32,borderRadius:8,background:'#F3F0FF',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <span className="icon icon-sm" style={{color:'#6B46C1'}}>church</span>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#6B46C1'}}>Ministracao vinculada</span>
                    </div>
                    <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>chevron_right</span>
                  </div>
                  <p style={{fontWeight:700,fontSize:15,marginBottom:4}}>{min.titulo}</p>
                  {ministrante && <p style={{fontSize:13,color:'var(--text2)',marginBottom:2}}>Ministrante: {ministrante.name}</p>}
                  {min.tema && <p style={{fontSize:13,color:'var(--muted)'}}>Tema: {min.tema}</p>}
                </button>
              )}

              {/* Teatro vinculado — clicavel */}
              {tea && (
                <button
                  onClick={() => { setDetalhe(null); navigate('/teatro/' + tea.id) }}
                  style={{width:'100%',background:'white',border:'1px solid var(--border)',borderRadius:14,padding:'14px 16px',marginBottom:12,cursor:'pointer',fontFamily:'inherit',textAlign:'left',boxShadow:'var(--shadow-sm)',transition:'box-shadow 0.12s'}}
                >
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:32,height:32,borderRadius:8,background:'#FFF3E0',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <span className="icon icon-sm" style={{color:'var(--accent)'}}>theater_comedy</span>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--accent)'}}>Teatro vinculado</span>
                    </div>
                    <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>chevron_right</span>
                  </div>
                  <p style={{fontWeight:700,fontSize:15,marginBottom:4}}>{tea.nome}</p>
                  {tea.local && <p style={{fontSize:13,color:'var(--text2)',marginBottom:2}}>Local: {tea.local}</p>}
                  {tea.descricao && <p style={{fontSize:13,color:'var(--muted)'}}>{tea.descricao}</p>}
                </button>
              )}

              {/* Acoes de status */}
              {canEdit && (
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
                  {detalhe.status==='planejado'    && <button className="btn btn-sm" style={{background:'var(--info-bg)',color:'var(--info)'}} onClick={()=>mudarStatus(detalhe.id,'em_andamento')}>Iniciar</button>}
                  {detalhe.status==='em_andamento' && <button className="btn btn-sm" style={{background:'var(--success-bg)',color:'var(--success)'}} onClick={()=>mudarStatus(detalhe.id,'concluido')}>Concluir</button>}
                  {detalhe.status!=='cancelado'    && <button className="btn btn-sm" style={{background:'var(--warning-bg)',color:'var(--warning)'}} onClick={()=>mudarStatus(detalhe.id,'cancelado')}>Cancelar</button>}
                  <button className="btn btn-sm btn-ghost" onClick={()=>{setDetalhe(null);abrirEdicao(detalhe)}}>Editar</button>
                  <button className="btn btn-sm" style={{background:'var(--danger-bg)',color:'var(--danger)'}} onClick={()=>excluir(detalhe.id)}>Excluir</button>
                </div>
              )}

              {/* Reverter status — SÓ admin, quando não está "Planejado" */}
              {ehAdmin && detalhe.status!=='planejado' && (
                <button className="btn btn-sm btn-full" style={{background:'var(--bg)',color:'var(--text2)',border:'1px solid var(--border)',marginBottom:12}} onClick={()=>reverterStatus(detalhe.id)}>
                  <span className="icon icon-sm">undo</span> Reverter status (voltar pra Planejado)
                </button>
              )}

              <button className="btn btn-ghost btn-full" onClick={()=>setDetalhe(null)}>Fechar</button>
            </div>
          </div>
        )
      })()}

      {/* Modal criar/editar */}
      {modal && canEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0 16px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?'Editar item':'Nova atividade'}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
            <form onSubmit={salvar}>

              {/* 1. TIPO primeiro */}
              <div className="form-group">
                <label className="form-label">Tipo <span className="req">*</span></label>
                <Seletor titulo="Tipo" value={form.tipo} onChange={v=>setForm(f=>({...f,tipo:v, ministracao_id:'', theater_id:'', cardapio_id:''}))}
                  opcoes={tiposDB.map(t=>({value:t.nome.toLowerCase(),label:t.nome}))}/>
              </div>

              {/* 2. Vínculo (feito SÓ aqui no cronograma): ministração + teatro juntos.
                     Cada ministração/teatro só entra uma vez — os já usados somem da lista. */}
              {(ehTipoChave('ministracao') || ehTipoChave('teatro')) && (
                <>
                  <div className="form-group">
                    <label className="form-label">Vincular Ministração</label>
                    <p className="form-hint mb-2">O título seguirá o nome da ministração. Cada ministração só pode ser usada uma vez.</p>
                    <Seletor titulo="Ministração" placeholder="Nenhuma" value={form.ministracao_id} onChange={onSelectMinistracao}
                      opcoes={[{value:'',label:'Nenhuma'}, ...ministrações.filter(m=>!minUsadas.has(m.id)||m.id===form.ministracao_id).map(m=>({value:m.id,label:m.titulo}))]}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vincular Teatro (opcional)</label>
                    <p className="form-hint mb-2">Cada teatro só pode ser usado uma vez.</p>
                    <Seletor titulo="Teatro" placeholder="Nenhum" value={form.theater_id} onChange={onSelectTeatro}
                      opcoes={[{value:'',label:'Nenhum'}, ...teatros.filter(t=>!teaUsados.has(t.id)||t.id===form.theater_id).map(t=>({value:t.id,label:t.nome}))]}/>
                  </div>
                </>
              )}

              {/* 2b. Se REFEIÇÃO: selecionar cardápio (título = Refeição + tipo) */}
              {ehTipoChave('refeicao') && (
                <div className="form-group">
                  <label className="form-label">Cardápio</label>
                  <p className="form-hint mb-2">Criado em Cozinha → Cardápio. O título seguirá o tipo (ex: Refeição - Almoço).</p>
                  <Seletor titulo="Cardápio" placeholder="Selecione um cardápio..." value={form.cardapio_id} onChange={onSelectCardapio}
                    opcoes={cardapios.map(c=>({value:c.id,label:`${c.tipo_refeicao_nome ?? 'Refeição'}${c.titulo?` — ${c.titulo}`:''}`}))}/>
                </div>
              )}

              <div style={{height:1,background:'var(--border)',margin:'4px 0 16px'}}/>

              {/* 3. Título — para ministração/refeição vem preenchido, mas pode editar tudo */}
              <div className="form-group">
                <label className="form-label">Título <span className="req">*</span></label>
                <input className="form-input" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} required />
                {(ehTipoChave('ministracao')||ehTipoChave('refeicao')) && <p className="form-hint mt-1">Preenchido automaticamente ao vincular, mas você pode editar.</p>}
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Data e hora programada <span className="req">*</span></label>
                  <DataHora modo="datetime" value={form.hora_inicio} onChange={v=>setForm(f=>({...f,hora_inicio:v}))} min={(evento as any)?.start_date} max={(evento as any)?.end_date}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Duração <span className="req">*</span></label>
                  <div style={{display:'flex',gap:10,alignItems:'center'}}>
                    <div style={{flex:1}}>
                      <input className="form-input" type="number" min="0" placeholder="0" value={Math.floor((Number(form.duracao_minutos)||0)/60)}
                        onChange={e=>{const h=Number(e.target.value)||0;const m=(Number(form.duracao_minutos)||0)%60;setForm(f=>({...f,duracao_minutos:String(h*60+m)}))}} />
                      <span style={{fontSize:11,color:'var(--muted)',marginTop:4,display:'block',textAlign:'center'}}>horas</span>
                    </div>
                    <span style={{fontSize:20,fontWeight:800,color:'var(--muted)',marginTop:-14}}>:</span>
                    <div style={{flex:1}}>
                      <input className="form-input" type="number" min="0" max="59" placeholder="00" value={(Number(form.duracao_minutos)||0)%60}
                        onChange={e=>{const m=Math.min(59,Number(e.target.value)||0);const h=Math.floor((Number(form.duracao_minutos)||0)/60);setForm(f=>({...f,duracao_minutos:String(h*60+m)}))}} />
                      <span style={{fontSize:11,color:'var(--muted)',marginTop:4,display:'block',textAlign:'center'}}>minutos</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Local</label>
                <Seletor titulo="Local" placeholder="Selecionar local..." value={form.local} onChange={v=>setForm(f=>({...f,local:v}))}
                  opcoes={[{value:'',label:'Sem local'}, ...locais.map(l=>({value:l.nome,label:l.nome}))]}/>
              </div>

              <div className="form-group">
                <label className="form-label">Descrição</label>
                <textarea className="form-textarea" style={{minHeight:70}} value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} />
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Salvando...':editando?'Salvar':'Adicionar'}
              </button>
            </form>
          </div>
        </div>
      )}
      {cronometro && (
        <CronometroPopup item={cronometro} podeControlar={podeCronometro} onClose={()=>{setCronometro(null);carregar()}} onUpdate={carregar} />
      )}

      {/* ===== IMPRESSÃO — reflete exatamente o que está na tela (mesmos grupos/filtro) ===== */}
      {imprimir==='resumido-slim' && (
        <PrintOverlay titulo="Cronograma (resumido)" onClose={()=>setImprimir(null)}>
          <CronogramaImpressao titulo={`CRONOGRAMA ${evento?.name ? evento.name.toUpperCase() : 'ENCONTRO'}`} dias={diasPoster} />
        </PrintOverlay>
      )}

      {imprimir && imprimir!=='resumido-slim' && (
        <PrintOverlay titulo={imprimir==='inteiro'?'Cronograma':'Cronograma com detalhes'} onClose={()=>setImprimir(null)}>
          {Object.keys(grupos).length===0
            ? <p style={{fontSize:13,color:'#6b7280'}}>Nada para o filtro atual.</p>
            : Object.entries(grupos).map(([hora,items])=>(
              <div key={hora}>
                <div style={{fontWeight:800,fontSize:13,color:'#6b7280',margin:'14px 0 6px'}}>{hora}</div>
                {items.map(item=>{
                  const { min, tea, ministrante } = getInfo(item)
                  const cor = tiposDB.find(t=>t.nome.toLowerCase()===item.tipo.toLowerCase())?.cor ?? TIPO_COR_FALLBACK[item.tipo] ?? '#00A99D'
                  const tipoNome = tiposDB.find(t=>t.nome.toLowerCase()===item.tipo.toLowerCase())?.nome ?? item.tipo
                  const det = imprimir==='detalhado'
                  const mfoto = min?.ministrante_id ? pessoaFoto[min.ministrante_id] : null
                  const atores = tea ? (elencoPorTeatro[tea.id] ?? []) : []
                  return (
                    <div key={item.id} style={{display:'flex',border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden',marginBottom:8,breakInside:'avoid'}}>
                      <div style={{width:5,background:cor,flexShrink:0}}/>
                      <div style={{padding:'8px 12px',flex:1}}>
                        <p style={{fontSize:12,color:'#6b7280'}}>{fmtHora(item.hora_inicio)} — {fmtHora(item.hora_fim)}</p>
                        <p style={{fontWeight:700,fontSize:14,...(ehConcluido(item)?{textDecoration:'line-through',opacity:0.6}:{})}}>{min?.titulo ?? item.titulo}</p>
                        {/* linha resumo: no modo "com detalhes" não repete ministrante/teatro (evita duplicidade) */}
                        <p style={{fontSize:12,color:'#6b7280'}}>
                          {tipoNome}{item.local?` · ${item.local}`:''}{!det&&ministrante?` · ${ministrante.name.split(' ')[0]}`:''}{!det&&tea?` · ${tea.nome}`:''}
                        </p>
                        {det && (min || tea || item.descricao) && (
                          <div style={{marginTop:6,fontSize:12,color:'#374151',borderTop:'1px dashed #e5e7eb',paddingTop:8}}>
                            <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                            {min && (
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                                  <div style={{width:40,height:40,borderRadius:'50%',overflow:'hidden',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                    {mfoto?.photo_url?<img src={mfoto.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontWeight:700,color:'#6b7280',fontSize:13}}>{getInitials(mfoto?.name ?? ministrante?.name ?? '?')}</span>}
                                  </div>
                                  <div>
                                    <p style={{fontWeight:700}}>Ministrante: {mfoto?.name ?? ministrante?.name ?? '—'}</p>
                                    {min.tema && <p>Tema: {min.tema}</p>}
                                  </div>
                                </div>
                                {min?.descricao && <p style={{whiteSpace:'pre-wrap'}}>{min.descricao}</p>}
                              </div>
                            )}
                            {tea && (
                              <div style={{flex:1,minWidth:0}}>
                                <p style={{fontWeight:700}}>🎭 Teatro: {tea.nome}</p>
                                {tea.descricao && <p style={{whiteSpace:'pre-wrap'}}>{tea.descricao}</p>}
                                {atores.length>0 && (
                                  <div style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:8}}>
                                    {atores.map((a,ix)=>{
                                      const pf = pessoaFoto[a.person_id]; const pgn = a.personagem_id ? personagensMap[a.personagem_id] : ''
                                      return (
                                        <div key={ix} style={{width:78,textAlign:'center'}}>
                                          <div style={{width:56,height:56,borderRadius:'50%',margin:'0 auto 3px',overflow:'hidden',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid #e5e7eb'}}>
                                            {pf?.photo_url?<img src={pf.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontWeight:700,color:'#6b7280',fontSize:16}}>{getInitials(pf?.name ?? '?')}</span>}
                                          </div>
                                          {pgn && <p style={{fontSize:11,fontWeight:700,lineHeight:1.15}}>{pgn}</p>}
                                          <p style={{fontSize:11,color:'#6b7280',lineHeight:1.15}}>{pf?.name?.split(' ')[0] ?? ''}</p>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                            </div>
                            {!min && !tea && item.descricao && <p style={{whiteSpace:'pre-wrap'}}>{item.descricao}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
        </PrintOverlay>
      )}
    </div>
  )
}
