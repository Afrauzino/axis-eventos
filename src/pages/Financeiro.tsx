import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRegistrarChromeNav } from '../lib/chrome'
import { toast } from '../components/Toast'
import DataHora from '../components/DataHora'
import { getInitials, isAdmin, fmtData, fmtBRL } from '../utils'
import { useEvento } from '../hooks/useEvento'
import PersonSelect from '../components/PersonSelect'
import type { Profile } from '../App'

type Pagamento = { id:string; person_id:string; valor:number; status:string; forma_pagamento:string|null; data_pagamento:string|null; observacoes:string|null }
type Pessoa    = { id:string; name:string; role_type:string; photo_url:string|null }

// Situação financeira calculada automaticamente
function calcSituacao(pagamentos: Pagamento[], valorTotal: number): string {
  if (!pagamentos.length) return 'inscrito'
  const pago = pagamentos.filter(p=>p.status==='pago').reduce((s,p)=>s+p.valor,0)
  if (pago <= 0) return 'inscrito'
  if (pago >= valorTotal) return 'confirmado'
  return 'pendente'
}

const SIT_CFG: Record<string,{label:string;badge:string;cor:string}> = {
  inscrito:   {label:'Inscrito',   badge:'badge-neutral', cor:'var(--muted)'},
  pendente:   {label:'Pendente',   badge:'badge-warning', cor:'var(--warning)'},
  confirmado: {label:'Confirmado', badge:'badge-success', cor:'var(--success)'},
}

