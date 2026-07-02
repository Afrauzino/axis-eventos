import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import SubTabs from '../components/SubTabs'
import FichaMedica from '../components/FichaMedica'
import { getInitials } from '../utils'
import { useEvento } from '../hooks/useEvento'
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

export default function SaudeFicha({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [fichas, setFichas]     = useState<Ficha[]>([])
  const [pessoas, setPessoas]   = useState<Pessoa[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState<'todos'|'com'|'sem'>('todos')
  const [busca, setBusca]       = useState('')
  const [aberta, setAberta]     = useState<Pessoa|null>(null)

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

  // Filtro + busca
  const listagem = (() => {
    let base = filtro==='sem' ? semFicha : filtro==='com' ? fichas.map(f=>getPessoa(f.person_id)).filter(Boolean) as Pessoa[] : pessoas
    if (busca) base = base.filter(p=>p.name.toLowerCase().includes(busca.toLowerCase()))
    return base
  })()

  function flagsFicha(f:any): string[] {
    if (!f) return []
    const flags:string[] = []
    if (f.restricao_alimentar ?? f.restricoes_alimentares) flags.push('Restrição alimentar')
    if (f.alergia_medicamentos ?? f.alergias) flags.push('Alergia a medicamentos')
    if (f.toma_controlado ?? f.medicamento_controlado) flags.push('Medicamento contínuo')
    return flags
  }
  function badgePessoa(pid:string) {
    const f = fichas.find(x=>x.person_id===pid)
    if (!f) return <span className="badge badge-warning" style={{fontSize:10}}>Sem ficha</span>
    const fl = flagsFicha(f)
    return fl.length > 0
      ? <span className="badge badge-danger" style={{fontSize:10}}>{fl.length===1?fl[0]:`${fl.length} alertas`}</span>
      : <span className="badge badge-success" style={{fontSize:10}}>Ok</span>
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
        <div className="stat-card"><div className="stat-label">Com alerta</div><div className="stat-value" style={{color:'var(--danger)'}}>{fichas.filter(f=>flagsFicha(f).length>0).length}</div></div>
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
      listagem.map(p => {
        const f = fichas.find(x=>x.person_id===p.id)
        const fl = flagsFicha(f)
        return (
        <div key={p.id} style={{background:'white',borderRadius:12,boxShadow:'0 1px 5px rgba(0,0,0,0.12)',marginBottom:10,overflow:'hidden',display:'flex'}}>
          <div style={{width:6,alignSelf:'stretch',background:'var(--primary)',flexShrink:0}}/>
          <button onClick={()=>setAberta(p)} style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:14,padding:'16px 15px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
            <div style={{width:58,height:58,borderRadius:'50%',background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
              {p.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:20,fontWeight:700,color:'var(--primary)'}}>{getInitials(p.name)}</span>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontWeight:700,fontSize:15,marginBottom:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</p>
              <p style={{fontSize:12,color:'var(--muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{!f ? 'Sem ficha' : fl.length ? fl.join(' · ') : 'Sem alertas'}</p>
            </div>
            {badgePessoa(p.id)}
            <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>chevron_right</span>
          </button>
        </div>
        )
      })}

      {/* Ficha médica (componente reutilizável, fonte única) */}
      {aberta && evento && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setAberta(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 28px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 16px'}}/>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
              <div style={{width:52,height:52,borderRadius:'50%',background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                {aberta.photo_url?<img src={aberta.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:18,fontWeight:700,color:'var(--primary)'}}>{getInitials(aberta.name)}</span>}
              </div>
              <p style={{flex:1,fontSize:17,fontWeight:700}}>{aberta.name}</p>
              <button onClick={()=>setAberta(null)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <FichaMedica personId={aberta.id} eventId={evento.id} startOpen onSaved={carregar}/>
            <button className="btn btn-ghost btn-full" onClick={()=>setAberta(null)}>Fechar</button>
          </div>
        </div>
      )}

    </div>
  )
}
