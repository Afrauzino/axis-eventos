import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import DataHora from './DataHora'

/**
 * Ficha Médica — componente reutilizável, FONTE ÚNICA (tabela saude_fichas).
 * Usado em Saúde e Logística. Accordion, começa fechado.
 * Campos condicionais: restrição alimentar, alergia a medicamentos, medicamento controlado (Sim/Não).
 * (A lista/motor de medicamento contínuo entra na Fase 2, quando toma_controlado = Sim.)
 */
type Props = { personId: string; eventId: string; readOnly?: boolean; startOpen?: boolean; onSaved?: () => void }

type FichaState = {
  restricao_alimentar: boolean; restricoes_alimentares: string
  alergia_medicamentos: boolean; alergias: string
  toma_controlado: boolean
}
const VAZIO: FichaState = { restricao_alimentar:false, restricoes_alimentares:'', alergia_medicamentos:false, alergias:'', toma_controlado:false }

type MedRow = { id?:string; nome:string; dosagem:string; intervalo_h:string; ultima_dose:string }
const MED_VAZIO: MedRow = { nome:'', dosagem:'', intervalo_h:'8', ultima_dose:'' }

// Período de controle: agora → resto do dia + dia seguinte inteiro → encerra na HORA DE CORTE
// (configurável em Saúde → Configuração; padrão 14h) do dia seguinte ao dia completo.
function periodoFim(corteHora: number): Date {
  const fim = new Date(); fim.setDate(fim.getDate()+2); fim.setHours(corteHora,0,0,0); return fim
}
// Gera as doses a partir da última dose tomada + intervalo, dentro do período.
function gerarDoses(med: MedRow, personId: string, eventId: string, medCtrlId: string, corteHora: number) {
  const rows: any[] = []
  const iv = parseInt(med.intervalo_h) || 0
  if (!med.ultima_dose || iv <= 0) return rows
  const agora = Date.now()
  const fim = periodoFim(corteHora).getTime()
  let t = new Date(med.ultima_dose).getTime() + iv * 3600000
  let guard = 0
  while (t <= fim && guard < 300) {
    if (t >= agora) rows.push({ med_ctrl_id:medCtrlId, person_id:personId, event_id:eventId, nome:med.nome.trim(), dosagem:med.dosagem||null, horario:new Date(t).toISOString(), entregue:false })
    t += iv * 3600000; guard++
  }
  return rows
}

