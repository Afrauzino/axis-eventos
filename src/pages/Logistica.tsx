import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getInitials, isAdmin, formatName } from '../utils'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Pessoa   = { id:string; name:string; photo_url:string|null }
type ItemChk  = { id:string; texto:string; ordem:number }
type StatusChk= { id:string; encontrista_id:string; item_id:string; marcado:boolean }
type PessoaLog= { encontrista_id:string; toma_controlado:boolean; ultima_dose:string|null; concluido:boolean }

// Objetos padrão do checklist de iniciação
const OBJETOS_PADRAO = ['Colchão','Roupa de cama','Travesseiro','Remédios','Carteira','Celular','Relógio','Produtos alimentícios','Tablet','Notebook','Outros']

export default function Logistica({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [encontristas, setEncontristas] = useState<Pessoa[]>([])
  const [itens, setItens]     = useState<ItemChk[]>([])
  const [status, setStatus]   = useState<StatusChk[]>([])
  const [pessoas, setPessoas] = useState<PessoaLog[]>([])
  const [aba, setAba] = useState<'encontristas'|'config'>('encontristas')
  const [aberto, setAberto] = useState<Pessoa|null>(null)
  const [novoItem, setNovoItem] = useState('')
  const [busca, setBusca] = useState('')

  const canConfig = isAdmin(profile?.user_role)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const eid = evento.id
    const [enc, it, st, pl] = await Promise.all([
      supabase.from('people').select('id,name,photo_url').eq('event_id',eid).eq('role_type','encounterer').order('name'),
      supabase.from('logistica_checklist_itens').select('*').eq('event_id',eid).order('ordem'),
      supabase.from('logistica_checklist_status').select('*').eq('event_id',eid),
      supabase.from('logistica_pessoa').select('encontrista_id,toma_controlado,ultima_dose,concluido').eq('event_id',eid),
    ])
    setEncontristas(enc.data ?? [])
    setItens(it.data ?? [])
    setStatus(st.data ?? [])
    setPessoas(pl.data ?? [])
    setLoading(false)
  }

  // ---- Config do checklist ----
  async function addItem() {
    if (!novoItem.trim() || !evento) return
    const { data } = await supabase.from('logistica_checklist_itens').insert({ event_id:evento.id, texto:novoItem.trim(), ordem:itens.length }).select().single()
    if (data) { setItens(prev=>[...prev,data]); setNovoItem('') }
  }
  async function removerItem(id:string) {
    await supabase.from('logistica_checklist_itens').delete().eq('id',id)
    setItens(prev=>prev.filter(i=>i.id!==id))
  }
  async function criarPadrao() {
    if (!evento) return
    const base = itens.length
    const { data } = await supabase.from('logistica_checklist_itens')
      .insert(OBJETOS_PADRAO.map((texto,i)=>({ event_id:evento!.id, texto, ordem:base+i }))).select()
    if (data) setItens(prev=>[...prev,...data])
  }

  // ---- Marcação por encontrista ----
  function marcado(encId:string, itemId:string) {
    return status.find(s=>s.encontrista_id===encId && s.item_id===itemId)?.marcado ?? false
  }
  async function toggle(encId:string, itemId:string, atual:boolean) {
    const existe = status.find(s=>s.encontrista_id===encId && s.item_id===itemId)
    if (existe) {
      await supabase.from('logistica_checklist_status').update({ marcado:!atual }).eq('id',existe.id)
      setStatus(prev=>prev.map(s=>s.id===existe.id?{...s,marcado:!atual}:s))
    } else {
      const { data } = await supabase.from('logistica_checklist_status').insert({ event_id:evento!.id, encontrista_id:encId, item_id:itemId, marcado:true }).select().single()
      if (data) setStatus(prev=>[...prev,data])
    }
  }
  function info(encId:string): PessoaLog {
    return pessoas.find(p=>p.encontrista_id===encId) ?? { encontrista_id:encId, toma_controlado:false, ultima_dose:null, concluido:false }
  }
  async function salvarInfo(encId:string, patch: Partial<PessoaLog>) {
    const atual = info(encId)
    const novo = { ...atual, ...patch }
    setPessoas(prev => { const outros = prev.filter(p=>p.encontrista_id!==encId); return [...outros, novo] })
    await supabase.from('logistica_pessoa').upsert({
      event_id:evento!.id, encontrista_id:encId,
      toma_controlado:novo.toma_controlado, ultima_dose:novo.ultima_dose, concluido:novo.concluido,
    }, { onConflict:'event_id,encontrista_id' })
  }
  function progresso(encId:string) {
    if (itens.length===0) return 0
    const feitos = status.filter(s=>s.encontrista_id===encId && s.marcado).length
    return Math.round((feitos/itens.length)*100)
  }

  if (evLoading || loading) return <div className="page">{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:10,borderRadius:14}}/>)}</div>
  if (!evento) return <div className="page"><div className="empty"><p className="empty-title">Nenhum evento ativo</p></div></div>

  const filtrados = encontristas.filter(e => !busca || formatName(e.name).toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="page slide-up">
      <div className="tabs mb-4">
        <button className={`tab ${aba==='encontristas'?'active':''}`} onClick={()=>setAba('encontristas')}>Encontristas</button>
        {canConfig && <button className={`tab ${aba==='config'?'active':''}`} onClick={()=>setAba('config')}>Configurar</button>}
      </div>

      {/* ENCONTRISTAS */}
      {aba==='encontristas' && (
        <>
          {itens.length===0 && (
            <div className="alert-box alert-info mb-3" style={{fontSize:12}}>
              Nenhum item de checklist ainda.{canConfig?' Vá em Configurar para criar os itens padrão.':''}
            </div>
          )}
          <div className="search-bar mb-3">
            <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
            <input placeholder="Buscar encontrista..." value={busca} onChange={e=>setBusca(e.target.value)}/>
          </div>
          {filtrados.length===0 ? <div className="empty"><p className="empty-desc">Nenhum encontrista.</p></div> :
          filtrados.map(e=>{
            const pct = progresso(e.id); const inf = info(e.id)
            return (
              <button key={e.id} onClick={()=>setAberto(e)} style={{width:'100%',textAlign:'left',fontFamily:'inherit',background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,padding:'12px 14px',cursor:'pointer',border:'none'}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <Avatar p={e}/>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontWeight:700,fontSize:14}}>{formatName(e.name)}</p>
                    <div style={{display:'flex',gap:6,marginTop:3}}>
                      {inf.concluido && <span style={{fontSize:10,fontWeight:700,color:'white',background:'var(--success)',padding:'2px 8px',borderRadius:99}}>Concluído</span>}
                      {inf.toma_controlado && <span style={{fontSize:10,fontWeight:700,color:'#C53030',background:'#FFF5F5',padding:'2px 8px',borderRadius:99}}>💊 Contínuo</span>}
                    </div>
                  </div>
                  <span style={{fontSize:15,fontWeight:800,color:'var(--primary)'}}>{pct}%</span>
                </div>
              </button>
            )
          })}
        </>
      )}

      {/* CONFIGURAR */}
      {aba==='config' && canConfig && (
        <>
          <div className="section-label mb-2">Checklist de iniciação (objetos)</div>
          <p style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>Itens aplicados a todos os encontristas.</p>
          {itens.length===0 && (
            <button className="btn btn-primary btn-full mb-3" onClick={criarPadrao}>
              <span className="icon icon-sm">auto_awesome</span> Criar itens padrão
            </button>
          )}
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <input className="form-input" value={novoItem} onChange={e=>setNovoItem(e.target.value)} placeholder="Novo item" style={{flex:1}} onKeyDown={e=>e.key==='Enter'&&addItem()}/>
            <button className="btn btn-primary btn-sm" onClick={addItem}>Adicionar</button>
          </div>
          <div style={{background:'white',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow-sm)'}}>
            {itens.length===0 ? <p style={{padding:16,fontSize:13,color:'var(--muted)',textAlign:'center'}}>Nenhum item</p> :
            itens.map((it,idx)=>(
              <div key={it.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 14px',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:13}}><strong style={{color:'var(--muted)'}}>{idx+1}.</strong> {it.texto}</span>
                <button onClick={()=>removerItem(it.id)} style={{background:'none',border:'none',cursor:'pointer',padding:4}}><span className="icon" style={{fontSize:18,color:'var(--danger)'}}>delete</span></button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* MODAL DO ENCONTRISTA */}
      {aberto && (() => {
        const inf = info(aberto.id)
        return (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setAberto(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 16px'}}/>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
              <Avatar p={aberto} size={48}/>
              <p style={{fontWeight:800,fontSize:17,flex:1}}>{formatName(aberto.name)}</p>
            </div>

            {/* Checklist de objetos */}
            <div className="section-label mb-2">Objetos</div>
            <div style={{background:'white',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow-sm)',marginBottom:16}}>
              {itens.length===0 ? <p style={{padding:14,fontSize:12,color:'var(--muted)',textAlign:'center'}}>Nenhum item no checklist</p> :
              itens.map(it=>{
                const on = marcado(aberto.id, it.id)
                return (
                  <div key={it.id} onClick={()=>toggle(aberto.id,it.id,on)} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
                    <span className="icon" style={{fontSize:22,color:on?'var(--success)':'var(--muted-light)'}}>{on?'check_box':'check_box_outline_blank'}</span>
                    <span style={{fontSize:13,color:on?'var(--muted)':'var(--text)'}}>{it.texto}</span>
                  </div>
                )
              })}
            </div>

            {/* Medicamento controlado / contínuo */}
            <div className="section-label mb-2">Medicamento contínuo</div>
            <div style={{background:'var(--bg)',borderRadius:12,padding:'12px 14px',marginBottom:16}}>
              <p style={{fontSize:13,fontWeight:600,marginBottom:8}}>Toma remédio controlado (contínuo)?</p>
              <div style={{display:'flex',gap:8,marginBottom:inf.toma_controlado?12:0}}>
                {['Sim','Não'].map(l=>{
                  const val = l==='Sim'
                  const on = inf.toma_controlado===val
                  return (
                    <button key={l} onClick={()=>salvarInfo(aberto.id,{toma_controlado:val})} style={{flex:1,padding:'9px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700,border:on?'2px solid var(--primary)':'1px solid var(--border)',background:on?'var(--primary-light)':'white',color:on?'var(--primary)':'var(--text2)'}}>{l}</button>
                  )
                })}
              </div>
              {inf.toma_controlado && (
                <>
                  <label className="form-label" style={{marginTop:6}}>Última vez que tomou o remédio</label>
                  <input className="form-input" type="datetime-local"
                    value={inf.ultima_dose ? new Date(inf.ultima_dose).toISOString().slice(0,16) : ''}
                    onChange={e=>salvarInfo(aberto.id,{ultima_dose: e.target.value ? new Date(e.target.value).toISOString() : null})}/>
                  <button className="btn btn-ghost btn-full" style={{marginTop:10}} onClick={()=>{ setAberto(null); navigate('/saude/ficha') }}>
                    <span className="icon icon-sm">medical_services</span> Preencher ficha médica
                  </button>
                </>
              )}
            </div>

            {/* Concluir */}
            <button className={`btn btn-full ${inf.concluido?'btn-ghost':'btn-primary'}`} onClick={()=>salvarInfo(aberto.id,{concluido:!inf.concluido})}>
              {inf.concluido ? 'Reabrir iniciação' : 'Marcar iniciação como concluída'}
            </button>
            <button className="btn btn-ghost btn-full" style={{marginTop:8}} onClick={()=>setAberto(null)}>Fechar</button>
          </div>
        </div>
        )
      })()}
    </div>
  )
}

function Avatar({ p, size=40 }: { p:{name:string;photo_url:string|null}; size?:number }) {
  return p.photo_url
    ? <img src={p.photo_url} alt="" style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
    : <div style={{width:size,height:size,borderRadius:'50%',background:'var(--primary-light)',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:size*0.4,flexShrink:0}}>{getInitials(p.name)}</div>
}
