import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import SubTabs from '../components/SubTabs'
import PessoaSaudeResumo from '../components/PessoaSaudeResumo'
import { getInitials, fmtHora, fmtDataHora } from '../utils'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

// Doses vêm AUTOMÁTICAS da Ficha Médica (med_agenda). Sem agendamento manual.
type Dose   = { id:string; med_ctrl_id:string; person_id:string; nome:string; dosagem:string|null; horario:string; entregue:boolean; entregue_por:string|null; entregue_em:string|null }
type Pessoa = { id:string; name:string; photo_url:string|null }

export default function Medicamentos({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [doses,   setDoses]   = useState<Dose[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [aba,     setAba]     = useState<'agenda'|'historico'>('agenda')
  const [entregando, setEntregando] = useState<string|null>(null)
  const [resumoId, setResumoId] = useState<string|null>(null)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [ag, pe] = await Promise.all([
      supabase.from('med_agenda').select('*').eq('event_id', evento.id).order('horario'),
      supabase.from('people').select('id,name,photo_url').eq('event_id', evento.id).order('name'),
    ])
    setDoses((ag.data as Dose[]) ?? [])
    setPessoas(pe.data ?? [])
    setLoading(false)
  }

  function getPessoa(id:string) { return pessoas.find(p=>p.id===id) }

  async function entregar(d: Dose) {
    if (!confirm(`Confirmar entrega?\n\n${getPessoa(d.person_id)?.name} · ${d.nome}${d.dosagem?` · ${d.dosagem}`:''} · ${fmtHora(d.horario)}`)) return
    setEntregando(d.id)
    // quem entregou
    let meu: string|null = null
    if (evento && profile) {
      const { data } = await supabase.from('people').select('id').eq('event_id',evento.id).eq('user_id',profile.user_id).maybeSingle()
      meu = data?.id ?? null
    }
    await supabase.from('med_agenda').update({ entregue:true, entregue_por:meu, entregue_em:new Date().toISOString() }).eq('id', d.id)
    setEntregando(null); carregar()
  }

  const agora = Date.now()
  const pendentes = doses.filter(d=>!d.entregue).sort((a,b)=>a.horario.localeCompare(b.horario))
  const historico = doses.filter(d=>d.entregue).sort((a,b)=>(b.entregue_em??'').localeCompare(a.entregue_em??''))
  const pct = doses.length ? Math.round((historico.length / doses.length) * 100) : 0

  if (evLoading || loading) return <div className="page"><SubTabs group="saude"/>{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:10,borderRadius:14}}/>)}</div>

  return (
    <div className="page">
      <SubTabs group="saude"/>
      <div className="tabs mb-4">
        <button className={`tab ${aba==='agenda'?'active':''}`} onClick={()=>setAba('agenda')}>
          Agenda {pendentes.length>0 && <span className="badge badge-warning" style={{marginLeft:4,fontSize:9}}>{pendentes.length}</span>}
        </button>
        <button className={`tab ${aba==='historico'?'active':''}`} onClick={()=>setAba('historico')}>Histórico ({historico.length})</button>
      </div>

      {/* Barra de progresso do dia */}
      {doses.length>0 && (
        <div style={{background:'var(--primary)',borderRadius:14,padding:'14px 16px',marginBottom:16,boxShadow:'0 4px 14px rgba(0,169,157,0.3)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontSize:13,fontWeight:700,color:'white'}}>Doses entregues</span>
            <span style={{fontSize:15,fontWeight:800,color:'white'}}>{historico.length}/{doses.length}</span>
          </div>
          <div style={{height:8,background:'rgba(255,255,255,0.25)',borderRadius:99,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${pct}%`,background:'white',borderRadius:99,transition:'width 0.4s'}}/>
          </div>
        </div>
      )}

      {/* AGENDA */}
      {aba==='agenda' && (
        pendentes.length===0 ? (
          <div className="empty">
            <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>medication</span></div>
            <p className="empty-title">Nenhuma dose pendente</p>
            <p className="empty-desc">As doses são geradas pela Ficha Médica (medicamento contínuo).</p>
          </div>
        ) : pendentes.map(d => {
          const p = getPessoa(d.person_id)
          const atrasado = new Date(d.horario).getTime() < agora
          const cor = atrasado ? 'var(--danger)' : 'var(--primary)'
          return (
            <div key={d.id} style={{background:'white',borderRadius:12,boxShadow:'0 1px 5px rgba(0,0,0,0.12)',marginBottom:10,overflow:'hidden',display:'flex'}}>
              <div style={{width:6,alignSelf:'stretch',background:cor,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:14,padding:'14px 15px'}}>
                <button onClick={()=>setResumoId(d.person_id)} style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:14,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left',padding:0}}>
                  <div style={{width:52,height:52,borderRadius:'50%',background:atrasado?'var(--danger-bg)':'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                    {p?.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:18,fontWeight:700,color:cor}}>{getInitials(p?.name??'?')}</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:11,fontWeight:700,color:cor,marginBottom:2}}>{fmtHora(d.horario)} · {atrasado?'ATRASADO':'Pendente'}</p>
                    <p style={{fontWeight:700,fontSize:15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p?.name}</p>
                    <p style={{fontSize:12,color:'var(--muted)'}}>{d.nome}{d.dosagem?` · ${d.dosagem}`:''}</p>
                  </div>
                </button>
                <button onClick={()=>entregar(d)} disabled={entregando===d.id}
                  style={{background:'var(--primary)',color:'white',border:'none',borderRadius:8,padding:'8px 12px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',flexShrink:0,display:'flex',alignItems:'center',gap:4}}>
                  <span className="icon icon-sm" style={{color:'white'}}>check_circle</span>{entregando===d.id?'...':'Entregar'}
                </button>
              </div>
            </div>
          )
        })
      )}

      {/* HISTÓRICO (somente leitura) */}
      {aba==='historico' && (
        historico.length===0 ? (
          <div className="empty">
            <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>history</span></div>
            <p className="empty-title">Nenhuma entrega ainda</p>
          </div>
        ) : historico.map(d => {
          const p = getPessoa(d.person_id)
          const quem = d.entregue_por ? getPessoa(d.entregue_por) : null
          const atraso = d.entregue_em && new Date(d.entregue_em).getTime() > new Date(d.horario).getTime() + 5*60000
          return (
            <div key={d.id} style={{background:'white',borderRadius:12,boxShadow:'0 1px 5px rgba(0,0,0,0.12)',marginBottom:10,overflow:'hidden',display:'flex'}}>
              <div style={{width:6,alignSelf:'stretch',background:'var(--success)',flexShrink:0}}/>
              <div style={{flex:1,minWidth:0,padding:'14px 15px'}}>
                <div style={{display:'flex',alignItems:'center',gap:14}}>
                  <div style={{width:48,height:48,borderRadius:'50%',background:'var(--success-bg)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                    {p?.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:16,fontWeight:700,color:'var(--success)'}}>{getInitials(p?.name??'?')}</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontWeight:700,fontSize:15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p?.name}</p>
                    <p style={{fontSize:12,color:'var(--muted)'}}>{d.nome}{d.dosagem?` · ${d.dosagem}`:''}</p>
                  </div>
                  <span className={`badge ${atraso?'badge-warning':'badge-success'}`} style={{fontSize:9,flexShrink:0}}>{atraso?'Com atraso':'No horário'}</span>
                </div>
                <div style={{background:'var(--bg)',borderRadius:8,padding:'8px 10px',fontSize:11,color:'var(--muted)',marginTop:10}}>
                  Previsto: {fmtHora(d.horario)} · Entregue: {d.entregue_em?fmtDataHora(d.entregue_em):'—'}{quem?` · por ${quem.name.split(' ')[0]}`:''}
                </div>
              </div>
            </div>
          )
        })
      )}

      {resumoId && evento && <PessoaSaudeResumo personId={resumoId} eventId={evento.id} onClose={()=>setResumoId(null)}/>}
    </div>
  )
}
