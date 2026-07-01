import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import SubTabs from '../components/SubTabs'
import { getInitials } from '../utils'
import { useEvento } from '../hooks/useEvento'
import PersonSelect from '../components/PersonSelect'
import type { Profile } from '../App'

type Ficha = {
  id:string; person_id:string
  diabetes:boolean; hipertensao:boolean; cardiopatia:boolean; epilepsia:boolean; ansiedade:boolean
  tipo_sanguineo:string|null; plano_saude:string|null
  alergias:string|null; medicamentos:string|null; restricoes_alimentares:string|null
  medico_nome:string|null; medico_tel:string|null
  contato_emergencia_nome:string|null; contato_emergencia_telefone:string|null
  observacoes:string|null
  medicamento_controlado:string|null
  med_controlado_como:string|null
  med_controlado_horario:string|null
}
type Pessoa = { id:string; name:string; photo_url:string|null }

const TIPO_SANG = ['A+','A-','B+','B-','AB+','AB-','O+','O-','Não sei']
const CONDICOES = [
  {key:'diabetes',    label:'Diabetes'},
  {key:'hipertensao', label:'Hipertensão'},
  {key:'cardiopatia', label:'Cardiopatia'},
  {key:'epilepsia',   label:'Epilepsia'},
  {key:'ansiedade',   label:'Ansiedade/Depressão'},
]

const FORM_VAZIO = {
  person_id:'', diabetes:false, hipertensao:false, cardiopatia:false, epilepsia:false, ansiedade:false,
  tipo_sanguineo:'', plano_saude:'', alergias:'', medicamentos:'', restricoes_alimentares:'',
  medico_nome:'', medico_tel:'', contato_emergencia_nome:'', contato_emergencia_telefone:'', observacoes:'',
  medicamento_controlado:'', med_controlado_como:'', med_controlado_horario:'08:00'
}

