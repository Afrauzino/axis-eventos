import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getInitials, isAdmin, fmtData, fmtDataHora, fmtBRL } from '../utils'
import { useEvento } from '../hooks/useEvento'
import PersonSelect from '../components/PersonSelect'
import type { Profile } from '../App'

type Doacao = { id:string; person_id:string|null; valor:number; descricao:string|null; forma_pagamento:string|null; data_doacao:string; anonima:boolean; created_at:string }
type Pessoa = { id:string; name:string; photo_url:string|null }

export default function Doacoes({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [doacoes, setDoacoes] = useState<Doacao[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ person_id:'', valor:'', descricao:'', forma_pagamento:'pix', anonima:false })

  const admin = profile && isAdmin(profile.user_role)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [do_, pe] = await Promise.all([
      supabase.from('doacoes').select('*').eq('event_id',evento.id).order('created_at',{ascending:false}),
      supabase.from('people').select('id,name,photo_url').eq('event_id',evento.id).order('name'),
    ])
    setDoacoes(do_.data??[])
    setPessoas(pe.data??[])
    setLoading(false)
  }

  async function salvar(e:React.FormEvent) {
    e.preventDefault(); setSalvando(true)
    if (!evento||!form.valor) { setSalvando(false); return }
    await supabase.from('doacoes').insert({
      event_id:evento.id,
      person_id:form.anonima?null:(form.person_id||null),
      valor:parseFloat(form.valor),
      descricao:form.descricao||null,
      forma_pagamento:form.forma_pagamento,
      anonima:form.anonima,
      data_doacao:new Date().toISOString(),
    })
    setModal(false); setSalvando(false)
    setForm({person_id:'',valor:'',descricao:'',forma_pagamento:'pix',anonima:false}); carregar()
  }

  async function excluir(id:string) {
    if (!confirm('Excluir esta doação?')) return
    await supabase.from('doacoes').delete().eq('id',id)
    carregar()
  }

  function getPessoa(id:string|null) { return id ? pessoas.find(p=>p.id===id) : null }

  const anonimas = doacoes.filter(d=>d.anonima).length

  return (
    <div className="page">
      <div className="alert-box alert-info mb-3">
        Doações são registros separados e <strong>nunca alteram o saldo da inscrição</strong>.
      </div>

      {admin && (
        <div className="stats-grid mb-3" style={{gridTemplateColumns:'1fr 1fr'}}>
          <div className="stat-card"><div className="stat-label">Total de doações</div><div className="stat-value">{doacoes.length}</div></div>
          <div className="stat-card"><div className="stat-label">Anônimas</div><div className="stat-value">{anonimas}</div></div>
        </div>
      )}

      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:68,marginBottom:8,borderRadius:14}}/>) :
      doacoes.length===0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>volunteer_activism</span></div>
          <p className="empty-title">Nenhuma doação registrada</p>
          <p className="empty-desc">Registre as doações recebidas durante o evento.</p>
        </div>
      ) : doacoes.map(d => {
        const p = getPessoa(d.person_id)
        return (
          <div key={d.id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,display:'flex',alignItems:'center',gap:0,overflow:'hidden'}}>
            <div style={{width:4,background:'var(--success)',alignSelf:'stretch',flexShrink:0}}/>
            <div style={{display:'flex',alignItems:'center',gap:12,flex:1,padding:'12px 14px'}}>
              <div style={{width:42,height:42,borderRadius:'50%',background:d.anonima?'var(--bg)':'var(--success-bg)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                {d.anonima
                  ? <span className="icon" style={{color:'var(--muted-light)'}}>person</span>
                  : p?.photo_url
                    ? <img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : <span style={{fontSize:15,fontWeight:700,color:'var(--success)'}}>{getInitials(p?.name??'?')}</span>
                }
              </div>
              <div style={{flex:1}}>
                <p style={{fontWeight:700,fontSize:14}}>{d.anonima ? 'Doação anônima' : (p?.name ?? 'Pessoa')}</p>
                <p style={{fontSize:12,color:'var(--muted)'}}>{d.forma_pagamento}{d.descricao?` · ${d.descricao}`:''}</p>
                <p style={{fontSize:11,color:'var(--muted)'}}>{fmtDataHora(d.data_doacao)}</p>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <p style={{fontWeight:800,fontSize:16,color:'var(--success)'}}>{fmtBRL(d.valor)}</p>
                {admin && (
                  <button onClick={()=>excluir(d.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',fontSize:11,fontFamily:'inherit',marginTop:4}}>excluir</button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <button className="fab" onClick={()=>setModal(true)}><span className="icon">add</span></button>

      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>Registrar doação</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <p style={{fontSize:12,color:'var(--muted)',marginBottom:16}}>Doações não afetam o saldo da inscrição.</p>
            <form onSubmit={salvar}>
              {/* Anônima toggle */}
              <div className="form-group">
                <button type="button" onClick={()=>setForm(f=>({...f,anonima:!f.anonima,person_id:''}))} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',textAlign:'left',width:'100%',border:`2px solid ${form.anonima?'var(--primary)':'var(--border)'}`,background:form.anonima?'var(--primary-light)':'white'}}>
                  <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${form.anonima?'var(--primary)':'var(--border)'}`,background:form.anonima?'var(--primary)':'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {form.anonima && <span className="icon" style={{fontSize:16,color:'white'}}>check</span>}
                  </div>
                  <div>
                    <p style={{fontWeight:600,fontSize:14,color:form.anonima?'var(--primary-dark)':'var(--text)'}}>Doação anônima</p>
                    <p style={{fontSize:11,color:'var(--muted)'}}>Nome não será registrado</p>
                  </div>
                </button>
              </div>

              {!form.anonima && (
                <div className="form-group">
                  <PersonSelect label="Doador" pessoas={pessoas} value={form.person_id} onChange={id=>setForm(f=>({...f,person_id:id}))} placeholder="Buscar pessoa (opcional)..."/>
                </div>
              )}

              <div className="form-group"><label className="form-label">Valor (R$) <span className="req">*</span></label>
                <input className="form-input" type="number" step="0.01" min="0.01" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} required placeholder="0,00"/>
              </div>

              <div className="form-group"><label className="form-label">Forma de pagamento</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                  {['pix','dinheiro','cartao'].map(forma=>(
                    <button key={forma} type="button" onClick={()=>setForm(f=>({...f,forma_pagamento:forma}))} style={{padding:'9px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600,border:`2px solid ${form.forma_pagamento===forma?'var(--primary)':'var(--border)'}`,background:form.forma_pagamento===forma?'var(--primary-light)':'white',color:form.forma_pagamento===forma?'var(--primary-dark)':'var(--text2)',textTransform:'capitalize'}}>
                      {forma}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group"><label className="form-label">Observação</label>
                <input className="form-input" value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Ex: Dízimo, oferta especial..."/>
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Registrando...':'Registrar doação'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
