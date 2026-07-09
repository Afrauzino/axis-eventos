import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { fmtDataHora, isAdmin, isLider } from '../utils'
import { useEvento } from '../hooks/useEvento'
import Seletor from '../components/Seletor'
import type { Profile } from '../App'

type Alerta = { id:string; title:string; message:string; priority:string; created_at:string; target_type:string; requires_read:boolean }
type Leitura = { alert_id:string; user_id:string }

// Para quem o alerta foi mandado (sql/50 permite 'worker' e 'encounterer')
const DESTINO: Record<string,{label:string;icone:string}> = {
  all:         { label:'Todos',        icone:'groups' },
  worker:      { label:'Encontreiros', icone:'engineering' },
  encounterer: { label:'Encontristas', icone:'favorite' },
  team:        { label:'Equipe',       icone:'diversity_3' },
  multiple:    { label:'Equipes',      icone:'diversity_3' },
}

const PRIOR: Record<string,{label:string;border:string;badge:string}> = {
  critico:   {label:'Critico',    border:'var(--danger)',  badge:'badge-danger'},
  urgente:   {label:'Urgente',    border:'var(--danger)',  badge:'badge-danger'},
  alta:      {label:'Alta',       border:'var(--warning)', badge:'badge-warning'},
  media:     {label:'Media',      border:'var(--accent)',  badge:'badge-info'},
  baixa:     {label:'Baixa',      border:'var(--success)', badge:'badge-success'},
  important: {label:'Importante', border:'var(--warning)', badge:'badge-warning'},
  urgent:    {label:'Urgente',    border:'var(--danger)',  badge:'badge-danger'},
  info:      {label:'Info',       border:'var(--info)',    badge:'badge-info'},
}

