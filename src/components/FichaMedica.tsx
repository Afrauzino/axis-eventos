import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('saude_fichas').select('*').eq('person_id',personId).eq('event_id',eventId).maybeSingle()
    if (data) setF({
      restricao_alimentar:  data.restricao_alimentar ?? !!data.restricoes_alimentares,
      restricoes_alimentares: data.restricoes_alimentares ?? '',
      alergia_medicamentos: data.alergia_medicamentos ?? !!data.alergias,
      alergias:             data.alergias ?? '',
      toma_controlado:      data.toma_controlado ?? !!(data as any).medicamento_controlado,
    })
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
    setSalvando(false)
    if (error) { setMsg('Erro: ' + error.message); return }
    setMsg('✓ Salvo!'); setTimeout(()=>setMsg(m=>m==='✓ Salvo!'?'':m), 1500)
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
                <div className="alert-box alert-info" style={{fontSize:12,marginBottom:12}}>
                  O cadastro dos medicamentos contínuos (doses e horários) entra aqui na próxima etapa.
                </div>
              )}

              {!readOnly && (
                <button type="button" className="btn btn-primary btn-full" onClick={salvar} disabled={salvando}>
                  {salvando ? 'Salvando...' : (msg || 'Salvar ficha')}
                </button>
              )}
              {readOnly && msg && <p style={{fontSize:12,color:'var(--muted)',textAlign:'center'}}>{msg}</p>}
              {!salvando && msg && msg!=='✓ Salvo!' && <p style={{fontSize:12,color:'var(--danger)',textAlign:'center',marginTop:6}}>{msg}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
