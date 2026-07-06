import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRegistrarChromeNav } from '../lib/chrome'
import PessoaSaudeResumo from '../components/PessoaSaudeResumo'
import { toast } from '../components/Toast'
import CardItem from '../components/CardItem'
import FotoAmpliada from '../components/FotoAmpliada'
import { getInitials, fmtHora, fmtDataHora } from '../utils'
import { useEvento } from '../hooks/useEvento'
import { gerarICS, baixarICS, type EventoICS } from '../lib/ics'
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
  const [pessoaDoses, setPessoaDoses] = useState<string|null>(null)
  const [fotoAmpliada, setFotoAmpliada] = useState<string|null>(null)
  useRegistrarChromeNav('saude')

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

  // #7 — gera alarmes (.ics) de TODAS as doses pendentes; toca ~8 min antes
  function exportarAlarmes() {
    const pend = doses.filter(d => !d.entregue)
    if (pend.length === 0) { toast.info('Não há doses pendentes para gerar alarmes.'); return }
    const eventos: EventoICS[] = pend.map(d => {
      const pessoa = getPessoa(d.person_id)?.name ?? 'Participante'
      const hora = fmtHora(d.horario)
      return {
        uid: `med-${d.id}@axis-eventos`,
        inicio: new Date(d.horario),
        duracaoMin: 15,
        alarmeAntesMin: 8,
        titulo: `💊 ${d.nome}${d.dosagem ? ` (${d.dosagem})` : ''} — ${pessoa}`,
        descricao: `Pessoa: ${pessoa}\nMedicamento: ${d.nome}${d.dosagem ? `\nDose: ${d.dosagem}` : ''}\nHorário: ${hora}`,
      }
    })
    baixarICS('alarmes-medicamentos', gerarICS(eventos))
    toast.sucesso(`${eventos.length} alarme(s) gerado(s). Confirme "adicionar ao calendário" na tela que abriu — tocam ~8 min antes.`)
  }

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

  // Agenda por PESSOA (design da Logística): progresso = doses entregues / total daquela pessoa
  const porPessoa = pessoas.map(p => {
    const ds = doses.filter(d=>d.person_id===p.id)
    const entregues = ds.filter(d=>d.entregue).length
    const pend = ds.filter(d=>!d.entregue).sort((a,b)=>a.horario.localeCompare(b.horario))
    return { p, total:ds.length, entregues, pend, proxima: pend[0]?.horario as string|undefined }
  }).filter(x=>x.total>0)
  const agendaPessoas = porPessoa.filter(x=>x.pend.length>0).sort((a,b)=>(a.proxima??'').localeCompare(b.proxima??''))

  if (evLoading || loading) return <div className="page">{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:10,borderRadius:14}}/>)}</div>

  return (
    <div className="page">
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

      {/* #7 — Adicionar alarmes ao celular (gera .ics com lembrete ~8 min antes) */}
      {aba==='agenda' && doses.filter(d=>!d.entregue).length>0 && (
        <button onClick={exportarAlarmes}
          style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:'var(--primary)',color:'white',border:'none',borderRadius:12,padding:'12px 16px',fontFamily:'inherit',fontSize:14,fontWeight:700,cursor:'pointer',marginBottom:12}}>
          <span className="icon icon-sm">alarm_add</span> Adicionar alarmes ao celular
        </button>
      )}

      {/* AGENDA — cards por pessoa (design da Logística) */}
      {aba==='agenda' && (
        agendaPessoas.length===0 ? (
          <div className="empty">
            <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>medication</span></div>
            <p className="empty-title">Nenhuma dose pendente</p>
            <p className="empty-desc">As doses são geradas pela Ficha Médica (medicamento contínuo).</p>
          </div>
        ) : agendaPessoas.map(({p,total,entregues,pend,proxima}) => {
          const pctP = total ? Math.round((entregues/total)*100) : 0
          const atrasado = proxima ? new Date(proxima).getTime() < agora : false
          const cor = atrasado ? 'var(--danger)' : 'var(--primary)'
          const sub = [proxima?`Próxima ${fmtHora(proxima)}`:'', atrasado?'ATRASADO':'', `${pend.length} pendente${pend.length===1?'':'s'}`].filter(Boolean).join(' · ')
          return (
            <CardItem
              key={p.id}
              cor={cor}
              ehPessoa
              fotoUrl={p.photo_url}
              iniciais={getInitials(p.name)}
              titulo={p.name}
              subtitulo={sub}
              direita={<span style={{fontSize:15,fontWeight:800,color:'var(--primary)'}}>{pctP}%</span>}
              progresso={pctP}
              onVer={()=>setPessoaDoses(p.id)}
              onFoto={()=>p.photo_url && setFotoAmpliada(p.photo_url)}
            />
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
            <CardItem
              key={d.id}
              cor="var(--success)"
              ehPessoa
              fotoUrl={p?.photo_url ?? null}
              iniciais={getInitials(p?.name??'?')}
              titulo={p?.name ?? '—'}
              subtitulo={`${d.nome}${d.dosagem?` · ${d.dosagem}`:''}`}
              direita={<span className={`badge ${atraso?'badge-warning':'badge-success'}`} style={{fontSize:9}}>{atraso?'Com atraso':'No horário'}</span>}
              extra={<div style={{background:'var(--bg)',borderRadius:8,padding:'8px 10px',fontSize:11,color:'var(--muted)'}}>Previsto: {fmtHora(d.horario)} · Entregue: {d.entregue_em?fmtDataHora(d.entregue_em):'—'}{quem?` · por ${quem.name.split(' ')[0]}`:''}</div>}
              onFoto={()=>p?.photo_url && setFotoAmpliada(p.photo_url)}
            />
          )
        })
      )}

      {resumoId && evento && <PessoaSaudeResumo personId={resumoId} eventId={evento.id} onClose={()=>setResumoId(null)}/>}
      <FotoAmpliada url={fotoAmpliada} onClose={()=>setFotoAmpliada(null)} />

      {/* Doses pendentes de uma pessoa */}
      {pessoaDoses && (() => {
        const p = getPessoa(pessoaDoses)
        const pend = doses.filter(d=>d.person_id===pessoaDoses && !d.entregue).sort((a,b)=>a.horario.localeCompare(b.horario))
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:350,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setPessoaDoses(null)}>
            <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 28px',maxHeight:'88vh',overflowY:'auto'}}>
              <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 16px'}}/>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                <div style={{width:52,height:52,borderRadius:'50%',background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                  {p?.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:18,fontWeight:700,color:'var(--primary)'}}>{getInitials(p?.name??'?')}</span>}
                </div>
                <p style={{flex:1,fontSize:17,fontWeight:700}}>{p?.name}</p>
                <button onClick={()=>setResumoId(pessoaDoses)} title="Ver ficha rápida" style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,width:34,height:34,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm" style={{color:'var(--primary)'}}>info</span></button>
              </div>
              {pend.length===0 ? <p style={{fontSize:13,color:'var(--muted)',textAlign:'center',padding:'12px 0'}}>Nenhuma dose pendente.</p> :
              pend.map(d=>{
                const atrasado = new Date(d.horario).getTime() < agora
                return (
                  <div key={d.id} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 12px',background:'white',borderRadius:10,marginBottom:8,boxShadow:'var(--shadow-sm)'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:11,fontWeight:700,color:atrasado?'var(--danger)':'var(--primary)'}}>{fmtHora(d.horario)} · {atrasado?'ATRASADO':'Pendente'}</p>
                      <p style={{fontSize:13,fontWeight:600}}>{d.nome}{d.dosagem?` · ${d.dosagem}`:''}</p>
                    </div>
                    <button onClick={()=>entregar(d)} disabled={entregando===d.id} style={{background:'var(--primary)',color:'white',border:'none',borderRadius:8,padding:'8px 12px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',flexShrink:0,display:'flex',alignItems:'center',gap:4}}>
                      <span className="icon icon-sm" style={{color:'white'}}>check_circle</span>{entregando===d.id?'...':'Entregar'}
                    </button>
                  </div>
                )
              })}
              <button className="btn btn-ghost btn-full" onClick={()=>setPessoaDoses(null)} style={{marginTop:8}}>Fechar</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
