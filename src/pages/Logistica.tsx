import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import FichaMedica from '../components/FichaMedica'
import PrintOverlay from '../components/PrintOverlay'
import CardItem from '../components/CardItem'
import FotoAmpliada from '../components/FotoAmpliada'
import { useRegistrarChrome } from '../lib/chrome'
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
  const [loading, setLoading] = useState(true)
  const [encontristas, setEncontristas] = useState<Pessoa[]>([])
  const [itens, setItens]     = useState<ItemChk[]>([])
  const [status, setStatus]   = useState<StatusChk[]>([])
  const [pessoas, setPessoas] = useState<PessoaLog[]>([])
  const [aba, setAba] = useState<'encontristas'|'config'>('encontristas')
  const [aberto, setAberto] = useState<Pessoa|null>(null)
  useVoltarFecha(!!aberto, () => setAberto(null))
  const [fotoAmpliada, setFotoAmpliada] = useState<string|null>(null)
  const [novoItem, setNovoItem] = useState('')
  const [busca, setBusca] = useState('')
  const [imprimir, setImprimir] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [fichaMap, setFichaMap] = useState<Record<string,any>>({})
  const [medMap, setMedMap]     = useState<Record<string,any[]>>({})

  useRegistrarChrome(
    aba==='encontristas'
      ? {
          busca: { value: busca, onChange: setBusca, placeholder: 'Buscar encontrista...' },
          impressoes: [{ label: gerando?'Gerando PDF...':'Gerar PDF de todos (checklist + ficha)', icon:'picture_as_pdf', onClick: gerarPdfTodos, disabled: gerando }],
        }
      : {},
    [aba, busca, gerando]
  )

  async function gerarPdfTodos() {
    if (!evento) return
    setGerando(true)
    const [fi, mc] = await Promise.all([
      supabase.from('saude_fichas').select('*').eq('event_id',evento.id),
      supabase.from('med_controlados').select('*').eq('event_id',evento.id),
    ])
    const fm: Record<string,any> = {}; (fi.data??[]).forEach((f:any)=>{ fm[f.person_id]=f })
    const mm: Record<string,any[]> = {}; (mc.data??[]).forEach((m:any)=>{ (mm[m.person_id]=mm[m.person_id]||[]).push(m) })
    setFichaMap(fm); setMedMap(mm); setGerando(false); setImprimir(true)
  }

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
  // resposta do item: true=Sim, false=Não, null=não respondido
  function respostaDe(encId:string, itemId:string): boolean|null {
    const s = status.find(s=>s.encontrista_id===encId && s.item_id===itemId)
    return s ? s.marcado : null
  }
  async function responder(encId:string, itemId:string, sim:boolean) {
    const existe = status.find(s=>s.encontrista_id===encId && s.item_id===itemId)
    if (existe) {
      await supabase.from('logistica_checklist_status').update({ marcado:sim }).eq('id',existe.id)
      setStatus(prev=>prev.map(s=>s.id===existe.id?{...s,marcado:sim}:s))
    } else {
      const { data } = await supabase.from('logistica_checklist_status').insert({ event_id:evento!.id, encontrista_id:encId, item_id:itemId, marcado:sim }).select().single()
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
    // progresso = itens respondidos (Sim ou Não) sobre o total
    const respondidos = itens.filter(it=>status.some(s=>s.encontrista_id===encId && s.item_id===it.id)).length
    return Math.round((respondidos/itens.length)*100)
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
          {filtrados.length===0 ? <div className="empty"><p className="empty-desc">Nenhum encontrista.</p></div> :
          filtrados.map(e=>{
            const pct = progresso(e.id); const inf = info(e.id)
            return (
              <CardItem
                key={e.id}
                cor="var(--primary)"
                ehPessoa
                fotoUrl={e.photo_url}
                iniciais={getInitials(e.name)}
                titulo={formatName(e.name)}
                direita={<span style={{fontSize:15,fontWeight:800,color:'var(--primary)'}}>{pct}%</span>}
                progresso={pct}
                extra={(inf.concluido || inf.toma_controlado) ? (
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    {inf.concluido && <span style={{fontSize:10,fontWeight:700,color:'white',background:'var(--success)',padding:'2px 8px',borderRadius:99}}>Concluído</span>}
                    {inf.toma_controlado && <span style={{fontSize:14}} title="Medicamento contínuo">💊</span>}
                  </div>
                ) : undefined}
                onVer={()=>setAberto(e)}
                onFoto={()=>e.photo_url && setFotoAmpliada(e.photo_url)}
              />
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
                const r = respostaDe(aberto.id, it.id)
                return (
                  <div key={it.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid var(--border)'}}>
                    <span style={{flex:1,fontSize:13}}>{it.texto}</span>
                    <div style={{display:'flex',gap:6,flexShrink:0}}>
                      {([['Sim',true],['Não',false]] as const).map(([lab,val])=>{
                        const on = r===val
                        return (
                          <button key={lab} onClick={()=>responder(aberto.id,it.id,val)}
                            style={{padding:'5px 12px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700,
                              border:on?`2px solid ${val?'var(--success)':'var(--danger)'}`:'1px solid var(--border)',
                              background:on?(val?'var(--success-bg)':'var(--danger-bg)'):'white',
                              color:on?(val?'var(--success)':'var(--danger)'):'var(--text2)'}}>{lab}</button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Ficha Médica (mesmo componente da Saúde — fonte única; inclui o medicamento contínuo) */}
            {evento && <FichaMedica personId={aberto.id} eventId={evento.id} />}

            {/* Concluir */}
            <button className={`btn btn-full ${inf.concluido?'btn-ghost':'btn-primary'}`} onClick={()=>salvarInfo(aberto.id,{concluido:!inf.concluido})}>
              {inf.concluido ? 'Reabrir iniciação' : 'Marcar iniciação como concluída'}
            </button>
            <button className="btn btn-ghost btn-full" style={{marginTop:8}} onClick={()=>setAberto(null)}>Fechar</button>
          </div>
        </div>
        )
      })()}

      {imprimir && (
        <PrintOverlay titulo="Logística — checklist + ficha médica" onClose={()=>setImprimir(false)}>
          {filtrados.map(e=>{
            const fi = fichaMap[e.id]
            const meds = medMap[e.id] ?? []
            return (
              <div key={e.id} className="print-break" style={{marginBottom:24}}>
                {(() => {
                  const cx = (v:boolean|null|undefined) => <span style={{whiteSpace:'nowrap'}}>{v===true?'☑':'☐'} Sim &nbsp;&nbsp;{v===false?'☑':'☐'} Não</span>
                  const linha = (txt?:string) => <span style={{borderBottom:'1px solid #9ca3af',display:'inline-block',minWidth:200,paddingLeft:4,lineHeight:1.4}}>{txt||' '}</span>
                  const rest = fi ? (fi.restricao_alimentar || !!fi.restricoes_alimentares) : undefined
                  const aler = fi ? (fi.alergia_medicamentos || !!fi.alergias) : undefined
                  const cont = fi ? (fi.toma_controlado || meds.length>0) : (meds.length>0?true:undefined)
                  return (
                <>
                <div style={{display:'flex',alignItems:'center',gap:12,borderBottom:'2px solid #111827',paddingBottom:8,marginBottom:8}}>
                  <div style={{width:56,height:56,borderRadius:'50%',overflow:'hidden',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {e.photo_url?<img src={e.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontWeight:700,color:'#6b7280'}}>{getInitials(e.name)}</span>}
                  </div>
                  <h2 style={{fontSize:18,fontWeight:800}}>{formatName(e.name)}</h2>
                </div>
                <p style={{fontSize:13,marginBottom:12}}>Encontreiro responsável: {linha()}</p>

                <h3 style={{fontSize:13,fontWeight:800,textTransform:'uppercase',color:'#374151',marginBottom:6}}>Checklist</h3>
                <table style={{width:'100%',borderCollapse:'collapse',marginBottom:14,fontSize:13}}>
                  <tbody>
                    {itens.map(it=>(
                      <tr key={it.id} style={{borderBottom:'1px solid #e5e7eb'}}>
                        <td style={{padding:'6px 4px'}}>{it.texto}</td>
                        <td style={{padding:'6px 4px',textAlign:'right',width:120}}>{cx(respostaDe(e.id, it.id))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3 style={{fontSize:13,fontWeight:800,textTransform:'uppercase',color:'#374151',marginBottom:6}}>Ficha médica</h3>
                <p style={{fontSize:13,marginBottom:6}}>Restrição alimentar: {cx(rest)} &nbsp; Qual: {linha(fi?.restricoes_alimentares)}</p>
                <p style={{fontSize:13,marginBottom:6}}>Alergia a medicamentos: {cx(aler)} &nbsp; Quais: {linha(fi?.alergias)}</p>
                <p style={{fontSize:13,marginBottom:6}}>Medicamento contínuo: {cx(cont)}</p>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,marginTop:4}}>
                  <thead><tr style={{borderBottom:'1px solid #111827'}}><th style={{textAlign:'left',padding:'3px 4px'}}>Medicamento</th><th style={{textAlign:'left',padding:'3px 4px'}}>Dose</th><th style={{textAlign:'left',padding:'3px 4px'}}>Intervalo</th><th style={{textAlign:'left',padding:'3px 4px'}}>Última dose</th></tr></thead>
                  <tbody>
                    {[...meds, ...(meds.length<2?Array(2-meds.length).fill(null):[])].map((m:any,i:number)=>(
                      <tr key={m?.id??'b'+i} style={{borderBottom:'1px solid #e5e7eb'}}>
                        <td style={{padding:'6px 4px'}}>{m?linha(m.nome):linha()}</td>
                        <td style={{padding:'6px 4px'}}>{m?linha(m.dosagem):linha()}</td>
                        <td style={{padding:'6px 4px'}}>{m?linha(m.intervalo_h?`${m.intervalo_h}h`:''):linha()}</td>
                        <td style={{padding:'6px 4px'}}>{linha()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </>
                  )
                })()}
              </div>
            )
          })}
        </PrintOverlay>
      )}
      <FotoAmpliada url={fotoAmpliada} onClose={()=>setFotoAmpliada(null)} />
    </div>
  )
}

function Avatar({ p, size=40 }: { p:{name:string;photo_url:string|null}; size?:number }) {
  return p.photo_url
    ? <img src={p.photo_url} alt="" style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
    : <div style={{width:size,height:size,borderRadius:'50%',background:'var(--primary-light)',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:size*0.4,flexShrink:0}}>{getInitials(p.name)}</div>
}
