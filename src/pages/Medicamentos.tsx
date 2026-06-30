import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getInitials, fmtHora, fmtDataHora } from '../utils'
import { useEvento } from '../hooks/useEvento'
import PersonSelect from '../components/PersonSelect'
import type { Profile } from '../App'

type Agenda   = { id:string; person_id:string; medicine_name:string; dosage:string|null; horario:string; entregue:boolean }
type Entrega  = { id:string; medication_id:string; person_id:string; entregue_por:string|null; entregue_em:string; observacoes:string|null }
type Pessoa   = { id:string; name:string; photo_url:string|null }

export default function Medicamentos({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [agenda,   setAgenda]   = useState<Agenda[]>([])
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [pessoas,  setPessoas]  = useState<Pessoa[]>([])
  const [loading,  setLoading]  = useState(true)
  const [aba,      setAba]      = useState<'agenda'|'historico'>('agenda')
  const [modal,    setModal]    = useState(false)
  const [modalObs, setModalObs] = useState<Agenda|null>(null)
  const [obs,      setObs]      = useState('')
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ person_id:'', medicine_name:'', dosage:'', horario:'08:00' })

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [ag, en, pe] = await Promise.all([
      supabase.from('medications').select('*').eq('event_id', evento.id).order('horario'),
      supabase.from('medicamento_entregas').select('*').order('entregue_em', { ascending: false }),
      supabase.from('people').select('id,name,photo_url,role_type').eq('event_id', evento.id).order('name'),
    ])
    // FILTRO: somente encontristas recebem medicação na lista de entrega
    const encontristas = (pe.data ?? []).filter(p => p.role_type === 'encounterer')
    const idsEncontristas = new Set(encontristas.map(p => p.id))

    // Filtrar agenda/medicamentos para mostrar só os de encontristas
    const agendaFiltrada = (ag.data ?? []).filter(a => idsEncontristas.has(a.person_id))

    setAgenda(agendaFiltrada)
    setEntregas(en.data ?? [])
    setPessoas(encontristas)
    setLoading(false)
  }

  async function abrirEntregar(item: Agenda) {
    setModalObs(item); setObs('')
  }

  async function confirmarEntrega() {
    if (!modalObs) return
    setSalvando(true)

    // Buscar meu person_id para registrar quem entregou
    let entregadoPor: string|null = null
    if (evento && profile) {
      const { data: meu } = await supabase.from('people').select('id')
        .eq('event_id', evento.id).eq('user_id', profile.user_id).maybeSingle()
      entregadoPor = meu?.id ?? null
    }

    // Registrar no histórico
    await supabase.from('medicamento_entregas').insert({
      medication_id: modalObs.id,
      person_id:     modalObs.person_id,
      entregue_por:  entregadoPor,
      observacoes:   obs || null,
    })

    // Marcar como entregue na agenda
    await supabase.from('medications').update({ entregue: true } as any).eq('id', modalObs.id)

    setModalObs(null); setObs(''); setSalvando(false)
    carregar()
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true)
    if (!evento || !form.person_id || !form.medicine_name) { setSalvando(false); return }
    await supabase.from('medications').insert({
      person_id: form.person_id, event_id: evento.id,
      medicine_name: form.medicine_name, dosage: form.dosage || null,
      horario: form.horario, entregue: false,
      timestamp: new Date().toISOString(),
    })
    setModal(false); setSalvando(false)
    setForm({ person_id:'', medicine_name:'', dosage:'', horario:'08:00' })
    carregar()
  }

  async function remover(id: string) {
    if (!confirm('Remover este medicamento?')) return
    await supabase.from('medicamento_entregas').delete().eq('medication_id', id)
    await supabase.from('medications').delete().eq('id', id)
    carregar()
  }

  function getPessoa(id: string) { return pessoas.find(p => p.id === id) }

  // Agrupar agenda por horário
  const grupos: Record<string, Agenda[]> = {}
  agenda.forEach(item => {
    if (!grupos[item.horario]) grupos[item.horario] = []
    grupos[item.horario].push(item)
  })
  const horariosOrdenados = Object.keys(grupos).sort()

  // Histórico enriquecido
  const historicoEnriquecido = entregas.map(e => {
    const medItem = agenda.find(a => a.id === e.medication_id)
    const pessoa  = getPessoa(e.person_id)
    const quemEntregou = e.entregue_por ? getPessoa(e.entregue_por) : null
    return { ...e, pessoa, medItem, quemEntregou }
  })

  const totalPendentes = agenda.filter(a => !a.entregue).length

  return (
    <div className="page">
      <div className="tabs mb-4">
        <button className={`tab ${aba==='agenda'?'active':''}`} onClick={()=>setAba('agenda')}>
          Agenda {totalPendentes > 0 && <span className="badge badge-warning" style={{marginLeft:4,fontSize:9}}>{totalPendentes}</span>}
        </button>
        <button className={`tab ${aba==='historico'?'active':''}`} onClick={()=>setAba('historico')}>
          Histórico ({entregas.length})
        </button>
      </div>

      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:68,marginBottom:8,borderRadius:14}}/>) : (

      aba === 'agenda' ? (
        <>
          {horariosOrdenados.length === 0 ? (
            <div className="empty">
              <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>medication</span></div>
              <p className="empty-title">Nenhum medicamento agendado</p>
              <p className="empty-desc">Adicione os medicamentos e horários de cada pessoa.</p>
            </div>
          ) : horariosOrdenados.map(horario => (
            <div key={horario}>
              <div className="hour-group">{horario}</div>
              {grupos[horario].map(item => {
                const p = getPessoa(item.person_id)
                const entregue = item.entregue
                return (
                  <div key={item.id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,display:'flex',alignItems:'center',overflow:'hidden',opacity:entregue?0.6:1}}>
                    <div style={{width:4,background:entregue?'var(--success)':'var(--primary)',alignSelf:'stretch',flexShrink:0}}/>
                    <div style={{display:'flex',alignItems:'center',gap:12,flex:1,padding:'12px 14px'}}>
                      <div style={{width:44,height:44,borderRadius:'50%',background:entregue?'var(--success-bg)':'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                        {p?.photo_url
                          ? <img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                          : <span style={{fontSize:15,fontWeight:700,color:entregue?'var(--success)':'var(--primary)'}}>{getInitials(p?.name??'?')}</span>
                        }
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontWeight:700,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p?.name}</p>
                        <p style={{fontSize:12,color:'var(--muted)'}}>{item.medicine_name}{item.dosage?` · ${item.dosage}`:''}</p>
                      </div>
                      {entregue ? (
                        <div style={{textAlign:'right',flexShrink:0}}>
                          <span className="badge badge-success">✓ Entregue</span>
                          {historicoEnriquecido.find(h=>h.medication_id===item.id) && (
                            <p style={{fontSize:10,color:'var(--muted)',marginTop:2}}>
                              {fmtHora(historicoEnriquecido.find(h=>h.medication_id===item.id)!.entregue_em)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div style={{display:'flex',gap:6,flexShrink:0}}>
                          <button onClick={()=>abrirEntregar(item)}
                            style={{background:'var(--primary)',color:'white',border:'none',borderRadius:8,padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
                            <span className="icon icon-sm" style={{color:'white'}}>medication</span>Entregar
                          </button>
                          <button onClick={()=>remover(item.id)}
                            style={{background:'var(--danger-bg)',color:'var(--danger)',border:'none',borderRadius:8,padding:'7px 8px',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center'}}>
                            <span className="icon icon-sm">delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </>
      ) : (
        // HISTÓRICO
        historicoEnriquecido.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>history</span></div>
            <p className="empty-title">Nenhuma entrega registrada</p>
            <p className="empty-desc">O histórico aparecerá conforme os medicamentos forem entregues.</p>
          </div>
        ) : historicoEnriquecido.map(h => (
          <div key={h.id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,overflow:'hidden',borderLeft:'3px solid var(--success)'}}>
            <div style={{padding:'12px 14px'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                <div style={{width:38,height:38,borderRadius:'50%',background:'var(--success-bg)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                  {h.pessoa?.photo_url
                    ? <img src={h.pessoa.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : <span style={{fontSize:13,fontWeight:700,color:'var(--success)'}}>{getInitials(h.pessoa?.name??'?')}</span>
                  }
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontWeight:700,fontSize:14}}>{h.pessoa?.name ?? '—'}</p>
                  <p style={{fontSize:12,color:'var(--muted)'}}>
                    {h.medItem?.medicine_name ?? '—'}{h.medItem?.dosage?` · ${h.medItem.dosage}`:''}
                  </p>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <span className="badge badge-success" style={{fontSize:9}}>✓ Entregue</span>
                  <p style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{fmtDataHora(h.entregue_em)}</p>
                </div>
              </div>
              {(h.quemEntregou || h.observacoes) && (
                <div style={{background:'var(--bg)',borderRadius:8,padding:'8px 10px',fontSize:11,color:'var(--muted)'}}>
                  {h.quemEntregou && <span>Entregue por: <strong>{h.quemEntregou.name}</strong></span>}
                  {h.observacoes && <span style={{marginLeft:h.quemEntregou?8:0}}>{h.observacoes}</span>}
                </div>
              )}
            </div>
          </div>
        ))
      )
      )}

      <button className="fab" onClick={()=>setModal(true)}><span className="icon">add</span></button>

      {/* Modal confirmar entrega */}
      {modalObs && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}
          onClick={e=>e.target===e.currentTarget&&setModalObs(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 20px'}}/>
            <p style={{fontSize:17,fontWeight:700,marginBottom:4}}>Confirmar entrega</p>
            <p style={{fontSize:13,color:'var(--muted)',marginBottom:16}}>
              {getPessoa(modalObs.person_id)?.name} · {modalObs.medicine_name}{modalObs.dosage?` · ${modalObs.dosage}`:''}
            </p>
            <div className="form-group">
              <label className="form-label">Observações (opcional)</label>
              <textarea className="form-textarea" value={obs} onChange={e=>setObs(e.target.value)}
                placeholder="Ex: Tomou com água, paciente tinha dor de cabeça..." style={{minHeight:72}}/>
            </div>
            <button className="btn btn-primary btn-full" disabled={salvando} onClick={confirmarEntrega}
              style={{marginBottom:8,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              <span className="icon icon-sm">check_circle</span>
              {salvando ? 'Registrando...' : 'Confirmar entrega'}
            </button>
            <button className="btn btn-ghost btn-full" onClick={()=>setModalObs(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Modal agendar */}
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}
          onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0 16px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>Agendar medicamento</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>
                <span className="icon icon-sm">close</span>
              </button>
            </div>
            <form onSubmit={salvar}>
              <div className="form-group">
                <PersonSelect label="Pessoa" required pessoas={pessoas} value={form.person_id}
                  onChange={id=>setForm(f=>({...f,person_id:id}))} placeholder="Buscar pessoa..."/>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Medicamento <span className="req">*</span></label>
                  <input className="form-input" value={form.medicine_name} onChange={e=>setForm(f=>({...f,medicine_name:e.target.value}))} required placeholder="Ex: Dipirona"/>
                </div>
                <div className="form-group"><label className="form-label">Dosagem</label>
                  <input className="form-input" value={form.dosage} onChange={e=>setForm(f=>({...f,dosage:e.target.value}))} placeholder="Ex: 500mg"/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Horário programado <span className="req">*</span></label>
                <input className="form-input" type="time" value={form.horario} onChange={e=>setForm(f=>({...f,horario:e.target.value}))} required/>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Agendar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
