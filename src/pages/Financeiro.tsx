import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { useRegistrarChromeNav } from '../lib/chrome'
import { toast } from '../components/Toast'
import DataHora from '../components/DataHora'
import { getInitials, isAdmin, fmtData, fmtBRL } from '../utils'
import { useEvento } from '../hooks/useEvento'
import PersonSelect from '../components/PersonSelect'
import { notificarRegra } from '../lib/notifRegras'
import type { Profile } from '../App'

type Pagamento = { id:string; person_id:string; valor:number; status:string; forma_pagamento:string|null; data_pagamento:string|null; observacoes:string|null; created_by:string|null }
type Pessoa    = { id:string; name:string; role_type:string; photo_url:string|null; cidade:string|null }

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
  const [recebedores, setRecebedores] = useState<Record<string,string>>({})  // user_id -> nome de quem registrou
  const [loading, setLoading]       = useState(true)
  const [busca, setBusca]             = useState('')
  const [fSit, setFSit]               = useState('todos')
  const [fCidade, setFCidade]         = useState('todas')
  const [modalFiltros, setModalFiltros] = useState(false)
  const [modal, setModal]             = useState(false)
  useVoltarFecha(modal, () => setModal(false))
  useVoltarFecha(modalFiltros, () => setModalFiltros(false))
  const [editando, setEditando]       = useState<Pagamento|null>(null)
  const [personaSel, setPersonaSel]   = useState<Pessoa|null>(null)
  const [salvando, setSalvando]       = useState(false)
  const [form, setForm] = useState({ person_id:'', valor:'', status:'pago', forma_pagamento:'pix', data_pagamento:'', observacoes:'' })

  const admin = profile && isAdmin(profile.user_role)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar(silencioso = false) {
    if (!evento) return
    if (!silencioso) setLoading(true)   // silencioso = recarrega sem trocar a lista por esqueletos (mantém o scroll)
    const [pa, pe] = await Promise.all([
      supabase.from('financeiro').select('*').eq('event_id',evento.id).order('created_at',{ascending:false}),
      supabase.from('people').select('id,name,role_type,photo_url,cidade').eq('event_id',evento.id).eq('desistente',false).order('name'),  // desistentes não têm pagamentos a fazer
    ])
    setPagamentos(pa.data??[])
    setPessoas(pe.data??[])
    // Nomes de quem REGISTROU cada pagamento (created_by -> nome), pra mostrar "quem recebeu"
    const uids = Array.from(new Set((pa.data??[]).map((x:any)=>x.created_by).filter(Boolean)))
    if (uids.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id,name').in('user_id', uids as string[])
      const m: Record<string,string> = {}
      ;(profs??[]).forEach((r:any)=>{ if (r.name) m[r.user_id] = r.name })
      setRecebedores(m)
    }
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
    else {
      await supabase.from('financeiro').insert({ ...payload, created_by: profile?.user_id ?? null })  // quem recebeu
      // Recibo pra pessoa (só pagamento confirmado)
      if (form.status === 'pago') notificarRegra('fin_pago', { person_ids: [form.person_id], title: 'Pagamento registrado', body: `Recebemos ${fmtBRL(novoValor)}. Obrigado!`, url: '/' })
    }
    setModal(false); setSalvando(false); setEditando(null); setPersonaSel(null)
    setForm({person_id:'',valor:'',status:'pago',forma_pagamento:'pix',data_pagamento:'',observacoes:''}); carregar(true)
  }

  async function excluir(id:string) {
    if (!confirm('Excluir este pagamento?')) return
    await supabase.from('financeiro').delete().eq('id',id)
    carregar(true)
  }

  // Cidades distintas (pra montar o filtro), ordenadas
  const cidades = Array.from(new Set(pessoas.map(p => (p.cidade ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  const nFiltros = (fSit !== 'todos' ? 1 : 0) + (fCidade !== 'todas' ? 1 : 0)

  // Deduplica pessoas que aparecem na lista + aplica busca e filtros (situação + cidade)
  const pessoasUnicas = pessoas.filter(p => {
    if (busca && !p.name.toLowerCase().includes(busca.toLowerCase())) return false
    if (fSit !== 'todos' && getSituacao(p) !== fSit) return false
    if (fCidade !== 'todas' && (p.cidade ?? '').trim() !== fCidade) return false
    return true
  })

  // Busca e filtro agora ficam NA PÁGINA (abaixo). A engrenagem mantém só a
  // navegação ("Ir para" outras telas).
  useRegistrarChromeNav('financeiro')

  return (
    <div className="page">
      {/* Busca + botão de filtro (abre modal, igual Encontristas) */}
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <div className="search-bar" style={{flex:1,marginBottom:0}}>
          <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
          <input placeholder="Buscar por nome..." value={busca} onChange={e=>setBusca(e.target.value)}/>
          {busca && <button onClick={()=>setBusca('')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-light)',padding:0,fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>}
        </div>
        <button onClick={()=>setModalFiltros(true)} aria-label="Filtros"
          style={{position:'relative',flexShrink:0,width:44,height:44,borderRadius:12,border:`1px solid ${nFiltros>0?'var(--primary)':'var(--border)'}`,background:nFiltros>0?'var(--primary-light)':'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>
          <span className="icon" style={{color:nFiltros>0?'var(--primary)':'var(--text2)'}}>tune</span>
          {nFiltros>0 && <span style={{position:'absolute',top:-5,right:-5,minWidth:18,height:18,background:'var(--primary)',borderRadius:99,fontSize:10,fontWeight:800,color:'white',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px'}}>{nFiltros}</span>}
        </button>
      </div>

      {/* Chips dos filtros ativos */}
      {nFiltros>0 && (
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
          {fSit!=='todos' && (
            <span style={{display:'inline-flex',alignItems:'center',gap:4,background:'var(--primary-light)',color:'var(--primary-dark)',borderRadius:99,padding:'4px 6px 4px 12px',fontSize:12,fontWeight:700}}>
              {SIT_CFG[fSit]?.label ?? fSit}
              <button onClick={()=>setFSit('todos')} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',display:'flex',padding:0}}><span className="icon" style={{fontSize:15}}>close</span></button>
            </span>
          )}
          {fCidade!=='todas' && (
            <span style={{display:'inline-flex',alignItems:'center',gap:4,background:'var(--primary-light)',color:'var(--primary-dark)',borderRadius:99,padding:'4px 6px 4px 12px',fontSize:12,fontWeight:700,maxWidth:'100%'}}>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:160}}>{fCidade}</span>
              <button onClick={()=>setFCidade('todas')} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',display:'flex',padding:0}}><span className="icon" style={{fontSize:15}}>close</span></button>
            </span>
          )}
        </div>
      )}

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

      {/* Modal de filtros (situação) */}
      {modalFiltros && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModalFiltros(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 28px',maxWidth:480,width:'100%',margin:'0 auto',maxHeight:'85vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 14px'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
              <span style={{fontSize:17,fontWeight:800}}>Filtros</span>
              {nFiltros>0 && <button onClick={()=>{setFSit('todos');setFCidade('todas')}} style={{background:'none',border:'none',color:'var(--primary)',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Limpar tudo</button>}
            </div>
            <p style={{fontSize:12,color:'var(--muted)',fontWeight:700,marginBottom:8}}>Situação</p>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
              {([['todos','Todos'],['inscrito','Inscrito'],['pendente','Pendente'],['confirmado','Confirmado']] as const).map(([v,l])=>{
                const sel = fSit===v
                return <button key={v} onClick={()=>setFSit(v)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',textAlign:'left',border:sel?'2px solid var(--primary)':'1px solid var(--border)',background:sel?'var(--primary-light)':'white'}}>
                  <span style={{flex:1,fontSize:14,fontWeight:sel?800:600,color:sel?'var(--primary-dark)':'var(--text)'}}>{l}</span>
                  {sel && <span className="icon icon-sm" style={{color:'var(--primary)'}}>check</span>}
                </button>
              })}
            </div>

            {cidades.length > 0 && (<>
              <p style={{fontSize:12,color:'var(--muted)',fontWeight:700,marginBottom:8}}>Cidade</p>
              <select value={fCidade} onChange={e=>setFCidade(e.target.value)}
                style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'1px solid var(--border)',fontFamily:'inherit',fontSize:14,background:'white',color:'var(--text)',marginBottom:20}}>
                <option value="todas">Todas as cidades</option>
                {cidades.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </>)}

            <button className="btn btn-primary btn-full" onClick={()=>setModalFiltros(false)}>Ver resultados</button>
          </div>
        </div>
      )}

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
                      {pg.created_by && recebedores[pg.created_by] && (
                        <p style={{fontSize:11,color:'var(--muted)',display:'flex',alignItems:'center',gap:3}}>
                          <span className="icon" style={{fontSize:13}}>person</span> Recebido por {recebedores[pg.created_by]}
                        </p>
                      )}
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