export default function Alertas({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [leituras, setLeituras] = useState<Leitura[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  useVoltarFecha(modal, () => setModal(false))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]       = useState('')
  const [form, setForm]       = useState({ title:'', message:'', priority:'info', target_type:'all', requires_read:false })

  const canCreate = profile && (isAdmin(profile.user_role) || isLider(profile.user_role))
  const adminFull = profile && isAdmin(profile.user_role)
  const [myTeamIds, setMyTeamIds] = useState<string[]>([])

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; if (profile) carregar() }, [evento, evLoading, profile])

  async function carregar() {
    if (!evento || !profile) return
    const [al, lr] = await Promise.all([
      supabase.from('alerts').select('*').eq('event_id',evento.id).order('created_at',{ascending:false}),
      supabase.from('alert_reads').select('alert_id,user_id').eq('user_id',profile.user_id),
    ])

    // Meu cadastro no evento: diz se sou encontreiro ou encontrista, e quais equipes lidero
    const { data: myPerson } = await supabase.from('people').select('id,role_type')
      .eq('event_id', evento.id).eq('user_id', profile.user_id).maybeSingle()

    let teamIds: string[] = []
    if (!isAdmin(profile.user_role) && isLider(profile.user_role) && myPerson) {
      const { data: myTeams } = await supabase.from('teams').select('id')
        .or(`leader_id.eq.${myPerson.id},co_leader_id.eq.${myPerson.id}`)
      teamIds = myTeams?.map(t=>t.id) ?? []
    }
    setMyTeamIds(teamIds)

    // Quem vê o quê: 'all' (todos) + do meu tipo (encontreiro/encontrista) + da minha equipe.
    // O banco (sql/50) já barra o resto; aqui é só pra tela ficar coerente.
    const todos = al.data ?? []
    const filtrados = adminFull
      ? todos
      : todos.filter(a =>
          a.target_type === 'all' ||
          (!!myPerson?.role_type && a.target_type === myPerson.role_type) ||
          (a.target_type === 'team' && (
            teamIds.length === 0 ||
            !a.target_team_ids?.length ||
            a.target_team_ids.some((tid:string) => teamIds.includes(tid))
          ))
        )
    setAlertas(filtrados)
    setLeituras(lr.data??[])
    setLoading(false)
  }

  async function marcarLido(alertId: string) {
    if (!profile) return
    await supabase.from('alert_reads').upsert({ alert_id:alertId, user_id:profile.user_id, read_at:new Date().toISOString() })
    setLeituras(prev=>[...prev,{alert_id:alertId,user_id:profile.user_id}])
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true)
    if (!evento || !profile) return
    if (!form.title.trim() || !form.message.trim()) { setErro('Titulo e mensagem sao obrigatorios.'); setSalvando(false); return }
    const {data:user} = await supabase.auth.getUser()
    const teamIds = form.target_type === 'team' ? myTeamIds : []
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const { error } = await supabase.from('alerts').insert({
      ...form,
      event_id: evento.id,
      created_by: authUser?.id ?? null,
      target_team_ids: teamIds,
    })
    if (error) {
      const faltaSql = error.message.includes('target_type')
      setErro(faltaSql ? 'Para mandar só para encontreiros/encontristas, rode antes o sql/50_alertas_mural_foto.sql.' : 'Erro: '+error.message)
      setSalvando(false); return
    }
    setModal(false); setSalvando(false)
    setForm({title:'',message:'',priority:'info',target_type:'all',requires_read:false})
    carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este alerta?')) return
    await supabase.from('alerts').delete().eq('id',id)
    carregar()
  }

  const lidoIds = new Set(leituras.map(l=>l.alert_id))
  const naoLidos = alertas.filter(a=>!lidoIds.has(a.id)).length

  return (
    <div className="page">
      {naoLidos>0 && (
        <div className="alert-box alert-info mb-3">
          {naoLidos} alerta(s) nao lido(s)
        </div>
      )}

      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:90,marginBottom:8,borderRadius:14}}/>) :
      alertas.length===0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>notifications</span></div>
          <p className="empty-title">Nenhum alerta</p>
          <p className="empty-desc">Nenhum comunicado enviado ainda.</p>
        </div>
      ) : alertas.map(a=>{
        const cfg = PRIOR[a.priority]??PRIOR.info
        const lido = lidoIds.has(a.id)
        return (
          <div key={a.id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:10,borderLeft:`4px solid ${cfg.border}`,overflow:'hidden',opacity:lido?0.8:1}}>
            <div style={{padding:'13px 14px'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:6}}>
                <p style={{fontWeight:700,fontSize:14,flex:1,marginRight:8}}>{a.title}</p>
                <span className={`badge ${cfg.badge}`} style={{flexShrink:0}}>{cfg.label}</span>
              </div>
              {/* Para quem foi — só faz sentido pra quem manda */}
              {canCreate && DESTINO[a.target_type] && (
                <p style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:700,color:'var(--muted)',marginBottom:6}}>
                  <span className="icon" style={{fontSize:14}}>{DESTINO[a.target_type].icone}</span>
                  {DESTINO[a.target_type].label}
                </p>
              )}
              <p style={{fontSize:13,color:'var(--text2)',marginBottom:10,lineHeight:1.5}}>{a.message}</p>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <p style={{fontSize:11,color:'var(--muted)'}}>{fmtDataHora(a.created_at)}</p>
                <div style={{display:'flex',gap:8}}>
                  {!lido && <button className="btn btn-sm btn-ghost" onClick={()=>marcarLido(a.id)}>Marcar como lido</button>}
                  {profile && isAdmin(profile.user_role) && <button className="btn btn-sm" style={{background:'var(--danger-bg)',color:'var(--danger)'}} onClick={()=>excluir(a.id)}>Excluir</button>}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {canCreate && <button className="fab" onClick={()=>setModal(true)}><span className="icon">add</span></button>}

      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0 16px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>Novo alerta</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Titulo <span className="req">*</span></label>
                <input className="form-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required />
              </div>
              <div className="form-group"><label className="form-label">Mensagem <span className="req">*</span></label>
                <textarea className="form-textarea" value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} required />
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Prioridade</label>
                  <Seletor titulo="Prioridade" value={form.priority} onChange={v=>setForm(f=>({...f,priority:v}))}
                    opcoes={[
                      {value:'baixa',label:'Baixa'},
                      {value:'info',label:'Informativo'},
                      {value:'important',label:'Importante'},
                      {value:'urgent',label:'Urgente'},
                      ...(profile && isAdmin(profile.user_role) ? [{value:'critico',label:'Crítico (trava tela)'}] : []),
                    ]}/>
                </div>
                <div className="form-group"><label className="form-label">Destino</label>
                  <Seletor titulo="Quem vai receber" value={form.target_type} onChange={v=>setForm(f=>({...f,target_type:v}))}
                    opcoes={[
                      ...(profile && isAdmin(profile.user_role) ? [
                        {value:'all',         label:'Todos'},
                        {value:'worker',      label:'Só encontreiros'},
                        {value:'encounterer', label:'Só encontristas'},
                      ] : []),
                      {value:'team',label:'Minha equipe'},
                    ]}/>
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Enviando...':'Enviar alerta'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
