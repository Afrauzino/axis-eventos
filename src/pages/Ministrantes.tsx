import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getInitials, isAdmin } from '../utils'
import { useEvento } from '../hooks/useEvento'
import PersonSelect from '../components/PersonSelect'
import type { Profile } from '../App'

type Ministracao = { id:string; titulo:string; ministrante_id:string|null; hora_inicio:string; hora_fim:string; local:string|null; tema:string|null; status:string; descricao:string|null; anotacoes_pessoais:string|null }
type Pessoa = { id:string; name:string; photo_url:string|null }

export default function Ministrantes({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [mins, setMins]       = useState<Ministracao[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [detalhe, setDetalhe] = useState<Ministracao|null>(null)
  const [modal, setModal]     = useState(false)
  const [editando, setEditando] = useState<Ministracao|null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]       = useState('')
  const [form, setForm] = useState({ titulo:'', ministrante_id:'', hora_inicio:'', hora_fim:'', local:'', tema:'', descricao:'', anotacoes_pessoais:'' })

  const canEdit = profile && isAdmin(profile.user_role)
  const userId  = profile?.user_id

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [mi, pe] = await Promise.all([
      supabase.from('ministrações').select('*').eq('event_id', evento.id).order('hora_inicio'),
      supabase.from('people').select('id,name,photo_url').eq('event_id', evento.id).order('name'),
    ])
    setMins(mi.data ?? [])
    setPessoas(pe.data ?? [])
    setLoading(false)
  }

  function getPessoa(id: string|null) { return id ? pessoas.find(p=>p.id===id) : null }

  function fmtHora(iso: string) { return new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) }
  function fmtData(iso: string) { return new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true)
    if (!evento || !form.titulo.trim()) { setErro('Titulo obrigatorio.'); setSalvando(false); return }
    const payload = {
      titulo: form.titulo, ministrante_id: form.ministrante_id||null,
      hora_inicio: new Date(form.hora_inicio).toISOString(),
      hora_fim: new Date(form.hora_fim).toISOString(),
      local: form.local||null, tema: form.tema||null,
      descricao: form.descricao||null, status: 'planejado',
    }
    let err
    if (editando) { const r=await supabase.from('ministrações').update(payload).eq('id',editando.id); err=r.error }
    else { const r=await supabase.from('ministrações').insert({...payload,event_id:evento.id}); err=r.error }
    if (err) { setErro('Erro: '+err.message); setSalvando(false); return }
    setModal(false); setSalvando(false); setEditando(null); carregar()
  }

  async function salvarAnotacoes(id: string, anotacoes: string) {
    await supabase.from('ministrações').update({anotacoes_pessoais:anotacoes}).eq('id',id)
  }

  const STATUS_COR: Record<string,string> = { planejado:'badge-neutral', em_andamento:'badge-warning', concluido:'badge-success', cancelado:'badge-danger' }

  return (
    <div className="page">
      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:8,borderRadius:14}}/>) :
      mins.length===0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>church</span></div>
          <p className="empty-title">Nenhuma ministracao</p>
          <p className="empty-desc">Cadastre as ministracoes deste evento.</p>
          {canEdit && <button className="btn btn-primary btn-sm" onClick={()=>setModal(true)}>Cadastrar</button>}
        </div>
      ) : mins.map(m => {
        const min = getPessoa(m.ministrante_id)
        return (
          <button key={m.id} className="list-card" onClick={()=>setDetalhe(m)}>
            <div className="list-card-bar" style={{background:'#6B46C1'}}/>
            <div className="list-card-media" style={{background:'#F3F0FF'}}>
              {min?.photo_url ? <img src={min.photo_url} alt=""/> : <span className="icon" style={{color:'#6B46C1'}}>church</span>}
            </div>
            <div className="list-card-body">
              <div className="list-card-time" style={{color:'#6B46C1'}}>{fmtData(m.hora_inicio)} · {fmtHora(m.hora_inicio)}</div>
              <div className="list-card-title">{m.titulo}</div>
              <div className="list-card-desc">{min?.name ?? 'Sem ministrante'}{m.local ? ` · ${m.local}` : ''}</div>
            </div>
            <div className="list-card-chevron"><span className="icon icon-sm">chevron_right</span></div>
          </button>
        )
      })}

      {canEdit && <button className="fab" onClick={()=>{setEditando(null);setForm({titulo:'',ministrante_id:'',hora_inicio:'',hora_fim:'',local:'',tema:'',descricao:'',anotacoes_pessoais:''});setErro('');setModal(true)}}><span className="icon">add</span></button>}

      {/* Detalhe */}
      {detalhe && (() => {
        const min = getPessoa(detalhe.ministrante_id)
        const isMinistranteLogado = min?.id === userId
        const canSeeContent = canEdit || isMinistranteLogado
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setDetalhe(null)}>
            <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'90vh',overflowY:'auto'}}>
              <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
              <div style={{background:'#6B46C1',borderRadius:12,padding:'16px',margin:'16px 0',color:'white'}}>
                <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',opacity:0.8,marginBottom:4}}>Ministracao</p>
                <p style={{fontSize:18,fontWeight:800,marginBottom:4}}>{detalhe.titulo}</p>
                <p style={{fontSize:13,opacity:0.9}}>{fmtData(detalhe.hora_inicio)} · {fmtHora(detalhe.hora_inicio)} — {fmtHora(detalhe.hora_fim)}</p>
              </div>
              <div className="info-section mb-3">
                <div className="info-section-title">Detalhes</div>
                {min && <div className="info-row"><span className="info-label">Ministrante</span><span className="info-value">{min.name}</span></div>}
                {detalhe.local && <div className="info-row"><span className="info-label">Local</span><span className="info-value">{detalhe.local}</span></div>}
                {detalhe.tema && <div className="info-row"><span className="info-label">Tema</span><span className="info-value">{detalhe.tema}</span></div>}
                <div className="info-row"><span className="info-label">Status</span><span className={`badge ${STATUS_COR[detalhe.status]??'badge-neutral'}`}>{detalhe.status}</span></div>
              </div>
              {canSeeContent && detalhe.descricao && (
                <div className="info-section mb-3">
                  <div className="info-section-title">Conteudo</div>
                  <p style={{fontSize:14,color:'var(--text2)',lineHeight:1.7}}>{detalhe.descricao}</p>
                </div>
              )}
              {isMinistranteLogado && (
                <div className="info-section mb-3">
                  <div className="info-section-title">Minhas anotacoes pessoais</div>
                  <p style={{fontSize:12,color:'var(--muted)',marginBottom:8}}>Visiveis apenas para voce.</p>
                  <textarea className="form-textarea" defaultValue={detalhe.anotacoes_pessoais??''} onBlur={e=>salvarAnotacoes(detalhe.id,e.target.value)} placeholder="Suas anotacoes privadas..." style={{minHeight:100}}/>
                </div>
              )}
              {canEdit && (
                <button className="btn btn-ghost btn-full mb-3" onClick={()=>{setDetalhe(null);setEditando(detalhe);setForm({titulo:detalhe.titulo,ministrante_id:detalhe.ministrante_id??'',hora_inicio:new Date(detalhe.hora_inicio).toISOString().slice(0,16),hora_fim:new Date(detalhe.hora_fim).toISOString().slice(0,16),local:detalhe.local??'',tema:detalhe.tema??'',descricao:detalhe.descricao??'',anotacoes_pessoais:detalhe.anotacoes_pessoais??''});setModal(true)}}>Editar</button>
              )}
              <button className="btn btn-ghost btn-full" onClick={()=>setDetalhe(null)}>Fechar</button>
            </div>
          </div>
        )
      })()}

      {/* Modal cadastro */}
      {modal && canEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0 16px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?'Editar':'Nova ministracao'}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Titulo <span className="req">*</span></label>
                <input className="form-input" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} required/>
              </div>
              <div className="form-group">
                <PersonSelect label="Ministrante" pessoas={pessoas} value={form.ministrante_id} onChange={id=>setForm(f=>({...f,ministrante_id:id}))} placeholder="Buscar ministrante..."/>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Inicio <span className="req">*</span></label>
                  <input className="form-input" type="datetime-local" value={form.hora_inicio} onChange={e=>setForm(f=>({...f,hora_inicio:e.target.value}))} required/>
                </div>
                <div className="form-group"><label className="form-label">Fim <span className="req">*</span></label>
                  <input className="form-input" type="datetime-local" value={form.hora_fim} onChange={e=>setForm(f=>({...f,hora_fim:e.target.value}))} required/>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Local</label>
                <input className="form-input" value={form.local} onChange={e=>setForm(f=>({...f,local:e.target.value}))}/>
              </div>
              <div className="form-group"><label className="form-label">Tema</label>
                <input className="form-input" value={form.tema} onChange={e=>setForm(f=>({...f,tema:e.target.value}))}/>
              </div>
              <div className="form-group"><label className="form-label">Conteudo / Descricao</label>
                <textarea className="form-textarea" value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Visiveis para admin e lideres..."/>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Salvando...':editando?'Salvar':'Cadastrar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
