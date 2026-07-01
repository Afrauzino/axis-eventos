import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import SubTabs from '../components/SubTabs'
import { fmtDataHora, isAdmin } from '../utils'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Ocorrencia = { id:string; title:string; description:string; severity:string; status:string; created_at:string; resolved_at?:string|null }

const SEV: Record<string,{label:string;cor:string;bg:string}> = {
  low:      {label:'Baixa',   cor:'var(--success)', bg:'var(--success-bg)'},
  medium:   {label:'Média',   cor:'var(--warning)', bg:'var(--warning-bg)'},
  high:     {label:'Alta',    cor:'#C05621',         bg:'#FFF0E6'},
  critical: {label:'Crítica', cor:'var(--danger)',  bg:'var(--danger-bg)'},
}

export default function Ocorrencias({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [lista, setLista]       = useState<Ocorrencia[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState<'abertas'|'resolvidas'>('abertas')
  const [modal, setModal]       = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroBotao, setErroBotao] = useState<string|null>(null)
  const [form, setForm] = useState({ title:'', description:'', severity:'medium' })

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const { data } = await supabase
      .from('occurrences')
      .select('*')
      .eq('event_id', evento.id)
      .order('created_at', { ascending: false })
    setLista(data ?? [])
    setLoading(false)
  }

  async function resolver(id: string) {
    setErroBotao(null)
    // Update apenas o status - evita erro de coluna inexistente no banco
    const { error } = await supabase
      .from('occurrences')
      .update({ status: 'resolved' })
      .eq('id', id)

    if (error) {
      setErroBotao('Erro ao resolver: ' + error.message)
      return
    }
    setLista(prev =>
      prev.map(o => o.id === id ? { ...o, status: 'resolved', resolved_at: new Date().toISOString() } : o)
    )
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    if (!evento) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setSalvando(false); return }
    const { error } = await supabase.from('occurrences').insert({
      ...form,
      event_id:   evento.id,
      status:     'open',
      created_by: userData.user.id,
    })
    if (!error) {
      setModal(false)
      setForm({ title:'', description:'', severity:'medium' })
      carregar()
    }
    setSalvando(false)
  }

  const abertas    = lista.filter(o => o.status !== 'resolved')
  const resolvidas = lista.filter(o => o.status === 'resolved')
  const exibindo   = filtro === 'abertas' ? abertas : resolvidas

  return (
    <div className="page">
      <SubTabs group="evento"/>
      {lista.length > 0 && (
        <div className="stats-grid mb-3">
          <div className="stat-card" onClick={()=>setFiltro('abertas')} style={{cursor:'pointer'}}>
            <div className="stat-label">Em aberto</div>
            <div className="stat-value" style={{color:abertas.length>0?'var(--danger)':'var(--success)'}}>{abertas.length}</div>
          </div>
          <div className="stat-card" onClick={()=>setFiltro('resolvidas')} style={{cursor:'pointer'}}>
            <div className="stat-label">Resolvidas</div>
            <div className="stat-value" style={{color:'var(--success)'}}>{resolvidas.length}</div>
          </div>
        </div>
      )}

      {erroBotao && (
        <div className="alert-box alert-error mb-3">{erroBotao}</div>
      )}

      <div className="tabs mb-3">
        <button className={`tab ${filtro==='abertas'?'active':''}`} onClick={()=>setFiltro('abertas')}>
          Em aberto{abertas.length>0?` (${abertas.length})`:''}
        </button>
        <button className={`tab ${filtro==='resolvidas'?'active':''}`} onClick={()=>setFiltro('resolvidas')}>
          Resolvidas
        </button>
      </div>

      {loading
        ? [1,2].map(i=><div key={i} className="skeleton" style={{height:100,marginBottom:8,borderRadius:14}}/>)
        : exibindo.length === 0
          ? (
            <div className="empty">
              <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>warning</span></div>
              <p className="empty-title">
                {filtro==='abertas' ? 'Nenhuma ocorrência em aberto' : 'Nenhuma ocorrência resolvida'}
              </p>
            </div>
          )
          : exibindo.map(o => {
            const cfg = SEV[o.severity] ?? SEV.medium
            const resolvida = o.status === 'resolved'
            return (
              <div
                key={o.id}
                style={{
                  background:'white', borderRadius:14, boxShadow:'var(--shadow-sm)',
                  marginBottom:8, borderLeft:`4px solid ${resolvida?'var(--muted)':cfg.cor}`,
                  padding:'13px 14px', opacity:resolvida?0.8:1
                }}
              >
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:11,fontWeight:700,background:resolvida?'var(--bg)':cfg.bg,color:resolvida?'var(--muted)':cfg.cor,padding:'2px 8px',borderRadius:99}}>
                    {resolvida ? 'Resolvida' : cfg.label}
                  </span>
                  <span style={{fontSize:11,color:'var(--muted)'}}>{fmtDataHora(o.created_at)}</span>
                </div>
                <p style={{fontWeight:700,fontSize:14,marginBottom:4}}>{o.title}</p>
                <p style={{fontSize:13,color:'var(--text2)',marginBottom:10,lineHeight:1.5}}>{o.description}</p>
                {resolvida
                  ? <p style={{fontSize:11,color:'var(--muted)'}}>
                      ✓ Resolvida em {o.resolved_at ? fmtDataHora(o.resolved_at) : '-'}
                    </p>
                  : (
                    <button
                      className="btn btn-sm"
                      style={{background:'var(--success-bg)',color:'var(--success)',border:'1px solid var(--success)',width:'100%'}}
                      onClick={() => resolver(o.id)}
                    >
                      <span className="icon icon-sm">check_circle</span> Marcar como resolvida
                    </button>
                  )
                }
              </div>
            )
          })
      }

      <button className="fab" onClick={()=>setModal(true)}><span className="icon">add</span></button>

      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0 16px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>Registrar ocorrência</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>
                <span className="icon icon-sm">close</span>
              </button>
            </div>
            <form onSubmit={salvar}>
              <div className="form-group">
                <label className="form-label">Título <span className="req">*</span></label>
                <input className="form-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required/>
              </div>
              <div className="form-group">
                <label className="form-label">Descrição <span className="req">*</span></label>
                <textarea className="form-textarea" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} required style={{minHeight:80}}/>
              </div>
              <div className="form-group">
                <label className="form-label">Gravidade</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {Object.entries(SEV).map(([v,cfg])=>(
                    <button key={v} type="button" onClick={()=>setForm(f=>({...f,severity:v}))}
                      style={{padding:'10px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13,fontFamily:'inherit',border:`2px solid ${form.severity===v?cfg.cor:'var(--border)'}`,background:form.severity===v?cfg.bg:'white',color:form.severity===v?cfg.cor:'var(--text2)'}}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando ? 'Registrando...' : 'Registrar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
