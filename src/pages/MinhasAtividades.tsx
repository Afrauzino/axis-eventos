import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtHora, fmtDataLonga, getInitials, isAdmin } from '../utils'
import { useEvento } from '../hooks/useEvento'
import { toast } from '../components/Toast'
import type { Profile } from '../App'

type Escala = {
  id:string; title:string; start_time:string; end_time:string
  location:string|null; notes:string|null
  status:'confirmed'|'concluido'|'cancelado'|string; team_id:string|null; tipo?:string|null
}
type ItemChk = { id:string; escala_id:string; texto:string; ordem:number; feito:boolean }
type Alerta = { id:string; title:string; priority:string }

export default function MinhasAtividades({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const { evento, loading: evLoading } = useEvento()
  const [minhas, setMinhas]     = useState<Escala[]>([])
  const [alertas, setAlertas]   = useState<Alerta[]>([])
  const [loading, setLoading]   = useState(true)
  const [detalhe, setDetalhe]   = useState<Escala|null>(null)
  const [escalaChk, setEscalaChk] = useState<ItemChk[]>([])
  const [filtro, setFiltro]     = useState<'todas'|'pendentes'|'concluidas'>('todas')
  const [myPersonId, setMyPersonId] = useState<string|null>(null)
  const [cardapios, setCardapios] = useState<{id:string;tipo_refeicao_nome:string|null;titulo:string|null;itens:string|null;data_servir:string|null}[]>([])
  const [cardapioDetalhe, setCardapioDetalhe] = useState<{id:string;tipo_refeicao_nome:string|null;titulo:string|null;itens:string|null;data_servir:string|null}|null>(null)
  const [meusAfilhados, setMeusAfilhados] = useState<{id:string;name:string;photo_url:string|null;pct:number;status:string}[]>([])
  // #11 — atividades vindas do Cronograma (sou ministrante / estou no elenco)
  const [cronoAtividades, setCronoAtividades] = useState<(Escala & { tipo:'ministracao'|'teatro' })[]>([])
  // Admin: aprovações pendentes caem aqui e somem ao aprovar
  const admin = isAdmin(profile.user_role) || profile.is_admin
  const [aprovacoes, setAprovacoes] = useState<{user_id:string;name:string;user_role:string|null;photo_url:string|null;church:string|null}[]>([])

  useEffect(() => {
    if (evLoading) return
    if (!evento) { setLoading(false); return }
    carregar()
  }, [evento, evLoading])

  useEffect(() => { if (admin) carregarAprovacoes() }, [admin])

  async function carregarAprovacoes() {
    const { data: profs } = await supabase.from('profiles').select('user_id,name,user_role').eq('role_status','pending')
    const ids = (profs ?? []).map(p => p.user_id)
    const fotos: Record<string,{photo_url:string|null;church:string|null}> = {}
    if (ids.length) {
      const { data: pe } = await supabase.from('people').select('user_id,photo_url,church').in('user_id', ids)
      for (const p of pe ?? []) if (p.user_id) fotos[p.user_id] = { photo_url: p.photo_url, church: p.church }
    }
    setAprovacoes((profs ?? []).map(p => ({ user_id: p.user_id, name: p.name || 'Sem nome', user_role: p.user_role ?? null, photo_url: fotos[p.user_id]?.photo_url ?? null, church: fotos[p.user_id]?.church ?? null })))
  }

  async function aprovar(u: {user_id:string; name:string; user_role:string|null}) {
    const cargo = (u.user_role && u.user_role !== 'visitante') ? u.user_role : 'encontreiro'
    const { error } = await supabase.from('profiles').update({ role_status: 'approved', user_role: cargo }).eq('user_id', u.user_id)
    if (error) { toast.erro('Não foi possível aprovar.'); return }
    setAprovacoes(prev => prev.filter(x => x.user_id !== u.user_id))  // some da lista
    toast.sucesso(`${u.name.split(' ')[0]} aprovado!`)
  }

  async function carregar() {
    if (!evento) return
    setLoading(true)

    // Achar meu person_id
    const { data: myPerson } = await supabase
      .from('people').select('id')
      .eq('event_id', evento.id).eq('user_id', profile.user_id).maybeSingle()

    if (!myPerson) {
      // Usuário admin sem registro de pessoa — mostra cronograma geral
      const { data: cron } = await supabase
        .from('cronograma_eventos').select('*')
        .eq('event_id', evento.id).order('hora_inicio')
      // Map cronograma to escala shape
      const mapped = (cron??[]).map(c => ({
        id: c.id, title: c.titulo, start_time: c.hora_inicio, end_time: c.hora_fim,
        location: c.local, notes: c.descricao, status: c.status==='concluido'?'concluido':'pendente',
        team_id: null
      }))
      setMinhas(mapped)
      setLoading(false)
      return
    }

    setMyPersonId(myPerson.id)

    const [es, al, padrinhos, chkItens, chkStatus, afStatus] = await Promise.all([
      supabase.from('escalas').select('*')
        .eq('event_id', evento.id).eq('person_id', myPerson.id).order('start_time'),
      supabase.from('alerts').select('id,title,priority')
        .eq('event_id', evento.id).order('created_at',{ascending:false}).limit(3),
      supabase.from('correio_padrinhos').select('afiliado_id').eq('event_id', evento.id).eq('padrinho_id', myPerson.id),
      supabase.from('correio_checklist_itens').select('id').eq('event_id', evento.id),
      supabase.from('correio_checklist_status').select('afiliado_id,concluido').eq('event_id', evento.id),
      supabase.from('correio_afiliado_status').select('afiliado_id,status').eq('event_id', evento.id),
    ])
    setMinhas(es.data ?? [])
    setAlertas(al.data ?? [])

    // Checklist das MINHAS escalas (o que faltava chegar pra pessoa)
    const escalaIds = (es.data ?? []).map((e:any)=>e.id)
    if (escalaIds.length) {
      const { data: ck } = await supabase.from('escala_checklist').select('*').in('escala_id', escalaIds).order('ordem')
      setEscalaChk(ck ?? [])
    } else {
      setEscalaChk([])
    }

    // #11 — Cronograma → atividades pessoais (ministrante da ministração OU elenco do teatro)
    await carregarDoCronograma(myPerson.id)

    // Cardápios do dia: se eu sou membro de alguma equipe marcada como equipe_cardapio
    const { data: meusTimes } = await supabase.from('people_teams').select('team_id').eq('person_id', myPerson.id)
    const teamIds = (meusTimes ?? []).map(t=>t.team_id)
    if (teamIds.length > 0) {
      const { data: timesCardapio } = await supabase.from('teams').select('id').eq('equipe_cardapio', true).in('id', teamIds)
      if ((timesCardapio ?? []).length > 0) {
        const { data: cards } = await supabase.from('cozinha_cardapios')
          .select('id,tipo_refeicao_nome,titulo,itens,data_servir').eq('event_id', evento.id).order('data_servir')
        setCardapios(cards ?? [])
      } else setCardapios([])
    } else setCardapios([])

    // Carregar dados dos meus afilhados (se eu for padrinho)
    const afIds = (padrinhos.data ?? []).map(p => p.afiliado_id)
    if (afIds.length > 0) {
      const { data: pessoasAf } = await supabase.from('people')
        .select('id,name,photo_url').in('id', afIds)
      const totalItens = (chkItens.data ?? []).length
      const afilhadosData = (pessoasAf ?? []).map(pa => {
        const feitos = (chkStatus.data ?? []).filter(s => s.afiliado_id === pa.id && s.concluido).length
        const pct = totalItens > 0 ? Math.round((feitos / totalItens) * 100) : 0
        const status = (afStatus.data ?? []).find(s => s.afiliado_id === pa.id)?.status ?? 'em_processo'
        return { id: pa.id, name: pa.name, photo_url: pa.photo_url, pct, status }
      })
      setMeusAfilhados(afilhadosData)
    }
    setLoading(false)
  }

  // #11 — monta as atividades pessoais a partir do Cronograma
  async function carregarDoCronograma(personId: string) {
    if (!evento) return
    const { data: cronRows } = await supabase.from('cronograma_eventos')
      .select('id,titulo,hora_inicio,hora_fim,local,descricao,status,ministracao_id,theater_id')
      .eq('event_id', evento.id).order('hora_inicio')
    if (!cronRows || cronRows.length === 0) { setCronoAtividades([]); return }

    const minIds = cronRows.filter(c=>c.ministracao_id).map(c=>c.ministracao_id)
    const teaIds = cronRows.filter(c=>c.theater_id).map(c=>c.theater_id)

    // Ministrações em que EU sou o ministrante
    let minhasMinIds = new Set<string>()
    if (minIds.length) {
      const { data } = await supabase.from('ministrações').select('id').in('id', minIds).eq('ministrante_id', personId)
      minhasMinIds = new Set((data ?? []).map((m:any)=>m.id))
    }
    // Teatros em que EU estou no elenco
    let meusTeaIds = new Set<string>()
    if (teaIds.length) {
      const { data } = await supabase.from('teatro_elenco').select('theater_id').in('theater_id', teaIds).eq('person_id', personId)
      meusTeaIds = new Set((data ?? []).map((t:any)=>t.theater_id))
    }

    const atv = cronRows
      .filter(c => (c.ministracao_id && minhasMinIds.has(c.ministracao_id)) || (c.theater_id && meusTeaIds.has(c.theater_id)))
      .map(c => ({
        id: 'cron-' + c.id, title: c.titulo, start_time: c.hora_inicio, end_time: c.hora_fim,
        location: c.local, notes: c.descricao,
        // mantém o status real do cronograma (concluido/cancelado/pendente) p/ a barra de progresso
        status: c.status === 'concluido' ? 'concluido' : c.status === 'cancelado' ? 'cancelado' : 'pendente', team_id: null,
        tipo: (c.ministracao_id && minhasMinIds.has(c.ministracao_id)) ? 'ministracao' as const : 'teatro' as const,
      }))
    setCronoAtividades(atv)
  }

  async function concluir(id: string) {
    const novoStatus = 'concluido'
    if (myPersonId) {
      await supabase.from('escalas').update({ status: novoStatus }).eq('id', id)
    } else {
      await supabase.from('cronograma_eventos').update({ status: novoStatus }).eq('id', id)
    }
    setMinhas(prev => prev.map(a => a.id===id ? {...a, status: novoStatus} : a))
    setDetalhe(prev => prev?.id===id ? {...prev, status: novoStatus} : prev)
  }

  // A pessoa marca/desmarca um item do checklist da própria escala
  async function toggleItemChk(itemId: string, feito: boolean) {
    setEscalaChk(prev => prev.map(i => i.id===itemId ? {...i, feito} : i))
    await supabase.from('escala_checklist').update({ feito }).eq('id', itemId)
  }
  // Itens do checklist de uma escala
  function itensDaEscala(escalaId: string) {
    return escalaChk.filter(c => c.escala_id === escalaId).sort((a,b)=>a.ordem-b.ordem)
  }

  const pendentes  = minhas.filter(a => a.status !== 'concluido').length
  const concluidas = minhas.filter(a => a.status === 'concluido').length
  const total      = minhas.length

  // Progresso GERAL = escalas + afilhados (Correio) + atividades do Cronograma
  // Cancelados de afilhados saem da conta (igual à barra do Correio)
  const afilhadosAtivos     = meusAfilhados.filter(a => a.status !== 'cancelado')
  const afilhadosConcluidos = afilhadosAtivos.filter(a => a.status === 'concluido').length
  // Cronograma (ministração/teatro): entram na barra, mas só SOBEM quando o cronograma
  // estiver 'concluido' ou 'cancelado' (pendente/em andamento contam só no total).
  const cronoTotal  = cronoAtividades.length
  const cronoFeitas = cronoAtividades.filter(a => a.status === 'concluido' || a.status === 'cancelado').length
  const totalGeral      = total + afilhadosAtivos.length + cronoTotal
  const concluidasGeral = concluidas + afilhadosConcluidos + cronoFeitas
  const progresso  = totalGeral > 0 ? Math.round((concluidasGeral / totalGeral) * 100) : 0

  const exibir = filtro === 'pendentes'
    ? minhas.filter(a => a.status !== 'concluido')
    : filtro === 'concluidas'
      ? minhas.filter(a => a.status === 'concluido')
      : minhas

  if (loading) return (
    <div className="page">
      {[1,2,3].map(i=><div key={i} className="skeleton" style={{height:72,marginBottom:8,borderRadius:14}}/>)}
    </div>
  )

  return (
    <div className="page slide-up">
      <p className="text-sm text-muted mb-2">{fmtDataLonga(new Date().toISOString())}</p>

      {/* Admin: aprovações pendentes (some ao aprovar) */}
      {admin && aprovacoes.length > 0 && (
        <div style={{marginBottom:14}}>
          <div className="section-label" style={{marginBottom:8}}>🙋 Aprovações pendentes ({aprovacoes.length})</div>
          {aprovacoes.map(a => (
            <div key={a.user_id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderLeft:'3px solid var(--warning)'}}>
              <div onClick={()=>navigate('/admin')} style={{width:42,height:42,borderRadius:'50%',background:'var(--primary-light)',overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                {a.photo_url ? <img src={a.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{fontWeight:700,fontSize:14,color:'var(--primary)'}}>{getInitials(a.name)}</span>}
              </div>
              <div onClick={()=>navigate('/admin')} style={{flex:1,minWidth:0,cursor:'pointer'}}>
                <p style={{fontWeight:700,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</p>
                <p style={{fontSize:12,color:'var(--muted)'}}>{a.church || 'Aguardando aprovação'}</p>
              </div>
              <button onClick={()=>aprovar(a)} style={{background:'var(--success)',color:'white',border:'none',borderRadius:10,padding:'8px 14px',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'inherit',flexShrink:0,display:'flex',alignItems:'center',gap:4}}>
                <span className="icon icon-sm">check</span> Aprovar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Barra de progresso GERAL (escalas + afilhados) */}
      {totalGeral > 0 && (
        <div style={{background:'white',borderRadius:14,padding:'14px 16px',marginBottom:14,boxShadow:'var(--shadow-sm)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <p style={{fontSize:13,fontWeight:700}}>Meu progresso geral</p>
            <p style={{fontSize:14,fontWeight:800,color:progresso===100?'var(--success)':'var(--primary)'}}>{progresso}%</p>
          </div>
          <div style={{height:10,background:'var(--bg)',borderRadius:99,overflow:'hidden',marginBottom:6}}>
            <div style={{height:'100%',width:`${progresso}%`,background:progresso===100?'var(--success)':'var(--primary)',borderRadius:99,transition:'width 0.5s ease'}}/>
          </div>
          <p style={{fontSize:11,color:'var(--muted)'}}>
            {concluidasGeral} de {totalGeral} concluídas
            {total > 0 && afilhadosAtivos.length > 0 && ` (${concluidas}/${total} escalas + ${afilhadosConcluidos}/${afilhadosAtivos.length} afilhados)`}
            {progresso === 100 ? ' 🎉 Tudo concluído!' : ''}
          </p>
        </div>
      )}

      {/* Cardápios da cozinha (para membros da equipe de cardápio) */}
      {cardapios.length > 0 && (
        <div style={{marginBottom:14}}>
          <p style={{fontSize:13,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>🍽️ Cardápios a preparar</p>
          {cardapios.map(c => (
            <div key={c.id} onClick={()=>setCardapioDetalhe(c)} style={{background:'white',borderRadius:14,padding:'14px 16px',marginBottom:8,boxShadow:'var(--shadow-sm)',borderLeft:'4px solid #2F855A',cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:14,fontWeight:700}}>🍽️ {c.tipo_refeicao_nome ?? 'Refeição'}{c.titulo?` — ${c.titulo}`:''}</span>
                {c.data_servir && <span style={{fontSize:11,color:'var(--muted)',fontWeight:600}}>{new Date(c.data_servir+'T00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</span>}
              </div>
              {c.itens && <p style={{fontSize:13,color:'var(--muted)',whiteSpace:'pre-wrap',overflow:'hidden',textOverflow:'ellipsis',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{c.itens}</p>}
              <p style={{fontSize:11,color:'#2F855A',fontWeight:600,marginTop:4}}>Toque para ver completo →</p>
            </div>
          ))}
        </div>
      )}

      {/* Alertas recentes */}
      {alertas.length > 0 && (
        <>
          <div className="section-label">Alertas recentes</div>
          {alertas.map(a=>(
            <button key={a.id} className="list-card" onClick={()=>navigate('/alertas')}>
              <div className="list-card-bar" style={{background:a.priority==='critico'||a.priority==='urgente'?'var(--danger)':'var(--accent)'}}/>
              <div className="list-card-body">
                <div className="list-card-title">{a.title}</div>
                <div className="list-card-desc">{a.priority}</div>
              </div>
              <div className="list-card-chevron"><span className="icon icon-sm">chevron_right</span></div>
            </button>
          ))}
        </>
      )}

      {/* Meus Afilhados (Correio) */}
      {meusAfilhados.length > 0 && (
        <>
          <div className="section-label" style={{marginTop:14}}>Meus Afilhados (Correio)</div>
          <button onClick={()=>navigate('/correio')} style={{width:'100%',background:'white',borderRadius:14,padding:'12px 14px',marginBottom:8,boxShadow:'var(--shadow-sm)',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
            {meusAfilhados.map(af => {
              const concluido = af.status === 'concluido'
              const cancelado = af.status === 'cancelado'
              return (
                <div key={af.id} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',opacity:cancelado?0.5:1}}>
                  {af.photo_url
                    ? <img src={af.photo_url} alt="" style={{width:34,height:34,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
                    : <div style={{width:34,height:34,borderRadius:'50%',background:'var(--primary-light)',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,flexShrink:0}}>{af.name.charAt(0)}</div>
                  }
                  <span style={{flex:1,fontSize:13,fontWeight:600,textDecoration:cancelado?'line-through':'none'}}>{af.name.split(' ').slice(0,2).join(' ')}</span>
                  {cancelado
                    ? <span style={{fontSize:11,color:'var(--danger)',fontWeight:700}}>Cancelado</span>
                    : <span style={{fontSize:13,fontWeight:800,color:concluido?'var(--success)':'var(--primary)'}}>{af.pct}%</span>
                  }
                </div>
              )
            })}
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:4,marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)',color:'var(--primary)',fontSize:12,fontWeight:700}}>
              Abrir Correio <span className="icon icon-sm" style={{color:'var(--primary)'}}>chevron_right</span>
            </div>
          </button>
        </>
      )}

      {/* #11 — Minha agenda vinda do Cronograma (ministração/teatro) */}
      {cronoAtividades.length > 0 && (
        <>
          <div className="section-label" style={{marginTop:14}}>Minha agenda (Cronograma)</div>
          {cronoAtividades.map(item => (
            <div key={item.id} onClick={()=>setDetalhe(item)}
              style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,display:'flex',alignItems:'center',overflow:'hidden',cursor:'pointer',opacity:item.status==='concluido'?0.7:1}}>
              <div style={{width:4,alignSelf:'stretch',flexShrink:0,background:item.tipo==='teatro'?'#E8821A':'#6B46C1'}}/>
              <div style={{flex:1,padding:'12px 14px',minWidth:0}}>
                <p style={{fontSize:11,color:'var(--muted)',marginBottom:2}}>{item.tipo==='teatro'?'🎭 Teatro':'🎤 Ministração'} · {fmtHora(item.start_time)} — {fmtHora(item.end_time)}</p>
                <p style={{fontWeight:700,fontSize:14,textDecoration:item.status==='cancelado'?'line-through':'none'}}>{item.title}</p>
                {item.location && <p style={{fontSize:12,color:'var(--muted)',marginTop:1}}>{item.location}</p>}
              </div>
              {item.status==='concluido'
                ? <span className="icon" style={{color:'var(--success)',marginRight:12,flexShrink:0}}>check_circle</span>
                : item.status==='cancelado'
                  ? <span style={{fontSize:11,fontWeight:700,color:'var(--danger)',marginRight:12,flexShrink:0}}>Cancelado</span>
                  : <span className="icon icon-sm" style={{color:'var(--muted-light)',marginRight:12,flexShrink:0}}>chevron_right</span>}
            </div>
          ))}
        </>
      )}

      {/* Filtros */}
      {total > 0 && (
        <div style={{display:'flex',gap:6,marginTop:12,marginBottom:8,overflowX:'auto',scrollbarWidth:'none'}}>
          {([['todas','Todas'],['pendentes',`Pendentes (${pendentes})`],['concluidas',`Concluídas (${concluidas})`]] as const).map(([v,l])=>(
            <button key={v} onClick={()=>setFiltro(v)}
              style={{flexShrink:0,padding:'5px 12px',borderRadius:20,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600,
                border:`1.5px solid ${filtro===v?'var(--primary)':'var(--border)'}`,
                background:filtro===v?'var(--primary-light)':'white',
                color:filtro===v?'var(--primary-dark)':'var(--text2)'}}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Lista de atividades escaladas */}
      {total > 0 && <div className="section-label" style={{marginTop:8}}>Minhas escalas</div>}
      {total === 0 && meusAfilhados.length === 0 && cronoAtividades.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>assignment</span></div>
          <p className="empty-title">Nenhuma atividade</p>
          <p className="empty-desc">Você ainda não tem atividades escaladas neste evento.</p>
        </div>
      ) : total === 0 ? null : exibir.length === 0 ? (
        <div style={{background:'white',borderRadius:14,padding:'20px',textAlign:'center',boxShadow:'var(--shadow-sm)'}}>
          <p className="text-muted text-sm">
            {filtro==='concluidas' ? 'Nenhuma atividade concluída ainda.' : '✅ Todas concluídas!'}
          </p>
        </div>
      ) : exibir.map(item => (
        <div key={item.id}
          onClick={()=>setDetalhe(item)}
          style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,display:'flex',alignItems:'center',overflow:'hidden',cursor:'pointer',opacity:item.status==='concluido'?0.7:1}}>
          <div style={{width:4,alignSelf:'stretch',flexShrink:0,background:item.status==='concluido'?'var(--success)':'var(--primary)'}}/>
          <div style={{flex:1,padding:'12px 14px',minWidth:0}}>
            <p style={{fontSize:11,color:'var(--muted)',marginBottom:2}}>{fmtHora(item.start_time)} — {fmtHora(item.end_time)}</p>
            <p style={{fontWeight:700,fontSize:14,textDecoration:item.status==='concluido'?'line-through':'none'}}>{item.title}</p>
            {item.location && <p style={{fontSize:12,color:'var(--muted)',marginTop:1}}>{item.location}</p>}
            {(() => {
              const itens = itensDaEscala(item.id)
              if (!itens.length) return null
              const feitos = itens.filter(i=>i.feito).length
              const pct = Math.round(feitos/itens.length*100)
              return (
                <div style={{marginTop:7}}>
                  <div style={{height:6,background:'#eee',borderRadius:99,overflow:'hidden'}}>
                    <div style={{width:pct+'%',height:'100%',background:pct===100?'var(--success)':'var(--primary)',borderRadius:99}}/>
                  </div>
                  <p style={{fontSize:11,color:'var(--muted)',fontWeight:600,marginTop:3}}>{feitos}/{itens.length} do checklist</p>
                </div>
              )
            })()}
          </div>
          {item.status === 'concluido'
            ? <span className="icon" style={{color:'var(--success)',marginRight:12,flexShrink:0}}>check_circle</span>
            : <span className="icon icon-sm" style={{color:'var(--muted-light)',marginRight:12,flexShrink:0}}>chevron_right</span>
          }
        </div>
      ))}

      {/* Painel de detalhe */}
      {detalhe && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}
          onClick={e=>e.target===e.currentTarget&&setDetalhe(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'85vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 16px'}}/>

            <div style={{background:detalhe.status==='concluido'?'var(--success)':'var(--primary)',borderRadius:12,padding:'16px',marginBottom:16,color:'white'}}>
              <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',opacity:0.8,marginBottom:4}}>
                {detalhe.status==='concluido' ? '✓ Concluída' : 'Atividade'}
              </p>
              <p style={{fontSize:18,fontWeight:800,marginBottom:4}}>{detalhe.title}</p>
              <p style={{fontSize:13,opacity:0.9}}>{fmtHora(detalhe.start_time)} — {fmtHora(detalhe.end_time)}</p>
            </div>

            {(detalhe.location || detalhe.notes) && (
              <div style={{background:'var(--bg)',borderRadius:12,padding:'14px 16px',marginBottom:12}}>
                {detalhe.location && (
                  <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:detalhe.notes?8:0}}>
                    <span className="icon icon-sm" style={{color:'var(--muted)'}}>location_on</span>
                    <p style={{fontSize:14,color:'var(--text2)'}}>{detalhe.location}</p>
                  </div>
                )}
                {detalhe.notes && (
                  <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                    <span className="icon icon-sm" style={{color:'var(--muted)',marginTop:2}}>info</span>
                    <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.6}}>{detalhe.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Checklist da atividade — itens que o líder montou (a pessoa marca aqui) */}
            {(() => {
              const itens = itensDaEscala(detalhe.id)
              if (!itens.length) return null
              const feitos = itens.filter(i=>i.feito).length
              const pct = Math.round(feitos/itens.length*100)
              return (
                <div style={{marginBottom:12}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <p className="section-label" style={{margin:0}}>Checklist</p>
                    <span style={{fontSize:12,fontWeight:700,color:'var(--primary)'}}>{feitos}/{itens.length} · {pct}%</span>
                  </div>
                  <div style={{height:8,background:'#eee',borderRadius:99,overflow:'hidden',marginBottom:10}}>
                    <div style={{width:pct+'%',height:'100%',background:pct===100?'var(--success)':'var(--primary)',borderRadius:99,transition:'width 0.3s'}}/>
                  </div>
                  {itens.map(it=>(
                    <button key={it.id} type="button" onClick={()=>toggleItemChk(it.id,!it.feito)}
                      style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,marginBottom:6,cursor:'pointer',fontFamily:'inherit',textAlign:'left',border:'1px solid var(--border)',background:it.feito?'var(--success-bg)':'white'}}>
                      <span className="icon" style={{color:it.feito?'var(--success)':'var(--muted-light)',flexShrink:0}}>{it.feito?'check_circle':'radio_button_unchecked'}</span>
                      <span style={{flex:1,fontSize:14,color:it.feito?'var(--muted)':'var(--text)',textDecoration:it.feito?'line-through':'none'}}>{it.texto}</span>
                    </button>
                  ))}
                </div>
              )
            })()}

            {detalhe.id.startsWith('cron-') ? (
              <div style={{textAlign:'center',padding:'10px',marginBottom:8,background:'var(--bg)',borderRadius:10}}>
                <span style={{color:'var(--muted)',fontSize:13}}>Definido no Cronograma — atualiza automaticamente.</span>
              </div>
            ) : detalhe.status !== 'concluido' ? (
              <button className="btn btn-primary btn-full" style={{marginBottom:8,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}
                onClick={()=>concluir(detalhe.id)}>
                <span className="icon icon-sm">check_circle</span> Marcar como concluída
              </button>
            ) : (
              <div style={{textAlign:'center',padding:'10px',marginBottom:8,background:'var(--success-bg)',borderRadius:10}}>
                <span style={{color:'var(--success)',fontWeight:700}}>✓ Atividade concluída</span>
              </div>
            )}
            <button className="btn btn-ghost btn-full" onClick={()=>setDetalhe(null)}>Fechar</button>
          </div>
        </div>
      )}

      {/* Detalhe do cardápio (abre de baixo) */}
      {cardapioDetalhe && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}
          onClick={e=>e.target===e.currentTarget&&setCardapioDetalhe(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 28px',maxHeight:'80vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 18px'}}/>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
              <div style={{width:54,height:54,borderRadius:'50%',background:'rgba(47,133,90,0.14)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,flexShrink:0}}>🍽️</div>
              <div>
                <p style={{fontSize:18,fontWeight:800}}>{cardapioDetalhe.tipo_refeicao_nome ?? 'Refeição'}</p>
                {cardapioDetalhe.titulo && <p style={{fontSize:13,color:'var(--muted)'}}>{cardapioDetalhe.titulo}</p>}
                {cardapioDetalhe.data_servir && <p style={{fontSize:12,color:'#2F855A',fontWeight:600}}>{new Date(cardapioDetalhe.data_servir+'T00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</p>}
              </div>
            </div>
            <p style={{fontSize:12,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Itens do cardápio</p>
            <div style={{background:'var(--bg)',borderRadius:12,padding:16,marginBottom:16,fontSize:15,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{cardapioDetalhe.itens || 'Sem itens cadastrados.'}</div>
            <button className="btn btn-ghost btn-full" onClick={()=>setCardapioDetalhe(null)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}