function SimNao({ label, value, onChange, disabled }: { label:string; value:boolean; onChange:(v:boolean)=>void; disabled?:boolean }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{display:'flex',gap:8}}>
        {[['Sim',true],['Não',false]].map(([lab,val])=>{
          const on = value===val
          return (
            <button key={lab as string} type="button" disabled={disabled} onClick={()=>onChange(val as boolean)}
              style={{flex:1,padding:'10px',borderRadius:10,cursor:disabled?'default':'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700,
                border:on?'2px solid var(--primary)':'1px solid var(--border)',
                background:on?'var(--primary-light)':'white', color:on?'var(--primary-dark)':'var(--text2)'}}>
              {lab}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function FichaMedica({ personId, eventId, readOnly=false, startOpen=false, onSaved }: Props) {
  const [aberto, setAberto]     = useState(startOpen)
  const [carregado, setCarregado] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg]           = useState('')
  const [f, setF]               = useState<FichaState>(VAZIO)
  const [meds, setMeds]         = useState<MedRow[]>([])
  const [corteHora, setCorteHora] = useState(14)

  function setMed(i:number, patch:Partial<MedRow>) { setMeds(prev=>prev.map((m,idx)=>idx===i?{...m,...patch}:m)) }
  function addMed() { setMeds(prev=>[...prev,{...MED_VAZIO}]) }
  function removeMed(i:number) {
    const m = meds[i]
    if (m.id) { supabase.from('med_agenda').delete().eq('med_ctrl_id',m.id); supabase.from('med_controlados').delete().eq('id',m.id) }
    setMeds(prev=>prev.filter((_,idx)=>idx!==i))
  }

  async function carregar() {
    setLoading(true)
    const [{ data }, { data: mc }, { data: ev }] = await Promise.all([
      supabase.from('saude_fichas').select('*').eq('person_id',personId).eq('event_id',eventId).maybeSingle(),
      supabase.from('med_controlados').select('*').eq('person_id',personId).eq('event_id',eventId),
      supabase.from('events').select('med_corte_hora').eq('id',eventId).maybeSingle(),
    ])
    if (ev && (ev as any).med_corte_hora != null) setCorteHora((ev as any).med_corte_hora)
    if (data) setF({
      restricao_alimentar:  data.restricao_alimentar ?? !!data.restricoes_alimentares,
      restricoes_alimentares: data.restricoes_alimentares ?? '',
      alergia_medicamentos: data.alergia_medicamentos ?? !!data.alergias,
      alergias:             data.alergias ?? '',
      toma_controlado:      data.toma_controlado ?? !!(data as any).medicamento_controlado,
    })
    setMeds((mc??[]).map((m:any)=>({ id:m.id, nome:m.nome??'', dosagem:m.dosagem??'', intervalo_h:String(m.intervalo_h??8), ultima_dose:m.ultima_dose?new Date(m.ultima_dose).toISOString().slice(0,16):'' })))
    setCarregado(true); setLoading(false)
  }
  useEffect(() => { if (startOpen && !carregado) carregar() }, [startOpen])

  function toggle() { setAberto(a=>!a); if (!carregado) carregar() }

  async function salvar() {
    if (f.restricao_alimentar && !f.restricoes_alimentares.trim()) { setMsg('Detalhe a restrição alimentar.'); return }
    if (f.alergia_medicamentos && !f.alergias.trim()) { setMsg('Informe a alergia a medicamentos.'); return }
    setMsg(''); setSalvando(true)
    const { error } = await supabase.from('saude_fichas').upsert({
      person_id:personId, event_id:eventId,
      restricao_alimentar: f.restricao_alimentar,
      restricoes_alimentares: f.restricao_alimentar ? f.restricoes_alimentares.trim() : null,
      alergia_medicamentos: f.alergia_medicamentos,
      alergias: f.alergia_medicamentos ? f.alergias.trim() : null,
      toma_controlado: f.toma_controlado,
    }, { onConflict:'person_id,event_id' })
    if (error) { setSalvando(false); setMsg('Erro: ' + error.message); return }

    // Medicamentos contínuos: salva cada um e (re)gera as doses pendentes no período fixo.
    // Dedupe: reusa o mesmo registro (por id ou por nome) — NUNCA duplica.
    if (f.toma_controlado) {
      const salvos: MedRow[] = []
      for (const med of meds) {
        if (!med.nome.trim()) continue
        const iv = parseInt(med.intervalo_h) || 8
        const base = { person_id:personId, event_id:eventId, nome:med.nome.trim(), dosagem:med.dosagem||null, horario_ini:'08:00', intervalo_h:iv, vezes_dia:Math.max(1,Math.round(24/iv)) }
        let medId = med.id
        // sem id → procura um registro existente com o mesmo nome pra não duplicar
        if (!medId) {
          const { data: ex } = await supabase.from('med_controlados').select('id').eq('person_id',personId).eq('event_id',eventId).ilike('nome',med.nome.trim()).limit(1)
          medId = ex?.[0]?.id
        }
        let errMed
        if (medId) { const r = await supabase.from('med_controlados').update(base).eq('id',medId); errMed=r.error }
        else { const r = await supabase.from('med_controlados').insert(base).select('id').single(); errMed=r.error; medId=r.data?.id }
        if (errMed) { setSalvando(false); setMsg('Erro ao salvar o medicamento: ' + errMed.message); return }
        if (medId && med.ultima_dose) await supabase.from('med_controlados').update({ ultima_dose:new Date(med.ultima_dose).toISOString() }).eq('id',medId)
        if (medId) {
          await supabase.from('med_agenda').delete().eq('med_ctrl_id',medId).eq('entregue',false)
          const doses = gerarDoses(med, personId, eventId, medId, corteHora)
          if (doses.length) {
            const r = await supabase.from('med_agenda').insert(doses)
            if (r.error) { setSalvando(false); setMsg('Erro ao gerar as doses: ' + r.error.message); return }
          }
          salvos.push({ ...med, id: medId }) // guarda o id pra próximos saves não duplicarem
        }
      }
      setMeds(salvos)
    }

    setSalvando(false)
    setAberto(false) // fecha o accordion sozinho ao salvar
    onSaved?.()
  }

  return (
    <div style={{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',marginBottom:12}}>
      <button type="button" onClick={toggle}
        style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'14px 15px',background:'var(--bg)',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
        <span style={{fontSize:20}}>📋</span>
        <span style={{flex:1,fontSize:14,fontWeight:700}}>Ficha Médica</span>
        <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:20,color:'var(--muted)',transform:aberto?'rotate(180deg)':'none',transition:'transform 0.2s',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",lineHeight:1,userSelect:'none'}}>expand_more</span>
      </button>

      {aberto && (
        <div style={{padding:'14px 15px'}}>
          {loading ? <div className="skeleton" style={{height:120,borderRadius:10}}/> : (
            <>
              <SimNao label="Restrição alimentar?" value={f.restricao_alimentar} disabled={readOnly} onChange={v=>setF(s=>({...s,restricao_alimentar:v}))}/>
              {f.restricao_alimentar && (
                <div className="form-group">
                  <label className="form-label">Qual restrição? <span className="req">*</span></label>
                  <textarea className="form-textarea" value={f.restricoes_alimentares} disabled={readOnly} onChange={e=>setF(s=>({...s,restricoes_alimentares:e.target.value}))} placeholder="Ex: intolerante à lactose, sem glúten..." style={{minHeight:56}}/>
                </div>
              )}

              <SimNao label="Alergia a medicamentos?" value={f.alergia_medicamentos} disabled={readOnly} onChange={v=>setF(s=>({...s,alergia_medicamentos:v}))}/>
              {f.alergia_medicamentos && (
                <div className="form-group">
                  <label className="form-label">Quais medicamentos? <span className="req">*</span></label>
                  <textarea className="form-textarea" value={f.alergias} disabled={readOnly} onChange={e=>setF(s=>({...s,alergias:e.target.value}))} placeholder="Ex: dipirona, penicilina..." style={{minHeight:56}}/>
                </div>
              )}

              <SimNao label="Toma medicamento controlado (contínuo)?" value={f.toma_controlado} disabled={readOnly} onChange={v=>setF(s=>({...s,toma_controlado:v}))}/>
              {f.toma_controlado && (
                <div style={{marginBottom:12}}>
                  <p style={{fontSize:12,color:'var(--muted)',marginBottom:8}}>Cadastre cada medicamento. As doses são calculadas automaticamente (até {corteHora}h do dia seguinte ao dia completo).</p>
                  {meds.map((m,i)=>(
                    <div key={m.id ?? i} style={{border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px',marginBottom:8}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                        <span style={{flex:1,fontSize:12,fontWeight:700,color:'var(--primary)'}}>💊 Medicamento {i+1}</span>
                        {!readOnly && <button type="button" onClick={()=>removeMed(i)} aria-label="Remover" style={{background:'var(--danger-bg)',border:'none',borderRadius:6,width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm" style={{color:'var(--danger)'}}>delete</span></button>}
                      </div>
                      <div className="form-group" style={{marginBottom:8}}>
                        <label className="form-label">Nome</label>
                        <input className="form-input" value={m.nome} disabled={readOnly} onChange={e=>setMed(i,{nome:e.target.value})} placeholder="Ex: Rivotril"/>
                      </div>
                      <div className="form-grid-2">
                        <div className="form-group" style={{marginBottom:8}}>
                          <label className="form-label">Quantidade por dose</label>
                          <input className="form-input" value={m.dosagem} disabled={readOnly} onChange={e=>setMed(i,{dosagem:e.target.value})} placeholder="Ex: 1 comprimido"/>
                        </div>
                        <div className="form-group" style={{marginBottom:8}}>
                          <label className="form-label">Intervalo (horas)</label>
                          <input className="form-input" type="number" min={1} value={m.intervalo_h} disabled={readOnly} onChange={e=>setMed(i,{intervalo_h:e.target.value})} placeholder="8"/>
                        </div>
                      </div>
                      <div className="form-group" style={{marginBottom:0}}>
                        <label className="form-label">Última vez que tomou</label>
                        <DataHora modo="datetime" value={m.ultima_dose} disabled={readOnly} onChange={v=>setMed(i,{ultima_dose:v})}/>
                      </div>
                    </div>
                  ))}
                  {!readOnly && (
                    <button type="button" onClick={addMed} style={{width:'100%',padding:'10px',border:'2px dashed var(--border)',borderRadius:10,background:'none',cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--primary)',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                      <span className="icon icon-sm">add</span> Adicionar medicamento
                    </button>
                  )}
                </div>
              )}

              {!readOnly && (
                <button type="button" className="btn btn-primary btn-full" onClick={salvar} disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar ficha'}
                </button>
              )}
              {msg && <p style={{fontSize:12,color:'var(--danger)',textAlign:'center',marginTop:8}}>{msg}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