export default function Financeiro({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [pessoas, setPessoas]       = useState<Pessoa[]>([])
  const [loading, setLoading]       = useState(true)
  const [busca, setBusca]             = useState('')
  const [modal, setModal]             = useState(false)
  const [editando, setEditando]       = useState<Pagamento|null>(null)
  const [personaSel, setPersonaSel]   = useState<Pessoa|null>(null)
  const [salvando, setSalvando]       = useState(false)
  const [form, setForm] = useState({ person_id:'', valor:'', status:'pago', forma_pagamento:'pix', data_pagamento:'', observacoes:'' })

  const admin = profile && isAdmin(profile.user_role)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [pa, pe] = await Promise.all([
      supabase.from('financeiro').select('*').eq('event_id',evento.id).order('created_at',{ascending:false}),
      supabase.from('people').select('id,name,role_type,photo_url').eq('event_id',evento.id).order('name'),
    ])
    setPagamentos(pa.data??[])
    setPessoas(pe.data??[])
    setLoading(false)
  }

  function getPagsDaPessoa(pid:string) { return pagamentos.filter(p=>p.person_id===pid) }
  function getPago(pid:string) { return getPagsDaPessoa(pid).filter(p=>p.status==='pago').reduce((s,p)=>s+p.valor,0) }
  function getValorTotal(p:Pessoa) { return p.role_type==='encounterer' ? (evento?.valor_encontrista??0) : (evento?.valor_encontreiro??0) }
  function getSituacao(p:Pessoa) { return calcSituacao(getPagsDaPessoa(p.id), getValorTotal(p)) }
  function getPessoa(id:string) { return pessoas.find(p=>p.id===id) }

  async function salvar(e:React.FormEvent) {
    e.preventDefault(); setSalvando(true)
    if (!evento||!form.person_id||!form.valor) { setSalvando(false); return }
    const pessoa = getPessoa(form.person_id)
    const valorTotal = getValorTotal(pessoa!)
    const jaP = getPago(form.person_id)
    const novoValor = parseFloat(form.valor)
    if (!editando && jaP + novoValor > valorTotal && valorTotal > 0) {
      toast.aviso(`Valor acima do que falta pagar. Já pago: ${fmtBRL(jaP)} · Falta: ${fmtBRL(valorTotal-jaP)}`)
      setSalvando(false); return
    }
    const payload = { person_id:form.person_id, valor:novoValor, status:form.status, forma_pagamento:form.forma_pagamento||null, data_pagamento:form.data_pagamento?new Date(form.data_pagamento).toISOString():new Date().toISOString(), observacoes:form.observacoes||null, event_id:evento.id }
    if (editando) await supabase.from('financeiro').update(payload).eq('id',editando.id)
    else await supabase.from('financeiro').insert(payload)
    setModal(false); setSalvando(false); setEditando(null); setPersonaSel(null)
    setForm({person_id:'',valor:'',status:'pago',forma_pagamento:'pix',data_pagamento:'',observacoes:''}); carregar()
  }

  async function excluir(id:string) {
    if (!confirm('Excluir este pagamento?')) return
    await supabase.from('financeiro').delete().eq('id',id)
    carregar()
  }

  // Deduplica pessoas que aparecem na lista
  const pessoasUnicas = pessoas.filter(p => {
    if (busca && !p.name.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  useRegistrarChromeNav('financeiro', {
    busca: { value: busca, onChange: setBusca, placeholder: 'Buscar por nome...' },
  }, [busca])

  return (
    <div className="page">
      {/* Contadores de status - sem valores monetários */}
      {(() => {
        const inscritos   = pessoas.filter(p=>getSituacao(p)==='inscrito').length
        const pendentes   = pessoas.filter(p=>getSituacao(p)==='pendente').length
        const confirmados = pessoas.filter(p=>getSituacao(p)==='confirmado').length
        return (
          <div className="stats-grid mb-3" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
            <div className="stat-card" style={{cursor:'pointer'}} onClick={()=>setBusca('')}>
              <div className="stat-label">Inscritos</div>
              <div className="stat-value" style={{color:'var(--muted)',fontSize:22}}>{inscritos}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pendentes</div>
              <div className="stat-value" style={{color:'var(--warning)',fontSize:22}}>{pendentes}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Confirmados</div>
              <div className="stat-value" style={{color:'var(--success)',fontSize:22}}>{confirmados}</div>
            </div>
          </div>
        )
      })()}



      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:72,marginBottom:8,borderRadius:14}}/>) :
      pessoasUnicas.map(p => {
        const sit      = getSituacao(p)
        const cfg      = SIT_CFG[sit]
        const pago     = getPago(p.id)
        const total    = getValorTotal(p)
        const pct      = total>0 ? Math.min((pago/total)*100,100) : 0
        return (
          <button key={p.id} className="list-card" onClick={()=>{ setForm(f=>({...f,person_id:p.id,valor:String(Math.max(0,total-pago))})); setPersonaSel(p); setEditando(null); setModal(true) }}>
            <div className="list-card-bar" style={{background:cfg.cor}}/>
            <div className="list-card-media">
              {p.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:16,fontWeight:700,color:'var(--primary)'}}>{getInitials(p.name)}</span>}
            </div>
            <div className="list-card-body">
              <div className="list-card-title">{p.name}</div>
              <div style={{display:'flex',alignItems:'center',gap:6,marginTop:3}}>
                {total>0 && (
                  <div style={{flex:1,height:4,background:'var(--border)',borderRadius:99,overflow:'hidden'}}>
                    <div style={{height:'100%',background:cfg.cor,width:`${pct}%`,borderRadius:99,transition:'width 0.4s'}}/>
                  </div>
                )}
                <span style={{fontSize:11,color:'var(--muted)',flexShrink:0}}>{fmtBRL(pago)}{total>0?` / ${fmtBRL(total)}`:''}</span>
              </div>
            </div>
            <span className={`badge ${cfg.badge}`} style={{flexShrink:0,marginRight:4,fontSize:10}}>{cfg.label}</span>
            <div className="list-card-chevron"><span className="icon icon-sm">chevron_right</span></div>
          </button>
        )
      })}

      <button className="fab" onClick={()=>{setEditando(null);setPersonaSel(null);setForm({person_id:'',valor:'',status:'pago',forma_pagamento:'pix',data_pagamento:'',observacoes:''});setModal(true)}}><span className="icon">add</span></button>

      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>Registrar pagamento</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>

            {personaSel && (
              <div style={{background:'var(--primary-light)',borderRadius:10,padding:'10px 14px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                  {personaSel.photo_url?<img src={personaSel.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:13,fontWeight:700,color:'white'}}>{getInitials(personaSel.name)}</span>}
                </div>
                <div>
                  <p style={{fontWeight:700,fontSize:14}}>{personaSel.name}</p>
                  <p style={{fontSize:12,color:'var(--primary-dark)'}}>Pago: {fmtBRL(getPago(personaSel.id))} · Total: {fmtBRL(getValorTotal(personaSel))}</p>
                </div>
              </div>
            )}

            <form onSubmit={salvar}>
              {!personaSel && (
                <div className="form-group">
                  <PersonSelect label="Pessoa" required pessoas={pessoas} value={form.person_id} onChange={id=>{setForm(f=>({...f,person_id:id}));setPersonaSel(getPessoa(id)??null)}} placeholder="Buscar pessoa..."/>
                </div>
              )}
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Valor (R$) <span className="req">*</span></label>
                  <input className="form-input" type="number" step="0.01" min="0" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} required/>
                </div>
                <div className="form-group"><label className="form-label">Data</label>
                  <DataHora modo="date" value={form.data_pagamento} onChange={v=>setForm(f=>({...f,data_pagamento:v}))}/>
                </div>
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
              <div className="form-group"><label className="form-label">Observações</label>
                <input className="form-input" value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))}/>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Salvando...':'Registrar pagamento'}
              </button>
            </form>

            {/* Histórico de pagamentos da pessoa */}
            {form.person_id && getPagsDaPessoa(form.person_id).length>0 && (
              <div style={{marginTop:16}}>
                <p style={{fontSize:13,fontWeight:700,marginBottom:8}}>Histórico</p>
                {getPagsDaPessoa(form.person_id).map(pg=>(
                  <div key={pg.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'var(--bg)',borderRadius:8,marginBottom:6}}>
                    <div>
                      <p style={{fontSize:13,fontWeight:600}}>{fmtBRL(pg.valor)} · {pg.forma_pagamento??'—'}</p>
                      {pg.data_pagamento && <p style={{fontSize:11,color:'var(--muted)'}}>{fmtData(pg.data_pagamento)}</p>}
                    </div>
                    <button onClick={()=>excluir(pg.id)} style={{background:'var(--danger-bg)',color:'var(--danger)',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'inherit'}}>
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
