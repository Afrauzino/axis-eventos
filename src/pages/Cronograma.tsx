import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtHora, isAdmin, nowLocalInput, getInitials } from '../utils'
import { useEvento } from '../hooks/useEvento'
import PrintOverlay from '../components/PrintOverlay'
import CronometroPopup from '../components/CronometroPopup'
import CronometroDisplay from '../components/CronometroDisplay'
import type { Profile } from '../App'

type TipoAtividade = { id:string; nome:string; cor:string; chave?:string|null; protegido?:boolean }
type Ministracao = { id:string; titulo:string; ministrante_id:string|null; local:string|null; descricao:string|null; tema:string|null }
type Teatro      = { id:string; nome:string; local:string|null; descricao:string|null }
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

export default function Cronograma({ profile }: { profile?: Profile }) {
  const navigate = useNavigate()
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
  const [imprimir, setImprimir]       = useState<null|'inteiro'|'detalhado'>(null)
  const [editando, setEditando]       = useState<Item|null>(null)
  const [salvando, setSalvando]       = useState(false)
  const [erro, setErro]               = useState('')
  const hoje = new Date()
  const [dataSel, setDataSel]         = useState(hoje)
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
  const [pessoaFoto, setPessoaFoto] = useState<Record<string,{name:string;photo_url:string|null}>>({})
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

  const canEdit = profile && isAdmin(profile.user_role)

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
      supabase.from('ministrações').select('id,titulo,ministrante_id,local,descricao,tema').eq('event_id', evento.id).order('titulo'),
      supabase.from('theaters').select('id,nome,local,descricao').eq('event_id', evento.id).order('nome'),
      supabase.from('locais').select('id,nome,tipo').eq('event_id', evento.id).order('nome'),
      supabase.from('people').select('id,name').eq('event_id', evento.id).eq('role_type','worker').order('name'),
      supabase.from('cronograma_tipos').select('id,nome,cor,chave,protegido').eq('ativo',true).order('ordem'),
      supabase.from('cozinha_cardapios').select('id,tipo_refeicao_nome,titulo').eq('event_id', evento.id),
      supabase.from('people').select('id,name,photo_url').eq('event_id', evento.id),
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
    const fmap: Record<string,{name:string;photo_url:string|null}> = {}; (peAll.data ?? []).forEach((p:any)=>{ fmap[p.id]={name:p.name,photo_url:p.photo_url} })
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
      hora_inicio: new Date(item.hora_inicio).toISOString().slice(0,16),
      hora_fim: new Date(item.hora_fim).toISOString().slice(0,16),
      duracao_minutos: String(item.duracao_minutos ?? Math.max(1, Math.round((new Date(item.hora_fim).getTime()-new Date(item.hora_inicio).getTime())/60000))),
      local: item.local ?? '',
      descricao: item.descricao ?? '',
      ministracao_id: item.ministracao_id ?? '',
      theater_id: item.theater_id ?? '',
      cardapio_id: (item as any).cardapio_id ?? '',
    })
    setErro(''); setModal(true)
  }

  // Ao selecionar ministracao, preenche horario e local automaticamente
  function onSelectMinistracao(id: string) {
    const min = ministrações.find(m => m.id === id)
    setForm(f => ({
      ...f,
      ministracao_id: id,
      titulo: min ? min.titulo : f.titulo,
      local: min?.local ?? f.local,
      descricao: min?.descricao ?? f.descricao,
      tipo: 'ministracao',
    }))
  }

  // Ao selecionar teatro, preenche nome automaticamente
  function onSelectTeatro(id: string) {
    const te = teatros.find(t => t.id === id)
    setForm(f => ({
      ...f,
      theater_id: id,
      titulo: te ? te.nome : f.titulo,
      local: te?.local ?? f.local,
      tipo: 'teatro',
    }))
  }

  const mesmodia = (iso: string) => new Date(iso).toDateString() === dataSel.toDateString()
  // "todos" mostra itens não concluídos de todos os dias; concluídos só no filtro
  const filtrados = filtro === 'todos'
    ? itens.filter(i => i.status !== 'concluido' && i.cron_estado !== 'encerrado')
    : itens.filter(i => mesmodia(i.hora_inicio) && i.status === filtro)

  // Agrupar por hora
  const grupos: Record<string, Item[]> = {}
  filtrados.forEach(item => {
    const d = new Date(item.hora_inicio)
    const key = filtro === 'todos'
      ? `${d.toLocaleDateString('pt-BR', {day:'2-digit',month:'short'})} · ${d.getHours()}h`
      : `${d.getHours()}h`
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(item)
  })

  // Info extra de um item
  function getInfo(item: Item) {
    const min = item.ministracao_id ? ministrações.find(m => m.id === item.ministracao_id) : null
    const tea = item.theater_id     ? teatros.find(t => t.id === item.theater_id)           : null
    const ministrante = min?.ministrante_id ? ministrantes.find(p => p.id === min.ministrante_id) : null
    return { min, tea, ministrante }
  }

  return (
    <div className="page">
      {/* Navegacao por data */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'white',borderRadius:14,padding:'12px 16px',marginBottom:14,boxShadow:'var(--shadow-sm)'}}>
        <button onClick={()=>{const d=new Date(dataSel);d.setDate(d.getDate()-1);setDataSel(d)}} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontFamily:'inherit'}}>
          <span className="icon icon-sm">chevron_left</span>
        </button>
        <div style={{textAlign:'center'}}>
          <p style={{fontWeight:700,fontSize:15}}>{dataSel.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</p>
          {dataSel.toDateString() !== hoje.toDateString() && (
            <button onClick={()=>setDataSel(new Date(hoje))} style={{background:'none',border:'none',color:'var(--primary)',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:500,marginTop:2}}>
              Voltar para hoje
            </button>
          )}
        </div>
        <button onClick={()=>{const d=new Date(dataSel);d.setDate(d.getDate()+1);setDataSel(d)}} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontFamily:'inherit'}}>
          <span className="icon icon-sm">chevron_right</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="filter-bar">
        {[['todos','Todos (todos os dias)'],['planejado','Planejados'],['em_andamento','Em andamento'],['concluido','Concluidos']].map(([v,l])=>(
          <button key={v} className={`chip ${filtro===v?'active':''}`} onClick={()=>setFiltro(v)}>{l}</button>
        ))}
      </div>

      {itens.length>0 && (
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          <button className="btn btn-outline btn-sm" style={{flex:1}} onClick={()=>setImprimir('inteiro')}>
            <span className="icon icon-sm">print</span> Imprimir inteiro
          </button>
          <button className="btn btn-outline btn-sm" style={{flex:1}} onClick={()=>setImprimir('detalhado')}>
            <span className="icon icon-sm">print</span> Com detalhes
          </button>
        </div>
      )}

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
            return (
              <div key={item.id} className="sched-card" onClick={() => setDetalhe(item)}>
                <div className="sched-bar" style={{background: tiposDB.find(t=>t.nome.toLowerCase()===item.tipo.toLowerCase())?.cor ?? TIPO_COR_FALLBACK[item.tipo] ?? 'var(--primary)'}} />
                <div className="sched-body">
                  <div className="sched-time">{fmtHora(item.hora_inicio)} — {fmtHora(item.hora_fim)}</div>
                  <div className="sched-title" style={item.status==='concluido'?{textDecoration:'line-through',opacity:0.6}:undefined}>{min?.titulo ?? item.titulo}{item.status==='concluido' && <span style={{marginLeft:6,fontSize:11,color:'var(--success)'}}>✓ concluído</span>}</div>
                  <div className="sched-desc">
                    {tiposDB.find(t=>t.nome.toLowerCase()===item.tipo.toLowerCase())?.nome ?? item.tipo}
                    {item.local ? ` · ${item.local}` : ''}
                    {ministrante ? ` · ${ministrante.name.split(' ')[0]}` : ''}
                    {tea ? ` · ${tea.nome}` : ''}
                  </div>
                  <CronometroDisplay item={item} />
                </div>
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
                <select className="form-select" value={form.tipo} onChange={e=>{const v=e.target.value; setForm(f=>({...f,tipo:v, ministracao_id:'', theater_id:'', cardapio_id:''}))}}>
                  {tiposDB.map(t=><option key={t.id} value={t.nome.toLowerCase()}>{t.nome}</option>)}
                </select>
              </div>

              {/* 2. Se MINISTRAÇÃO: vincular ministração (e teatro, que só existe dentro dela) */}
              {ehTipoChave('ministracao') && (
                <>
                  <div className="form-group">
                    <label className="form-label">Vincular Ministração</label>
                    <p className="form-hint mb-2">O título seguirá o nome da ministração.</p>
                    <select className="form-select" value={form.ministracao_id} onChange={e=>onSelectMinistracao(e.target.value)}>
                      <option value="">Nenhuma</option>
                      {ministrações.map(m=><option key={m.id} value={m.id}>{m.titulo}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vincular Teatro (opcional)</label>
                    <select className="form-select" value={form.theater_id} onChange={e=>onSelectTeatro(e.target.value)}>
                      <option value="">Nenhum</option>
                      {teatros.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* 2b. Se REFEIÇÃO: selecionar cardápio (título = Refeição + tipo) */}
              {ehTipoChave('refeicao') && (
                <div className="form-group">
                  <label className="form-label">Cardápio</label>
                  <p className="form-hint mb-2">Criado em Cozinha → Cardápio. O título seguirá o tipo (ex: Refeição - Almoço).</p>
                  <select className="form-select" value={form.cardapio_id} onChange={e=>onSelectCardapio(e.target.value)}>
                    <option value="">Selecione um cardápio...</option>
                    {cardapios.map(c=><option key={c.id} value={c.id}>{c.tipo_refeicao_nome ?? 'Refeição'}{c.titulo?` — ${c.titulo}`:''}</option>)}
                  </select>
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
                  <input className="form-input" type="datetime-local" value={form.hora_inicio} onChange={e=>setForm(f=>({...f,hora_inicio:e.target.value}))} required
                    min={(evento as any)?.start_date ? `${(evento as any).start_date}T00:00` : undefined}
                    max={(evento as any)?.end_date ? `${(evento as any).end_date}T23:59` : undefined} />
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
                <select className="form-select" value={form.local} onChange={e=>setForm(f=>({...f,local:e.target.value}))}>
                  <option value="">Selecionar local...</option>
                  {locais.map(l=><option key={l.id} value={l.nome}>{l.nome}</option>)}
                </select>
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
      {imprimir && (
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
                        <p style={{fontWeight:700,fontSize:14,...(item.status==='concluido'?{textDecoration:'line-through',opacity:0.6}:{})}}>{min?.titulo ?? item.titulo}</p>
                        {/* linha resumo: no modo "com detalhes" não repete ministrante/teatro (evita duplicidade) */}
                        <p style={{fontSize:12,color:'#6b7280'}}>
                          {tipoNome}{item.local?` · ${item.local}`:''}{!det&&ministrante?` · ${ministrante.name.split(' ')[0]}`:''}{!det&&tea?` · ${tea.nome}`:''}
                        </p>
                        {det && (min || tea || item.descricao) && (
                          <div style={{marginTop:6,fontSize:12,color:'#374151',borderTop:'1px dashed #e5e7eb',paddingTop:8}}>
                            {min && (
                              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                                <div style={{width:40,height:40,borderRadius:'50%',overflow:'hidden',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                  {mfoto?.photo_url?<img src={mfoto.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontWeight:700,color:'#6b7280',fontSize:13}}>{getInitials(mfoto?.name ?? ministrante?.name ?? '?')}</span>}
                                </div>
                                <div>
                                  <p style={{fontWeight:700}}>Ministrante: {mfoto?.name ?? ministrante?.name ?? '—'}</p>
                                  {min.tema && <p>Tema: {min.tema}</p>}
                                </div>
                              </div>
                            )}
                            {min?.descricao && <p style={{whiteSpace:'pre-wrap',marginBottom:6}}>{min.descricao}</p>}
                            {tea && (
                              <div style={{marginTop:min?4:0}}>
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
