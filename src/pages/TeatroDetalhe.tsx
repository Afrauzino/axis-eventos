import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ArquivosModulo from '../components/ArquivosModulo'
import { getInitials, isAdmin } from '../utils'
import PersonSelect from '../components/PersonSelect'
import type { Profile } from '../App'

type Teatro     = { id:string; nome:string; descricao:string|null; data_hora:string|null; local:string|null; status:string; cor:string|null }
type Cena       = { id:string; ordem:number; titulo:string|null; deixa:string|null; acao:string|null; fala:string|null; trilha_sonora:string|null; personagem_id:string|null; person_id:string|null; objeto_id:string|null }
type ElencoItem = { id:string; person_id:string; personagem_id:string|null; observacoes:string|null }
type Pessoa     = { id:string; name:string; photo_url:string|null }
type Personagem = { id:string; nome:string; icone:string|null; multiplo:boolean }
type Objeto     = { id:string; nome:string; icone:string|null }
type Ministracao = { id:string; titulo:string; ministrante_id:string|null; tema:string|null }

// Elenco de uma cena: múltiplos atores por personagem, múltiplos objetos
type CenaPersonagem = { personagem_id:string; person_ids:string[] }
type CenaObjeto     = { objeto_id:string }

function MatIcon({ name, size=20, color='var(--text2)' }: {name:string;size?:number;color?:string}) {
  return <span style={{fontFamily:"'Material Symbols Outlined'",fontWeight:'normal',fontStyle:'normal',fontSize:size,lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',direction:'ltr',WebkitFontSmoothing:'antialiased',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",color,userSelect:'none'}}>{name}</span>
}

export default function TeatroDetalhe({ profile }: { profile?: Profile }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [teatro, setTeatro]     = useState<Teatro|null>(null)
  const [eventId, setEventId]   = useState<string|null>(null)
  const [cenas, setCenas]       = useState<Cena[]>([])
  const [elenco, setElenco]     = useState<ElencoItem[]>([])
  const [pessoas, setPessoas]   = useState<Pessoa[]>([])
  const [personagens, setPersonagens] = useState<Personagem[]>([])
  const [objetos, setObjetos]   = useState<Objeto[]>([])
  const [ministracao, setMinistracao] = useState<Ministracao|null>(null)
  const [ministrante, setMinistrante] = useState<Pessoa|null>(null)
  const [aba, setAba]           = useState<'cenas'|'elenco'|'arquivos'>('cenas')
  const [loading, setLoading]   = useState(true)
  const [modalCena, setModalCena] = useState(false)
  const [editandoCena, setEditandoCena] = useState<Cena|null>(null)
  const [salvandoCena, setSalvandoCena] = useState(false)

  // Cena form state
  const [formCena, setFormCena] = useState({ titulo:'', deixa:'', acao:'', fala:'', trilha_sonora:'' })
  // Personagens da cena: lista de {personagem_id, person_ids[]}
  const [cenaPersonagens, setCenaPersonagens] = useState<CenaPersonagem[]>([])
  // Objetos da cena: lista de objeto_ids
  const [cenaObjetos, setCenaObjetos] = useState<string[]>([])

  const canEdit = profile && isAdmin(profile.user_role)

  useEffect(() => { if (id) carregar() }, [id])

  async function carregar() {
    setLoading(true)
    const [te, ce, el, pg, ob] = await Promise.all([
      supabase.from('theaters').select('*').eq('id', id).single(),
      supabase.from('teatro_cenas').select('*').eq('theater_id', id).order('ordem'),
      supabase.from('teatro_elenco').select('*').eq('theater_id', id),
      supabase.from('personagens_globais').select('id,nome,icone,multiplo').order('nome'),
      supabase.from('objetos_globais').select('id,nome,icone').order('nome'),
    ])
    setTeatro(te.data)
    setCenas(ce.data ?? [])
    setElenco(el.data ?? [])
    setPersonagens(pg.data ?? [])
    setObjetos(ob.data ?? [])

    if (te.data) {
      const { data: ev } = await supabase.from('theaters').select('event_id').eq('id', id).single()
      if (ev?.event_id) setEventId(ev.event_id)
      if (ev) {
        const { data: pe } = await supabase.from('people').select('id,name,photo_url').eq('event_id', ev.event_id).order('name')
        setPessoas(pe ?? [])
      }
    }
    // Load linked ministração if exists
    if (te.data?.ministracao_id) {
      const { data: minData } = await supabase.from('ministrações').select('id,titulo,ministrante_id,tema').eq('id', te.data.ministracao_id).single()
      if (minData) {
        setMinistracao(minData)
        if (minData.ministrante_id) {
          const { data: minPessoa } = await supabase.from('people').select('id,name,photo_url').eq('id', minData.ministrante_id).single()
          if (minPessoa) setMinistrante(minPessoa)
        }
      }
    }
    setLoading(false)
  }

  function abrirNovaCena() {
    setEditandoCena(null)
    setFormCena({ titulo:'', deixa:'', acao:'', fala:'', trilha_sonora:'' })
    setCenaPersonagens([])
    setCenaObjetos([])
    setModalCena(true)
  }

  function abrirEdicaoCena(c: Cena) {
    setEditandoCena(c)
    setFormCena({ titulo:c.titulo??'', deixa:c.deixa??'', acao:c.acao??'', fala:c.fala??'', trilha_sonora:c.trilha_sonora??'' })
    // Load existing personagens/objetos from elenco for this cena
    setCenaPersonagens(c.personagem_id ? [{ personagem_id:c.personagem_id, person_ids: c.person_id ? [c.person_id] : [] }] : [])
    setCenaObjetos(c.objeto_id ? [c.objeto_id] : [])
    setModalCena(true)
  }

  async function salvarCena(e: React.FormEvent) {
    e.preventDefault(); setSalvandoCena(true)
    const ordemNova = editandoCena?.ordem ?? (cenas.length > 0 ? Math.max(...cenas.map(c=>c.ordem))+1 : 1)
    
    // Save main cena with first personagem/objeto for backward compat
    const primPG  = cenaPersonagens[0]
    const primObj = cenaObjetos[0]
    const payload = {
      theater_id:id, ordem:ordemNova,
      titulo: formCena.titulo||null,
      deixa: formCena.deixa||null,
      acao: formCena.acao||null,
      fala: formCena.fala||null,
      trilha_sonora: formCena.trilha_sonora||null,
      personagem_id: primPG?.personagem_id||null,
      person_id: primPG?.person_ids[0]||null,
      objeto_id: primObj||null,
    }

    let cenaId: string
    if (editandoCena) {
      await supabase.from('teatro_cenas').update(payload).eq('id', editandoCena.id)
      cenaId = editandoCena.id
    } else {
      const { data } = await supabase.from('teatro_cenas').insert(payload).select().single()
      cenaId = data?.id
    }

    // Sync elenco: remove old, add all new
    if (cenaId) {
      // Collect all person-personagem pairs from this cena
      for (const cp of cenaPersonagens) {
        for (const pid of cp.person_ids) {
          const jaNoElenco = elenco.some(e=>e.person_id===pid && e.personagem_id===cp.personagem_id)
          if (!jaNoElenco) {
            await supabase.from('teatro_elenco').insert({ theater_id:id, person_id:pid, personagem_id:cp.personagem_id })
          }
        }
      }
    }

    setModalCena(false); setSalvandoCena(false); setEditandoCena(null); carregar()
  }

  async function excluirCena(cenaId: string) {
    if (!confirm('Excluir esta cena?')) return
    await supabase.from('teatro_cenas').delete().eq('id', cenaId)
    carregar()
  }

  async function moverCena(cenaId: string, dir: 'up'|'down') {
    const idx   = cenas.findIndex(c=>c.id===cenaId)
    const outro = dir==='up' ? cenas[idx-1] : cenas[idx+1]
    if (!outro) return
    const atual = cenas[idx]
    await Promise.all([
      supabase.from('teatro_cenas').update({ordem:outro.ordem}).eq('id',atual.id),
      supabase.from('teatro_cenas').update({ordem:atual.ordem}).eq('id',outro.id),
    ])
    carregar()
  }

  async function removerDoElenco(id: string) {
    if (!confirm('Remover do elenco?')) return
    await supabase.from('teatro_elenco').delete().eq('id', id)
    carregar()
  }

  // --- Helpers para cenaPersonagens ---
  function addPersonagem() {
    setCenaPersonagens(prev => [...prev, { personagem_id:'', person_ids:[] }])
  }
  function removePersonagem(idx: number) {
    setCenaPersonagens(prev => prev.filter((_,i)=>i!==idx))
  }
  function setPersonagemId(idx: number, pgId: string) {
    setCenaPersonagens(prev => prev.map((cp,i)=>i===idx?{...cp,personagem_id:pgId,person_ids:[]}:cp))
  }
  function addAtor(idx: number, personId: string) {
    setCenaPersonagens(prev => prev.map((cp,i)=>i===idx?{...cp,person_ids:[...cp.person_ids,personId]}:cp))
  }
  function removeAtor(idx: number, personId: string) {
    setCenaPersonagens(prev => prev.map((cp,i)=>i===idx?{...cp,person_ids:cp.person_ids.filter(p=>p!==personId)}:cp))
  }
  function addObjeto(objetoId: string) {
    if (!cenaObjetos.includes(objetoId)) setCenaObjetos(prev=>[...prev,objetoId])
  }
  function removeObjeto(objetoId: string) {
    setCenaObjetos(prev=>prev.filter(o=>o!==objetoId))
  }

  function getPessoa(pid:string|null) { return pid ? pessoas.find(p=>p.id===pid) : null }
  function getPersonagem(pgid:string|null) { return pgid ? personagens.find(p=>p.id===pgid) : null }
  function getObjeto(oid:string|null) { return oid ? objetos.find(o=>o.id===oid) : null }

  // Group elenco by personagem
  const elencoAgrupado = (() => {
    const grupos: Record<string,{pg:Personagem|null;atores:Pessoa[]}> = {}
    for (const e of elenco) {
      const key = e.personagem_id ?? 'sem'
      if (!grupos[key]) grupos[key] = { pg: getPersonagem(e.personagem_id), atores:[] }
      const p = getPessoa(e.person_id)
      if (p) grupos[key].atores.push(p)
    }
    return Object.values(grupos)
  })()

  if (loading) return <div className="page"><div className="skeleton" style={{height:120,borderRadius:14}}/></div>
  if (!teatro) return <div className="page"><div className="alert-box alert-error">Teatro não encontrado.</div></div>

  const cor = teatro.cor ?? 'var(--accent)'

  return (
    <div className="page">
      {/* Header */}
      <div style={{background:cor,borderRadius:14,padding:'16px 20px',marginBottom:16,color:'white'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:teatro.descricao?8:0}}>
          <MatIcon name="theater_comedy" size={32} color="white"/>
          <div>
            <p style={{fontSize:18,fontWeight:800}}>{teatro.nome}</p>
            {teatro.local && <p style={{fontSize:13,opacity:0.85}}>{teatro.local}</p>}
          </div>
        </div>
        {teatro.descricao && <p style={{fontSize:13,opacity:0.85,lineHeight:1.6}}>{teatro.descricao}</p>}
      </div>

      {/* Ministração vinculada - clicável */}
      {ministracao && (
        <button onClick={()=>navigate('/ministracoes/'+ministracao.id)} style={{width:'100%',background:'#F3F0FF',border:'1px solid #D6BCFA',borderRadius:12,padding:'12px 14px',marginBottom:14,cursor:'pointer',fontFamily:'inherit',textAlign:'left',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <p style={{fontSize:10,fontWeight:700,color:'#6B46C1',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Ministração vinculada</p>
            <p style={{fontWeight:700,fontSize:14,color:'#44337A'}}>{ministracao.titulo}</p>
            {ministrante && <p style={{fontSize:12,color:'#6B46C1',marginTop:2}}>Ministrante: {ministrante.name}</p>}
          </div>
          <MatIcon name="chevron_right" size={18} color="#6B46C1"/>
        </button>
      )}

      {/* Barra de progresso do teatro — cenas com elenco/personagem definido */}
      {cenas.length > 0 && (() => {
        const cenasProntas = cenas.filter(c => c.personagem_id || c.person_id).length
        const pct = Math.round((cenasProntas / cenas.length) * 100)
        return (
          <div style={{background:'white',borderRadius:14,padding:'14px 16px',marginBottom:14,boxShadow:'var(--shadow-sm)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <p style={{fontSize:13,fontWeight:700}}>Montagem do teatro</p>
              <p style={{fontSize:14,fontWeight:800,color:pct===100?'var(--success)':(cor||'var(--primary)')}}>{pct}%</p>
            </div>
            <div style={{height:10,background:'var(--bg)',borderRadius:99,overflow:'hidden',marginBottom:6}}>
              <div style={{height:'100%',width:`${pct}%`,background:pct===100?'var(--success)':(cor||'var(--primary)'),borderRadius:99,transition:'width 0.5s ease'}}/>
            </div>
            <p style={{fontSize:11,color:'var(--muted)'}}>{cenasProntas} de {cenas.length} cenas com elenco definido</p>
          </div>
        )
      })()}

      <div className="tabs mb-4">
        <button className={`tab ${aba==='cenas'?'active':''}`} onClick={()=>setAba('cenas')}>Cenas ({cenas.length})</button>
        <button className={`tab ${aba==='elenco'?'active':''}`} onClick={()=>setAba('elenco')}>Elenco ({elenco.length})</button>
        <button className={`tab ${aba==='arquivos'?'active':''}`} onClick={()=>setAba('arquivos')}>Arquivos</button>
      </div>

      {/* CENAS */}
      {aba==='cenas' && (
        <>
          {cenas.length===0 ? (
            <div className="empty">
              <div className="empty-icon"><MatIcon name="format_list_numbered" size={28} color="var(--muted-light)"/></div>
              <p className="empty-title">Nenhuma cena</p>
              <p className="empty-desc">Adicione as cenas desta peça de teatro.</p>
            </div>
          ) : cenas.map((c,i) => {
            const pg   = getPersonagem(c.personagem_id)
            const pe   = getPessoa(c.person_id)
            const obj  = getObjeto(c.objeto_id)
            return (
              <div key={c.id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,overflow:'hidden'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderBottom:(c.deixa||c.acao||c.fala||pg||obj)?'1px solid var(--border)':'none'}}>
                  <div style={{width:32,height:32,borderRadius:8,background:cor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'white',flexShrink:0}}>{c.ordem}</div>
                  <p style={{fontWeight:700,fontSize:14,flex:1}}>{c.titulo ?? `Cena ${c.ordem}`}</p>
                  {canEdit && (
                    <div style={{display:'flex',gap:4}}>
                      {i>0 && <button onClick={()=>moverCena(c.id,'up')} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="arrow_upward" size={14}/></button>}
                      {i<cenas.length-1 && <button onClick={()=>moverCena(c.id,'down')} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="arrow_downward" size={14}/></button>}
                      <button onClick={()=>abrirEdicaoCena(c)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="edit" size={14}/></button>
                      <button onClick={()=>excluirCena(c.id)} style={{background:'var(--danger-bg)',border:'none',borderRadius:6,width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="delete" size={14} color="var(--danger)"/></button>
                    </div>
                  )}
                </div>
                {(c.deixa||c.acao||c.fala||c.trilha_sonora||pg||obj) && (
                  <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',gap:8}}>
                    {c.deixa && (
                      <div style={{background:'#FFF3E0',borderRadius:8,padding:'8px 12px',borderLeft:'3px solid '+cor}}>
                        <p style={{fontSize:10,fontWeight:700,color:cor,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Deixa</p>
                        <p style={{fontSize:13,lineHeight:1.5}}>{c.deixa}</p>
                      </div>
                    )}
                    {c.acao && <div style={{display:'flex',gap:8}}><span style={{fontSize:11,fontWeight:700,color:'var(--muted)',minWidth:40}}>AÇÃO</span><p style={{fontSize:13,color:'var(--text2)',lineHeight:1.5,flex:1}}>{c.acao}</p></div>}
                    {c.fala && <div style={{display:'flex',gap:8}}><span style={{fontSize:11,fontWeight:700,color:'#6B46C1',minWidth:40}}>FALA</span><p style={{fontSize:13,lineHeight:1.5,flex:1,fontStyle:'italic'}}>"{c.fala}"</p></div>}
                    {pg && <div style={{display:'flex',alignItems:'center',gap:6}}><MatIcon name="person" size={14} color="#6B46C1"/><p style={{fontSize:12,color:'#6B46C1',fontWeight:600}}>{pg.nome}</p>{pe&&<p style={{fontSize:12,color:'var(--muted)'}}>— {pe.name}</p>}</div>}
                    {obj && <div style={{display:'flex',alignItems:'center',gap:6}}><MatIcon name="inventory_2" size={14} color="var(--muted)"/><p style={{fontSize:12,color:'var(--muted)'}}>{obj.nome}</p></div>}
                    {c.trilha_sonora && <div style={{display:'flex',alignItems:'center',gap:6}}><MatIcon name="music_note" size={14} color={cor}/><p style={{fontSize:12,color:'var(--muted)'}}>{c.trilha_sonora}</p></div>}
                  </div>
                )}
              </div>
            )
          })}
          {canEdit && <button className="fab" onClick={abrirNovaCena}><span className="icon">add</span></button>}
        </>
      )}

      {/* ELENCO */}
      {aba==='elenco' && (
        <>
          {elencoAgrupado.length===0 ? (
            <div className="empty">
              <div className="empty-icon"><MatIcon name="group" size={28} color="var(--muted-light)"/></div>
              <p className="empty-title">Nenhum ator</p>
              <p className="empty-desc">Vincule pessoas ao criar ou editar cenas.</p>
            </div>
          ) : elencoAgrupado.map((grupo,gi) => (
            <div key={gi} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,overflow:'hidden'}}>
              {grupo.pg && (
                <div style={{background:cor+'22',padding:'8px 14px',borderBottom:'1px solid var(--border)'}}>
                  <p style={{fontWeight:700,fontSize:13,color:cor}}>{grupo.pg.nome}</p>
                </div>
              )}
              {grupo.atores.map(a=>(
                <div key={a.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderBottom:'1px solid var(--border)'}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                    {a.photo_url?<img src={a.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:13,fontWeight:700,color:'white'}}>{getInitials(a.name)}</span>}
                  </div>
                  <p style={{flex:1,fontWeight:600,fontSize:14}}>{a.name}</p>
                  {canEdit && (
                    <button onClick={()=>{ const el=elenco.find(e=>e.person_id===a.id); if(el) removerDoElenco(el.id) }} style={{background:'var(--danger-bg)',color:'var(--danger)',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'inherit'}}>
                      Remover
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* ARQUIVOS */}
      {aba==='arquivos' && eventId && id && (
        <ArquivosModulo eventId={eventId} modulo="teatro" referenciaId={id} pessoaId={null} titulo="Arquivos do teatro" />
      )}

      {/* MODAL CENA */}
      {modalCena && canEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModalCena(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'95vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editandoCena?`Editar Cena ${editandoCena.ordem}`:'Nova cena'}</span>
              <button onClick={()=>setModalCena(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <form onSubmit={salvarCena}>
              <div className="form-group"><label className="form-label">Título da cena</label>
                <input className="form-input" placeholder="Ex: A volta do filho pródigo" value={formCena.titulo} onChange={e=>setFormCena(f=>({...f,titulo:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Deixa</label>
                <p className="form-hint mb-2">Sinal que indica o início da cena.</p>
                <input className="form-input" placeholder="Ex: Quando o narrador disser X, entra..." value={formCena.deixa} onChange={e=>setFormCena(f=>({...f,deixa:e.target.value}))}/>
              </div>
              <div className="form-group"><label className="form-label">Ação / Descrição</label>
                <textarea className="form-textarea" value={formCena.acao} onChange={e=>setFormCena(f=>({...f,acao:e.target.value}))} style={{minHeight:70}}/>
              </div>
              <div className="form-group"><label className="form-label">Fala / Diálogo</label>
                <textarea className="form-textarea" value={formCena.fala} onChange={e=>setFormCena(f=>({...f,fala:e.target.value}))} placeholder='"Pai, peguei minha parte da herança..."' style={{minHeight:70}}/>
              </div>
              <div className="form-group"><label className="form-label">Trilha sonora / Som</label>
                <input className="form-input" value={formCena.trilha_sonora} onChange={e=>setFormCena(f=>({...f,trilha_sonora:e.target.value}))} placeholder="Ex: Música ambiente..."/>
              </div>

              {/* PERSONAGENS - ilimitados */}
              <div style={{height:1,background:'var(--border)',margin:'4px 0 16px'}}/>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <p style={{fontSize:13,fontWeight:700}}>Personagens desta cena</p>
                <button type="button" onClick={addPersonagem} style={{background:'var(--primary-light)',color:'var(--primary)',border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
                  <span className="icon icon-sm">add</span> Personagem
                </button>
              </div>

              {cenaPersonagens.map((cp,idx) => {
                const pg = personagens.find(p=>p.id===cp.personagem_id)
                return (
                  <div key={idx} style={{background:'var(--bg)',borderRadius:12,padding:'12px 14px',marginBottom:10,border:'1px solid var(--border)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                      <div style={{flex:1}}>
                        <label className="form-label" style={{marginBottom:4}}>Personagem</label>
                        <select className="form-select" value={cp.personagem_id} onChange={e=>setPersonagemId(idx,e.target.value)}>
                          <option value="">Selecionar personagem</option>
                          {personagens.map(p=><option key={p.id} value={p.id}>{p.nome}{p.multiplo?' (múltiplo)':''}</option>)}
                        </select>
                      </div>
                      <button type="button" onClick={()=>removePersonagem(idx)} style={{background:'var(--danger-bg)',color:'var(--danger)',border:'none',borderRadius:8,padding:'6px',cursor:'pointer',fontFamily:'inherit',marginTop:20,flexShrink:0}}>
                        <span className="icon icon-sm">delete</span>
                      </button>
                    </div>

                    {cp.personagem_id && (
                      <>
                        <label className="form-label" style={{marginBottom:6}}>
                          {pg?.multiplo ? 'Atores (múltiplos permitidos)' : 'Ator'}
                        </label>
                        {/* Atores já adicionados */}
                        {cp.person_ids.map(pid => {
                          const p = getPessoa(pid)
                          return (
                            <div key={pid} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                              <div style={{width:28,height:28,borderRadius:'50%',background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                                {p?.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:11,fontWeight:700,color:'white'}}>{getInitials(p?.name??'?')}</span>}
                              </div>
                              <span style={{flex:1,fontSize:13,fontWeight:600}}>{p?.name}</span>
                              <button type="button" onClick={()=>removeAtor(idx,pid)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
                            </div>
                          )
                        })}
                        {/* Adicionar ator */}
                        {(pg?.multiplo || cp.person_ids.length===0) && (
                          <div style={{marginTop:4}}>
                            <PersonSelect
                              pessoas={pessoas.filter(p=>!cp.person_ids.includes(p.id))}
                              value=""
                              onChange={pid=>{ if(pid) addAtor(idx,pid) }}
                              placeholder="Adicionar ator..."
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}

              {/* OBJETOS - ilimitados */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,marginTop:4}}>
                <p style={{fontSize:13,fontWeight:700}}>Objetos / Figurinos</p>
                <div style={{flex:1,marginLeft:12}}>
                  <select className="form-select" value="" onChange={e=>{if(e.target.value) addObjeto(e.target.value); e.target.value=''}} style={{fontSize:12}}>
                    <option value="">+ Adicionar objeto</option>
                    {objetos.filter(o=>!cenaObjetos.includes(o.id)).map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </div>
              </div>
              {cenaObjetos.length>0 && (
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                  {cenaObjetos.map(oid=>{
                    const obj=getObjeto(oid)
                    return obj ? (
                      <div key={oid} style={{display:'flex',alignItems:'center',gap:4,background:'var(--bg)',borderRadius:8,padding:'4px 10px',border:'1px solid var(--border)'}}>
                        <span style={{fontSize:13}}>{obj.nome}</span>
                        <button type="button" onClick={()=>removeObjeto(oid)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-light)',padding:0,fontFamily:'inherit'}}><span className="icon" style={{fontSize:14}}>close</span></button>
                      </div>
                    ) : null
                  })}
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-full" disabled={salvandoCena}>
                {salvandoCena?'Salvando...':editandoCena?'Salvar cena':'Adicionar cena'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