export default function SaudeFicha({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [fichas, setFichas]     = useState<Ficha[]>([])
  const [pessoas, setPessoas]   = useState<Pessoa[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState<'todos'|'com'|'sem'>('todos')
  const [busca, setBusca]       = useState('')
  const [detalhe, setDetalhe]   = useState<{ficha:Ficha;pessoa:Pessoa}|null>(null)
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState<Ficha|null>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm]         = useState({ ...FORM_VAZIO })

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [fi, pe] = await Promise.all([
      supabase.from('saude_fichas').select('*').eq('event_id',evento.id),
      supabase.from('people').select('id,name,photo_url').eq('event_id',evento.id).order('name'),
    ])
    setFichas(fi.data??[])
    setPessoas(pe.data??[])
    setLoading(false)
  }

  function getPessoa(id:string) { return pessoas.find(p=>p.id===id) }
  const comFicha  = fichas.map(f=>f.person_id)
  const semFicha  = pessoas.filter(p=>!comFicha.includes(p.id))

  function abrirNovo() {
    setEditando(null); setForm({...FORM_VAZIO}); setModal(true)
  }
  function abrirEdicao(f:Ficha) {
    setEditando(f)
    setForm({ person_id:f.person_id, diabetes:f.diabetes, hipertensao:f.hipertensao, cardiopatia:f.cardiopatia, epilepsia:f.epilepsia, ansiedade:f.ansiedade, tipo_sanguineo:f.tipo_sanguineo??'', plano_saude:f.plano_saude??'', alergias:f.alergias??'', medicamentos:f.medicamentos??'', restricoes_alimentares:f.restricoes_alimentares??'', medico_nome:f.medico_nome??'', medico_tel:f.medico_tel??'', contato_emergencia_nome:f.contato_emergencia_nome??'', contato_emergencia_telefone:f.contato_emergencia_telefone??'', observacoes:f.observacoes??'', medicamento_controlado:(f as any).medicamento_controlado??'', med_controlado_como:(f as any).med_controlado_como??'', med_controlado_horario:(f as any).med_controlado_horario??'08:00' })
    setModal(true)
  }

  async function salvar(e:React.FormEvent) {
    e.preventDefault(); setSalvando(true)
    if (!evento||!form.person_id) { setSalvando(false); return }
    const payload = { ...form, event_id:evento.id, tipo_sanguineo:form.tipo_sanguineo||null, plano_saude:form.plano_saude||null, alergias:form.alergias||null, medicamentos:form.medicamentos||null, restricoes_alimentares:form.restricoes_alimentares||null, medico_nome:form.medico_nome||null, medico_tel:form.medico_tel||null, contato_emergencia_nome:form.contato_emergencia_nome||null, contato_emergencia_telefone:form.contato_emergencia_telefone||null, observacoes:form.observacoes||null }
    await supabase.from('saude_fichas').upsert(payload,{onConflict:'person_id,event_id'})
    
    // Auto-agendar medicamento controlado se preenchido
    if (form.medicamento_controlado && evento) {
      // Buscar datas do evento para calcular dias
      const { data: ev } = await supabase.from('events').select('start_date,end_date').eq('id',evento.id).single()
      if (ev && ev.start_date && ev.end_date) {
        const start = new Date(ev.start_date)
        const end   = new Date(ev.end_date)
        // Criar agendamento para cada dia do evento
        for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
          // Check if already scheduled for this person/medicine/day
          await supabase.from('medications').upsert({
            person_id: form.person_id,
            event_id: evento.id,
            medicine_name: form.medicamento_controlado,
            dosage: form.med_controlado_como || null,
            horario: form.med_controlado_horario || '08:00',
            entregue: false,
            timestamp: new Date(d).toISOString(),
          })
        }
      }
    }
    
    setModal(false); setSalvando(false); setDetalhe(null); carregar()
  }

  async function excluir(id:string) {
    if (!confirm('Excluir esta ficha?')) return
    await supabase.from('saude_fichas').delete().eq('id',id)
    setDetalhe(null); carregar()
  }

  // Filtro + busca
  const listagem = (() => {
    let base = filtro==='sem' ? semFicha : filtro==='com' ? fichas.map(f=>getPessoa(f.person_id)).filter(Boolean) as Pessoa[] : pessoas
    if (busca) base = base.filter(p=>p.name.toLowerCase().includes(busca.toLowerCase()))
    return base
  })()

  function badgePessoa(pid:string) {
    const f = fichas.find(x=>x.person_id===pid)
    if (!f) return <span className="badge badge-warning" style={{fontSize:10}}>Sem ficha</span>
    const conds = CONDICOES.filter(c=>(f as any)[c.key]).map(c=>c.label)
    return conds.length > 0
      ? <span className="badge badge-danger" style={{fontSize:10}}>{conds[0]}{conds.length>1?` +${conds.length-1}`:''}</span>
      : <span className="badge badge-success" style={{fontSize:10}}>Saudável</span>
  }

  return (
    <div className="page">
      <SubTabs group="saude"/>
      {semFicha.length>0 && (
        <div className="alert-box alert-warning mb-3" style={{cursor:'pointer'}} onClick={()=>setFiltro('sem')}>
          <strong>{semFicha.length}</strong> sem ficha
        </div>
      )}

      <div className="stats-grid mb-3">
        <div className="stat-card"><div className="stat-label">Com ficha</div><div className="stat-value" style={{color:'var(--success)'}}>{fichas.length}</div></div>
        <div className="stat-card"><div className="stat-label">Sem ficha</div><div className="stat-value" style={{color:'var(--warning)'}}>{semFicha.length}</div></div>
        <div className="stat-card"><div className="stat-label">Com restrição</div><div className="stat-value" style={{color:'var(--danger)'}}>{fichas.filter(f=>f.diabetes||f.hipertensao||f.cardiopatia||f.epilepsia||f.ansiedade).length}</div></div>
      </div>

      <div className="search-bar mb-2">
        <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
        <input placeholder="Buscar pessoa..." value={busca} onChange={e=>setBusca(e.target.value)}/>
      </div>

      <div className="filter-bar mb-3">
        {([['todos','Todos'],['com','Com ficha'],['sem','Sem ficha']] as const).map(([v,l])=>(
          <button key={v} className={`chip ${filtro===v?'active':''}`} onClick={()=>setFiltro(v)}>{l}</button>
        ))}
      </div>

      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:68,marginBottom:8,borderRadius:14}}/>) :
      listagem.map(p => (
        <button key={p.id} className="list-card" onClick={()=>{ const f=fichas.find(x=>x.person_id===p.id); f ? setDetalhe({ficha:f,pessoa:p}) : (setForm({...FORM_VAZIO,person_id:p.id}),setEditando(null),setModal(true)) }}>
          <div className="list-card-bar" style={{background:'#2B6CB0'}}/>
          <div className="list-card-media" style={{background:'#EBF8FF'}}>
            {p.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:16,fontWeight:700,color:'#2B6CB0'}}>{getInitials(p.name)}</span>}
          </div>
          <div className="list-card-body">
            <div className="list-card-title">{p.name}</div>
            <div className="list-card-desc">{fichas.find(f=>f.person_id===p.id) ? (() => { const f=fichas.find(x=>x.person_id===p.id)!; const c=CONDICOES.filter(x=>(f as any)[x.key]).map(x=>x.label); return c.length>0?c.join(', '):'Sem restrições' })() : 'Sem ficha'}</div>
          </div>
          {badgePessoa(p.id)}
          <div className="list-card-chevron"><span className="icon icon-sm">chevron_right</span></div>
        </button>
      ))}

      <button className="fab" onClick={abrirNovo}><span className="icon">add</span></button>

      {/* Detalhe da ficha */}
      {detalhe && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setDetalhe(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'16px 0',borderBottom:'1px solid var(--border)',marginBottom:16}}>
              <div style={{width:52,height:52,borderRadius:'50%',background:'#EBF8FF',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                {detalhe.pessoa.photo_url?<img src={detalhe.pessoa.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:18,fontWeight:700,color:'#2B6CB0'}}>{getInitials(detalhe.pessoa.name)}</span>}
              </div>
              <div style={{flex:1}}>
                <p style={{fontSize:17,fontWeight:700}}>{detalhe.pessoa.name}</p>
                {detalhe.ficha.tipo_sanguineo && <p style={{fontSize:12,color:'var(--danger)',fontWeight:700}}>Tipo sanguíneo: {detalhe.ficha.tipo_sanguineo}</p>}
              </div>
            </div>

            {/* Condições */}
            {CONDICOES.some(c=>(detalhe.ficha as any)[c.key]) && (
              <div style={{background:'var(--danger-bg)',borderRadius:10,padding:'12px 14px',marginBottom:12}}>
                <p style={{fontSize:11,fontWeight:700,color:'var(--danger)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Condições de saúde</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {CONDICOES.filter(c=>(detalhe.ficha as any)[c.key]).map(c=>(
                    <span key={c.key} className="badge badge-danger">{c.label}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="info-section mb-3">
              <div className="info-section-title">Ficha médica</div>
              {detalhe.ficha.alergias && <div className="info-row"><span className="info-label">Alergias</span><span className="info-value">{detalhe.ficha.alergias}</span></div>}
              {detalhe.ficha.medicamentos && <div className="info-row"><span className="info-label">Medicamentos</span><span className="info-value">{detalhe.ficha.medicamentos}</span></div>}
              {detalhe.ficha.restricoes_alimentares && <div className="info-row"><span className="info-label">Restrições</span><span className="info-value">{detalhe.ficha.restricoes_alimentares}</span></div>}
              {detalhe.ficha.plano_saude && <div className="info-row"><span className="info-label">Plano</span><span className="info-value">{detalhe.ficha.plano_saude}</span></div>}
              {detalhe.ficha.medico_nome && <div className="info-row"><span className="info-label">Médico</span><span className="info-value">{detalhe.ficha.medico_nome}{detalhe.ficha.medico_tel?` · ${detalhe.ficha.medico_tel}`:''}</span></div>}
              {detalhe.ficha.contato_emergencia_nome && <div className="info-row"><span className="info-label">Emergência</span><span className="info-value">{detalhe.ficha.contato_emergencia_nome} · {detalhe.ficha.contato_emergencia_telefone}</span></div>}
              {detalhe.ficha.observacoes && <div className="info-row"><span className="info-label">Obs</span><span className="info-value">{detalhe.ficha.observacoes}</span></div>}
            </div>

            <div style={{display:'flex',gap:8,marginBottom:8}}>
              <button className="btn btn-outline" style={{flex:1}} onClick={()=>{setDetalhe(null);abrirEdicao(detalhe.ficha)}}>Editar</button>
              <button className="btn" style={{flex:1,background:'var(--danger-bg)',color:'var(--danger)',border:'none'}} onClick={()=>excluir(detalhe.ficha.id)}>Excluir ficha</button>
            </div>
            <button className="btn btn-ghost btn-full" onClick={()=>setDetalhe(null)}>Fechar</button>
          </div>
        </div>
      )}

      {/* Modal cadastro/edição */}
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'95vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?'Editar ficha':'Nova ficha médica'}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <form onSubmit={salvar}>
              {!editando && (
                <div className="form-group">
                  <PersonSelect label="Pessoa" required pessoas={pessoas} value={form.person_id} onChange={id=>setForm(f=>({...f,person_id:id}))} placeholder="Buscar pessoa..."/>
                </div>
              )}

              {/* Condições de saúde */}
              <div className="form-group">
                <label className="form-label">Condições de saúde</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:4}}>
                  {CONDICOES.map(c=>(
                    <button key={c.key} type="button" onClick={()=>setForm(f=>({...f,[c.key]:!(f as any)[c.key]}))} style={{padding:'10px 12px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:600,border:`2px solid ${(form as any)[c.key]?'var(--danger)':'var(--border)'}`,background:(form as any)[c.key]?'var(--danger-bg)':'white',color:(form as any)[c.key]?'var(--danger)':'var(--text2)',display:'flex',alignItems:'center',gap:6}}>
                      {(form as any)[c.key] && <span className="icon icon-sm" style={{color:'var(--danger)'}}>check</span>}
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Tipo sanguíneo</label>
                  <select className="form-select" value={form.tipo_sanguineo} onChange={e=>setForm(f=>({...f,tipo_sanguineo:e.target.value}))}>
                    <option value="">Não informado</option>
                    {TIPO_SANG.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Plano de saúde</label>
                  <input className="form-input" value={form.plano_saude} onChange={e=>setForm(f=>({...f,plano_saude:e.target.value}))} placeholder="Ex: Unimed"/>
                </div>
              </div>

              <div className="form-group"><label className="form-label">Alergias</label>
                <textarea className="form-textarea" value={form.alergias} onChange={e=>setForm(f=>({...f,alergias:e.target.value}))} placeholder="Ex: Dipirona, amendoim, penicilina..." style={{minHeight:60}}/>
              </div>
              <div className="form-group"><label className="form-label">Medicamentos em uso</label>
                <textarea className="form-textarea" value={form.medicamentos} onChange={e=>setForm(f=>({...f,medicamentos:e.target.value}))} placeholder="Ex: Losartana 50mg - 7h e 19h | Metformina 500mg - 8h" style={{minHeight:70}}/>
                <p className="form-hint mt-1">Para medicamentos com horários, use: Nome dosagem - horários separados por vírgula</p>
              </div>
              <div className="form-group"><label className="form-label">Restrições alimentares</label>
                <input className="form-input" value={form.restricoes_alimentares} onChange={e=>setForm(f=>({...f,restricoes_alimentares:e.target.value}))} placeholder="Ex: Vegetariano, intolerante à lactose..."/>
              </div>

              <div style={{height:1,background:'var(--border)',margin:'4px 0 14px'}}/>
              <p style={{fontSize:13,fontWeight:700,marginBottom:12}}>Contatos médicos</p>

              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Médico responsável</label>
                  <input className="form-input" value={form.medico_nome} onChange={e=>setForm(f=>({...f,medico_nome:e.target.value}))}/>
                </div>
                <div className="form-group"><label className="form-label">Tel. médico</label>
                  <input className="form-input" value={form.medico_tel} onChange={e=>setForm(f=>({...f,medico_tel:e.target.value}))}/>
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Contato de emergência</label>
                  <input className="form-input" value={form.contato_emergencia_nome} onChange={e=>setForm(f=>({...f,contato_emergencia_nome:e.target.value}))}/>
                </div>
                <div className="form-group"><label className="form-label">Tel. emergência</label>
                  <input className="form-input" value={form.contato_emergencia_telefone} onChange={e=>setForm(f=>({...f,contato_emergencia_telefone:e.target.value}))}/>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Observações</label>
                <textarea className="form-textarea" value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} style={{minHeight:60}}/>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Salvando...':editando?'Salvar':'Criar ficha'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
