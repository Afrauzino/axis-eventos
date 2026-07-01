import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SubTabs from '../components/SubTabs'
import { fmtHora, isAdmin } from '../utils'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Teatro     = { id:string; nome:string; descricao:string|null; data_hora:string|null; local:string|null; status:string; cor:string|null; ministracao_id:string|null }
type Ministracao = { id:string; titulo:string }

const CORES = ['#E8821A','#6B46C1','#2F855A','#C53030','#2B6CB0','#D53F8C','#00A99D','#1A202C','#D69E2E','#C05621']
const STATUS_LABEL: Record<string,string> = { planejamento:'Planejamento', ensaio:'Ensaio', pronto:'Pronto', concluido:'Concluido' }
const STATUS_BADGE: Record<string,string> = { planejamento:'badge-neutral', ensaio:'badge-info', pronto:'badge-success', concluido:'badge-neutral' }

export default function TeatroLista({ profile }: { profile?: Profile }) {
  const navigate = useNavigate()
  const { evento, loading: evLoading } = useEvento()
  const [lista, setLista]       = useState<Teatro[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState<Teatro|null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')
  const [busca, setBusca]       = useState('')
  const [ministracoes, setMinistracoes] = useState<Ministracao[]>([])
  const [form, setForm] = useState({ nome:'', descricao:'', data_hora:'', local:'', cor:'#E8821A', ministracao_id:'' })

  const canEdit = profile && isAdmin(profile.user_role)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [th, mi] = await Promise.all([
      supabase.from('theaters').select('*').eq('event_id', evento.id).order('nome'),
      supabase.from('ministrações').select('id,titulo').eq('event_id', evento.id).order('titulo'),
    ])
    setLista(th.data ?? [])
    setMinistracoes(mi.data ?? [])
    setLoading(false)
  }

  function abrirNovo() {
    setEditando(null)
    setForm({ nome:'', descricao:'', data_hora:'', local:'', cor:'#E8821A' })
    setErro(''); setModal(true)
  }

  async function mudarStatusTeatro(id: string, statusAtual: string) {
    const ordem = ['planejamento','ensaio','pronto','concluido']
    const idx   = ordem.indexOf(statusAtual)
    const prox  = ordem[(idx + 1) % ordem.length]
    await supabase.from('theaters').update({ status: prox }).eq('id', id)
    setLista(prev => prev.map(t => t.id===id ? {...t, status:prox} : t))
  }

  function abrirEdicao(t: Teatro) {
    setEditando(t)
    setForm({ nome:t.nome, descricao:t.descricao??'', data_hora:t.data_hora?new Date(t.data_hora).toISOString().slice(0,16):'', local:t.local??'', cor:t.cor??'#E8821A', ministracao_id:(t as any).ministracao_id??'' })
    setErro(''); setModal(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true)
    if (!evento || !form.nome.trim()) { setErro('Nome obrigatorio.'); setSalvando(false); return }
    const payload = {
      nome: form.nome, descricao: form.descricao||null,
      data_hora: form.data_hora ? new Date(form.data_hora).toISOString() : null,
      local: form.local||null, cor: form.cor,
    }
    let err
    if (editando) { const r=await supabase.from('theaters').update(payload).eq('id',editando.id); err=r.error }
    else { const r=await supabase.from('theaters').insert({...payload,event_id:evento.id,status:'planejamento'}); err=r.error }
    if (err) { setErro('Erro: '+err.message); setSalvando(false); return }
    setModal(false); setSalvando(false); setEditando(null); carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este teatro? Todas as cenas e elenco serao removidos.')) return
    await supabase.from('theaters').delete().eq('id', id)
    setModal(false); carregar()
  }

  const filtrados = lista.filter(t => !busca || t.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="page">
      <SubTabs group="teatro"/>
      <div className="search-bar mb-3">
        <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
        <input placeholder="Buscar teatro..." value={busca} onChange={e=>setBusca(e.target.value)}/>
      </div>

      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:8,borderRadius:14}}/>) :
      filtrados.length===0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>theater_comedy</span></div>
          <p className="empty-title">Nenhum teatro</p>
          <p className="empty-desc">Cadastre os teatros deste evento.</p>
        </div>
      ) : filtrados.map(t => {
        const cor = t.cor ?? 'var(--accent)'
        return (
          <div key={t.id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,overflow:'hidden'}}>
            <button style={{width:'100%',display:'flex',alignItems:'center',gap:0,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left',padding:0}} onClick={()=>navigate('/teatro/'+t.id)}>
              <div style={{width:4,background:cor,alignSelf:'stretch',flexShrink:0}}/>
              <div style={{width:52,height:52,background:cor+'22',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,margin:'13px 12px'}}>
                <span className="icon" style={{color:cor,fontSize:26}}>theater_comedy</span>
              </div>
              <div style={{flex:1,minWidth:0,padding:'13px 0'}}>
                {t.data_hora && <p style={{fontSize:12,fontWeight:700,color:cor,marginBottom:2}}>{fmtHora(t.data_hora)}</p>}
                <p style={{fontWeight:700,fontSize:15,marginBottom:2}}>{t.nome}</p>
                <p style={{fontSize:12,color:'var(--muted)'}}>{t.local ?? 'Local nao definido'}</p>
              </div>
              <button
                onClick={e=>{e.stopPropagation();mudarStatusTeatro(t.id,t.status)}}
                className={`badge ${STATUS_BADGE[t.status]??'badge-neutral'}`}
                style={{flexShrink:0,fontSize:10,marginRight:4,border:'none',cursor:'pointer',fontFamily:'inherit'}}
                title="Clique para avançar status"
              >{STATUS_LABEL[t.status]??t.status}</button>
              <span className="icon icon-sm" style={{color:'var(--muted-light)',marginRight:12}}>chevron_right</span>
            </button>
            {canEdit && (
              <div style={{borderTop:'1px solid var(--border)',padding:'8px 14px',display:'flex',gap:6}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>abrirEdicao(t)}>
                  <span className="icon icon-sm">edit</span> Editar
                </button>
              </div>
            )}
          </div>
        )
      })}

      {canEdit && <button className="fab" onClick={abrirNovo}><span className="icon">add</span></button>}

      {modal && canEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0 16px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?'Editar teatro':'Novo teatro'}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Nome do teatro <span className="req">*</span></label>
                <input className="form-input" placeholder="Ex: O Filho Prodigo" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} required/>
              </div>
              <div className="form-group"><label className="form-label">Descricao</label>
                <textarea className="form-textarea" value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} style={{minHeight:70}}/>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Data e hora</label>
                  <input className="form-input" type="datetime-local" value={form.data_hora} onChange={e=>setForm(f=>({...f,data_hora:e.target.value}))} min={(evento as any)?.start_date ? `${(evento as any).start_date}T00:00` : undefined} max={(evento as any)?.end_date ? `${(evento as any).end_date}T23:59` : undefined}/>
                </div>
                <div className="form-group"><label className="form-label">Local</label>
                  <input className="form-input" value={form.local} onChange={e=>setForm(f=>({...f,local:e.target.value}))}/>
                </div>
              </div>

              {/* Cor do teatro */}
              <div className="form-group">
                <label className="form-label">Cor do teatro</label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',paddingTop:4,marginBottom:8}}>
                  {CORES.map(c=>(
                    <button key={c} type="button" onClick={()=>setForm(f=>({...f,cor:c}))} style={{width:34,height:34,borderRadius:8,background:c,border:'none',cursor:'pointer',boxShadow:form.cor===c?`0 0 0 3px white, 0 0 0 5px ${c}`:'none',transition:'box-shadow 0.15s'}}/>
                  ))}
                </div>
                {/* Cor livre */}
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:13,color:'var(--text2)'}}>Ou escolha:</span>
                  <input type="color" value={form.cor} onChange={e=>setForm(f=>({...f,cor:e.target.value}))} style={{width:40,height:36,borderRadius:8,border:'1px solid var(--border)',cursor:'pointer',padding:2}}/>
                  <div style={{width:36,height:36,borderRadius:8,background:form.cor,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span className="icon" style={{color:'white',fontSize:18}}>theater_comedy</span>
                  </div>
                </div>
              </div>

              {/* Ministração vinculada */}
              <div className="form-group">
                <label className="form-label">Ministração vinculada</label>
                <p className="form-hint mb-2">Ao vincular, teatro e ministração se abrem mutuamente.</p>
                <select className="form-select" value={form.ministracao_id} onChange={e=>setForm(f=>({...f,ministracao_id:e.target.value}))}>
                  <option value="">Nenhuma</option>
                  {ministracoes.map(m=><option key={m.id} value={m.id}>{m.titulo}</option>)}
                </select>
              </div>

              {editando && (
                <button type="button" onClick={()=>excluir(editando.id)} style={{background:'var(--danger-bg)',color:'var(--danger)',border:'none',borderRadius:8,padding:'8px 14px',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',marginBottom:8,width:'100%'}}>
                  Excluir teatro
                </button>
              )}
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Salvando...':editando?'Salvar':'Criar teatro'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
