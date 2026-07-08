import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getInitials, fmtHora } from '../utils'
import { useVoltarFecha } from '../hooks/useVoltarFecha'

/**
 * Tela rápida da pessoa (saúde) — resolve dúvidas em segundos.
 * Foto, nome, alergias em destaque, restrições, medicamentos ativos e contato de referência (WhatsApp).
 * Fonte: saude_fichas + med_controlados + med_agenda + people (referência).
 */
type Props = { personId: string; eventId: string; onClose: () => void }
type Pessoa = { id:string; name:string; photo_url:string|null; phone:string|null; referencia_id:string|null }

function waLink(phone: string|null): string|null {
  if (!phone) return null
  let d = phone.replace(/\D/g,'')
  if (!d) return null
  if (d.length <= 11) d = '55' + d // Brasil
  return `https://wa.me/${d}`
}

export default function PessoaSaudeResumo({ personId, eventId, onClose }: Props) {
  useVoltarFecha(true, onClose)  // voltar do celular fecha o resumo
  const [loading, setLoading] = useState(true)
  const [pessoa, setPessoa]   = useState<Pessoa|null>(null)
  const [ficha, setFicha]     = useState<any>(null)
  const [meds, setMeds]       = useState<any[]>([])
  const [proxima, setProxima] = useState<Record<string,string>>({}) // med_ctrl_id -> horário próxima dose
  const [ref, setRef]         = useState<Pessoa|null>(null)

  useEffect(() => { carregar() }, [personId])

  async function carregar() {
    setLoading(true)
    const [pe, fi, mc, ag] = await Promise.all([
      supabase.from('people').select('id,name,photo_url,phone,referencia_id').eq('id',personId).maybeSingle(),
      supabase.from('saude_fichas').select('*').eq('person_id',personId).eq('event_id',eventId).maybeSingle(),
      supabase.from('med_controlados').select('*').eq('person_id',personId).eq('event_id',eventId),
      supabase.from('med_agenda').select('med_ctrl_id,horario,entregue').eq('person_id',personId).eq('event_id',eventId).eq('entregue',false).order('horario'),
    ])
    setPessoa(pe.data as Pessoa)
    setFicha(fi.data)
    setMeds(mc.data ?? [])
    const prox: Record<string,string> = {}
    ;(ag.data ?? []).forEach((d:any)=>{ if(!prox[d.med_ctrl_id]) prox[d.med_ctrl_id] = d.horario })
    setProxima(prox)
    if (pe.data?.referencia_id) {
      const { data: r } = await supabase.from('people').select('id,name,photo_url,phone,referencia_id').eq('id', pe.data.referencia_id).maybeSingle()
      setRef(r as Pessoa)
    } else setRef(null)
    setLoading(false)
  }

  const alergia = ficha && (ficha.alergia_medicamentos ?? ficha.alergias) ? (ficha.alergias || 'Alergia a medicamentos') : null
  const restricao = ficha && (ficha.restricao_alimentar ?? ficha.restricoes_alimentares) ? (ficha.restricoes_alimentares || 'Restrição alimentar') : null
  const wa = waLink(ref?.phone ?? null)

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 28px',maxHeight:'92vh',overflowY:'auto'}}>
        <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 16px'}}/>
        {loading ? <div className="skeleton" style={{height:160,borderRadius:12}}/> : (
          <>
            {/* Cabeçalho */}
            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
              <div style={{width:64,height:64,borderRadius:'50%',background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                {pessoa?.photo_url?<img src={pessoa.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:22,fontWeight:700,color:'var(--primary)'}}>{getInitials(pessoa?.name??'?')}</span>}
              </div>
              <p style={{flex:1,fontSize:19,fontWeight:800}}>{pessoa?.name}</p>
            </div>

            {/* Alergias em destaque */}
            {alergia && (
              <div style={{background:'var(--danger-bg)',border:'1px solid var(--danger)',borderRadius:10,padding:'12px 14px',marginBottom:10}}>
                <p style={{fontSize:11,fontWeight:800,color:'var(--danger)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>⚠️ Alergia a medicamentos</p>
                <p style={{fontSize:14,fontWeight:600,color:'var(--danger)'}}>{alergia}</p>
              </div>
            )}
            {restricao && (
              <div style={{background:'var(--warning-bg)',borderRadius:10,padding:'10px 14px',marginBottom:10}}>
                <p style={{fontSize:11,fontWeight:700,color:'var(--warning)',textTransform:'uppercase',marginBottom:2}}>Restrição alimentar</p>
                <p style={{fontSize:13}}>{restricao}</p>
              </div>
            )}

            {/* Medicamentos ativos */}
            <div className="section-label mb-2" style={{marginTop:6}}>Medicamentos ativos</div>
            {meds.length===0 ? (
              <p style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>Nenhum medicamento contínuo.</p>
            ) : meds.map((m:any)=>(
              <div key={m.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'white',borderRadius:10,marginBottom:6,boxShadow:'var(--shadow-sm)'}}>
                <span style={{fontSize:20}}>💊</span>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontWeight:700,fontSize:14}}>{m.nome}{m.dosagem?` · ${m.dosagem}`:''}</p>
                  <p style={{fontSize:11,color:'var(--muted)'}}>Próxima: {proxima[m.id]?fmtHora(proxima[m.id]):'—'}</p>
                </div>
              </div>
            ))}

            {/* Contato de referência */}
            <div className="section-label mb-2" style={{marginTop:10}}>Contato de referência</div>
            {ref ? (
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'white',borderRadius:10,marginBottom:14,boxShadow:'var(--shadow-sm)'}}>
                <div style={{width:40,height:40,borderRadius:'50%',background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                  {ref.photo_url?<img src={ref.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:13,fontWeight:700,color:'var(--primary)'}}>{getInitials(ref.name)}</span>}
                </div>
                <p style={{flex:1,fontSize:14,fontWeight:600}}>{ref.name}</p>
                {wa && <a href={wa} target="_blank" rel="noreferrer" style={{background:'#25D366',color:'white',borderRadius:8,padding:'8px 12px',textDecoration:'none',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',gap:4}}><span className="icon icon-sm" style={{color:'white'}}>chat</span>WhatsApp</a>}
              </div>
            ) : <p style={{fontSize:13,color:'var(--muted)',marginBottom:14}}>Sem contato de referência.</p>}

            <button className="btn btn-ghost btn-full" onClick={onClose}>Fechar</button>
          </>
        )}
      </div>
    </div>
  )
}
