import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getInitials, isAdmin } from '../utils'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Pessoa = { id:string; name:string; photo_url:string|null; role_type?:string }
type Equipe = { id:string; name:string }
type Estilo = { fonte?:string; negrito?:boolean; italico?:boolean; sublinhado?:boolean; cor?:string }
type Campo  = { on:boolean; x:number; y:number; size:number } & Estilo
type TextoLivre = { id:string; conteudo:string; x:number; y:number; size:number } & Estilo
type Config = { foto:Campo; nome:Campo; equipe:Campo; textos:TextoLivre[] }

const CM = 37.8
const TAMANHOS: Record<string,{label:string;w:number;h:number}> = {
  grande:    { label:'Grande em pé — 10 × 15 cm', w:10, h:15 },
  pequeno_v: { label:'Pequeno em pé — 5,4 × 8,6 cm', w:5.4, h:8.6 },
  pequeno_h: { label:'Pequeno deitado — 8,6 × 5,4 cm', w:8.6, h:5.4 },
}
const FONTES = ['Padrão','Arial','Helvetica','Georgia','Times New Roman','Verdana','Trebuchet MS','Tahoma','Courier New','Impact','Comic Sans MS','Brush Script MT']
const fontFamilyDe = (f?:string)=> (!f||f==='Padrão')?'inherit':`'${f}', sans-serif`
const CONFIG_PADRAO: Config = {
  foto:   { on:true, x:50, y:30, size:42 },
  nome:   { on:true, x:50, y:64, size:12, cor:'#111827', fonte:'Padrão', negrito:true },
  equipe: { on:true, x:50, y:78, size:6,  cor:'#6b7280', fonte:'Padrão' },
  textos: [],
}

function estiloTexto(e:Estilo, fontSize:number) {
  return { fontFamily:fontFamilyDe(e.fonte), fontWeight:e.negrito?800:400, fontStyle:e.italico?'italic':'normal' as any, textDecoration:e.sublinhado?'underline':'none', color:e.cor, fontSize }
}

// ---- Crachá visual (com modo edição: arrastar/selecionar) ----
function CrachaView({ pessoa, equipeTxt, tamanho, fundo, cfg, edit, sel, onSelect, onMove }:{
  pessoa:Pessoa; equipeTxt:string; tamanho:string; fundo:string|null; cfg:Config;
  edit?:boolean; sel?:string|null; onSelect?:(k:string)=>void; onMove?:(k:string,x:number,y:number)=>void
}) {
  const t = TAMANHOS[tamanho] ?? TAMANHOS.grande
  const W=t.w*CM, H=t.h*CM
  const px=(p:number)=>W*p/100
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<string|null>(null)

  function pointerDown(k:string, e:React.PointerEvent) { if(!edit) return; e.stopPropagation(); drag.current=k; onSelect?.(k); (e.target as HTMLElement).setPointerCapture?.(e.pointerId) }
  function pointerMove(e:React.PointerEvent) {
    if(!edit||!drag.current||!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const x = Math.max(0,Math.min(100, ((e.clientX-r.left)/r.width)*100))
    const y = Math.max(0,Math.min(100, ((e.clientY-r.top)/r.height)*100))
    onMove?.(drag.current, Math.round(x), Math.round(y))
  }
  function pointerUp() { drag.current=null }

  const selStyle = (k:string):React.CSSProperties => edit && sel===k ? { outline:'2px dashed var(--primary)', outlineOffset:2, cursor:'move' } : (edit?{cursor:'move'}:{})

  return (
    <div ref={ref} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerLeave={pointerUp} onClick={()=>edit&&onSelect?.('')}
      style={{position:'relative',width:W,height:H,background:fundo?`center/cover no-repeat url(${fundo})`:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,overflow:'hidden',flexShrink:0,touchAction:'none'}}>
      {cfg.foto.on && (
        <div onPointerDown={e=>pointerDown('foto',e)} style={{position:'absolute',left:`${cfg.foto.x}%`,top:`${cfg.foto.y}%`,transform:'translate(-50%,-50%)',width:px(cfg.foto.size),height:px(cfg.foto.size),borderRadius:'50%',overflow:'hidden',background:'#e5e7eb',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid white',boxShadow:'0 1px 4px rgba(0,0,0,0.2)',...selStyle('foto')}}>
          {pessoa.photo_url?<img src={pessoa.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',pointerEvents:'none'}}/>:<span style={{fontWeight:700,fontSize:px(cfg.foto.size)*0.35,color:'#6b7280'}}>{getInitials(pessoa.name)}</span>}
        </div>
      )}
      {cfg.nome.on && (
        <div onPointerDown={e=>pointerDown('nome',e)} style={{position:'absolute',left:`${cfg.nome.x}%`,top:`${cfg.nome.y}%`,transform:'translate(-50%,-50%)',width:'92%',textAlign:'center',lineHeight:1.15,...estiloTexto(cfg.nome,px(cfg.nome.size)),...selStyle('nome')}}>{pessoa.name}</div>
      )}
      {cfg.equipe.on && equipeTxt && (
        <div onPointerDown={e=>pointerDown('equipe',e)} style={{position:'absolute',left:`${cfg.equipe.x}%`,top:`${cfg.equipe.y}%`,transform:'translate(-50%,-50%)',width:'92%',textAlign:'center',...estiloTexto(cfg.equipe,px(cfg.equipe.size)),...selStyle('equipe')}}>{equipeTxt}</div>
      )}
      {cfg.textos.map(tx=>(
        <div key={tx.id} onPointerDown={e=>pointerDown('t:'+tx.id,e)} style={{position:'absolute',left:`${tx.x}%`,top:`${tx.y}%`,transform:'translate(-50%,-50%)',width:'92%',textAlign:'center',...estiloTexto(tx,px(tx.size)),...selStyle('t:'+tx.id)}}>{tx.conteudo||' '}</div>
      ))}
    </div>
  )
}

export default function Cracha({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [equipeDe, setEquipeDe] = useState<Record<string,string>>({})
  const [equipeIds, setEquipeIds] = useState<Record<string,string[]>>({})
  const [tamanho, setTamanho] = useState('grande')
  const [fundo, setFundo]     = useState('')
  const [cfg, setCfg]         = useState<Config>(CONFIG_PADRAO)
  const [sel, setSel]         = useState<string>('')   // 'foto'|'nome'|'equipe'|'t:<id>'|''
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [subindo, setSubindo] = useState(false)
  const [msg, setMsg]         = useState('')
  const [imprimir, setImprimir] = useState(false)
  const [filtroTipo, setFiltroTipo]   = useState<'todos'|'encounterer'|'worker'>('todos')
  const [filtroEquipe, setFiltroEquipe] = useState('')
  const canEdit = isAdmin(profile?.user_role)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [cf, pe, tm, pt] = await Promise.all([
      supabase.from('crachas').select('*').eq('event_id',evento.id).maybeSingle(),
      supabase.from('people').select('id,name,photo_url,role_type').eq('event_id',evento.id).order('name'),
      supabase.from('teams').select('id,name').eq('event_id',evento.id).order('name'),
      supabase.from('people_teams').select('person_id,team_id'),
    ])
    if (cf.data) { setTamanho(cf.data.tamanho||'grande'); setFundo(cf.data.fundo_url||''); if (cf.data.campos && Object.keys(cf.data.campos).length) setCfg({ ...CONFIG_PADRAO, ...cf.data.campos, textos:cf.data.campos.textos??[] }) }
    setPessoas(pe.data ?? []); setEquipes(tm.data ?? [])
    const nomeEquipe: Record<string,string> = {}; (tm.data ?? []).forEach((t:any)=>{ nomeEquipe[t.id]=t.name })
    const nomes: Record<string,string[]> = {}; const ids: Record<string,string[]> = {}
    ;(pt.data ?? []).forEach((v:any)=>{ (ids[v.person_id]=ids[v.person_id]||[]).push(v.team_id); if(nomeEquipe[v.team_id]) (nomes[v.person_id]=nomes[v.person_id]||[]).push(nomeEquipe[v.team_id]) })
    const str: Record<string,string> = {}; Object.entries(nomes).forEach(([pid,arr])=>{ str[pid]=arr.join(' · ') })
    setEquipeDe(str); setEquipeIds(ids); setLoading(false)
  }

  async function salvar() {
    if (!evento) return
    setSalvando(true); setMsg('')
    const { error } = await supabase.from('crachas').upsert({ event_id:evento.id, tamanho, fundo_url:fundo||null, campos:cfg, updated_at:new Date().toISOString() }, { onConflict:'event_id' })
    setSalvando(false); setMsg(error?('Erro: '+error.message):'✓ Salvo!'); setTimeout(()=>setMsg(m=>m==='✓ Salvo!'?'':m),1500)
  }

  async function uploadFundo(file:File) {
    if (!evento) return
    setSubindo(true); setMsg('')
    const ext=file.name.split('.').pop(); const path=`cracha/${evento.id}/fundo_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('arquivos').upload(path, file, { upsert:true })
    if (error) setMsg('Erro ao subir: '+error.message)
    else { const { data:u } = supabase.storage.from('arquivos').getPublicUrl(path); setFundo(u.publicUrl) }
    setSubindo(false)
  }

  // helpers de edição
  function move(k:string, x:number, y:number) {
    if (!canEdit) return
    if (k.startsWith('t:')) { const id=k.slice(2); setCfg(c=>({...c,textos:c.textos.map(t=>t.id===id?{...t,x,y}:t)})) }
    else setCfg(c=>({ ...c, [k]:{ ...(c as any)[k], x, y } }))
  }
  function patchSel(patch:any) {
    if (!sel) return
    if (sel.startsWith('t:')) { const id=sel.slice(2); setCfg(c=>({...c,textos:c.textos.map(t=>t.id===id?{...t,...patch}:t)})) }
    else setCfg(c=>({ ...c, [sel]:{ ...(c as any)[sel], ...patch } }))
  }
  function selObj():any { if(!sel) return null; if(sel.startsWith('t:')) return cfg.textos.find(t=>t.id===sel.slice(2)); return (cfg as any)[sel] }
  function addTexto() { const id=Math.random().toString(36).slice(2,8); setCfg(c=>({...c,textos:[...c.textos,{id,conteudo:'Texto',x:50,y:50,size:8,cor:'#111827',fonte:'Padrão'}]})); setSel('t:'+id) }
  function delTexto() { if(sel.startsWith('t:')){ const id=sel.slice(2); setCfg(c=>({...c,textos:c.textos.filter(t=>t.id!==id)})); setSel('') } }

  const pessoasFiltradas = pessoas.filter(p => {
    if (filtroTipo!=='todos' && p.role_type!==filtroTipo) return false
    if (filtroEquipe && !(equipeIds[p.id]??[]).includes(filtroEquipe)) return false
    return true
  })

  if (evLoading || loading) return <div className="page">{[1,2].map(i=><div key={i} className="skeleton" style={{height:120,marginBottom:12,borderRadius:14}}/>)}</div>
  if (!evento) return <div className="page"><div className="empty"><p className="empty-title">Nenhum evento ativo</p></div></div>

  const amostra = pessoasFiltradas[0] ?? pessoas[0] ?? { id:'x', name:'Nome da Pessoa', photo_url:null }

  if (imprimir) {
    return (
      <div style={{padding:16,background:'white'}}>
        <style>{`@media print { .no-print { display:none !important; } @page { margin:8mm; } }`}</style>
        <div className="no-print" style={{display:'flex',gap:8,marginBottom:8}}>
          <button className="btn btn-primary" onClick={()=>window.print()}>Imprimir / Salvar PDF</button>
          <button className="btn btn-ghost" onClick={()=>setImprimir(false)}>Voltar</button>
        </div>
        <p className="no-print" style={{fontSize:12,color:'var(--muted)',marginBottom:16}}>No diálogo, escolha "Salvar como PDF". {pessoasFiltradas.length} crachá(s).</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
          {pessoasFiltradas.map(p => <CrachaView key={p.id} pessoa={p} equipeTxt={equipeDe[p.id]??''} tamanho={tamanho} fundo={fundo||null} cfg={cfg}/>)}
        </div>
      </div>
    )
  }

  const s = selObj()
  const selLabel = sel==='foto'?'Foto':sel==='nome'?'Nome':sel==='equipe'?'Equipe':sel.startsWith('t:')?'Texto livre':''

  return (
    <div className="page">
      <p style={{fontSize:12,color:'var(--muted)',marginBottom:8}}>Arraste os elementos no crachá para posicionar. Toque para selecionar e editar abaixo.</p>
      <div style={{display:'flex',justifyContent:'center',marginBottom:14,padding:12,background:'var(--bg)',borderRadius:12,overflow:'auto'}}>
        <CrachaView pessoa={amostra} equipeTxt={equipeDe[amostra.id]??'Equipe'} tamanho={tamanho} fundo={fundo||null} cfg={cfg} edit={canEdit} sel={sel} onSelect={setSel} onMove={move}/>
      </div>

      {/* Controles do elemento selecionado */}
      {sel && s && (
        <div style={{border:'1px solid var(--primary)',borderRadius:10,padding:'12px',marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <span style={{flex:1,fontSize:13,fontWeight:800,color:'var(--primary)'}}>{selLabel} selecionado</span>
            {'on' in s && sel!=='' && !sel.startsWith('t:') && <button className="btn btn-ghost btn-sm" onClick={()=>patchSel({on:!s.on})}>{s.on?'Ocultar':'Mostrar'}</button>}
            {sel.startsWith('t:') && <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={delTexto}>Remover</button>}
          </div>
          {sel.startsWith('t:') && (
            <div className="form-group"><label className="form-label">Texto</label>
              <input className="form-input" value={s.conteudo} onChange={e=>patchSel({conteudo:e.target.value})} placeholder="Digite o texto"/>
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <span style={{fontSize:12,color:'var(--muted)'}}>Tamanho</span>
            <button className="btn btn-outline btn-sm" onClick={()=>patchSel({size:Math.max(4,s.size-1)})}>−</button>
            <span style={{minWidth:28,textAlign:'center',fontWeight:700}}>{s.size}</span>
            <button className="btn btn-outline btn-sm" onClick={()=>patchSel({size:Math.min(80,s.size+1)})}>+</button>
          </div>
          {sel!=='foto' && (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <select className="form-select" value={s.fonte??'Padrão'} onChange={e=>patchSel({fonte:e.target.value})} style={{flex:1,fontFamily:fontFamilyDe(s.fonte)}}>
                {FONTES.map(f=><option key={f} value={f} style={{fontFamily:fontFamilyDe(f)}}>{f}</option>)}
              </select>
              {([['negrito','B',{fontWeight:800}],['italico','I',{fontStyle:'italic'}],['sublinhado','S',{textDecoration:'underline'}]] as const).map(([prop,lab,st])=>{
                const on=(s as any)[prop]
                return <button key={prop} type="button" onClick={()=>patchSel({[prop]:!on})} style={{width:34,height:34,borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:14,...st,border:on?'2px solid var(--primary)':'1px solid var(--border)',background:on?'var(--primary-light)':'white',color:on?'var(--primary)':'var(--text2)'}}>{lab}</button>
              })}
              <input type="color" value={s.cor??'#111827'} onChange={e=>patchSel({cor:e.target.value})} style={{width:34,height:34,border:'1px solid var(--border)',borderRadius:8}}/>
            </div>
          )}
        </div>
      )}

      {canEdit && <button className="btn btn-ghost btn-full btn-sm mb-3" onClick={addTexto}><span className="icon icon-sm">add</span> Adicionar texto livre</button>}

      <div className="form-group">
        <label className="form-label">Tamanho do crachá</label>
        <select className="form-select" value={tamanho} disabled={!canEdit} onChange={e=>setTamanho(e.target.value)}>
          {Object.entries(TAMANHOS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Imagem de fundo</label>
        <p className="form-hint mb-2">Faça a arte fora (Canva, etc.). Cole o link OU envie a imagem.</p>
        <input className="form-input" value={fundo} disabled={!canEdit} onChange={e=>setFundo(e.target.value)} placeholder="https://... (link da imagem)"/>
        {canEdit && (
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <label className="btn btn-ghost btn-sm" style={{cursor:'pointer',border:'1px dashed var(--primary)',color:'var(--primary)'}}>
              <span className="icon icon-sm">upload</span> {subindo?'Enviando...':'Enviar imagem'}
              <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0]; if(f) uploadFundo(f); e.target.value=''}}/>
            </label>
            {fundo && <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setFundo('')} style={{color:'var(--danger)'}}>Remover fundo</button>}
          </div>
        )}
      </div>

      <div className="section-label mb-2">Quem entra</div>
      <div className="filter-bar mb-2">
        {([['todos','Todos'],['encounterer','Encontristas'],['worker','Encontreiros']] as const).map(([v,l])=>(
          <button key={v} className={`chip ${filtroTipo===v?'active':''}`} onClick={()=>setFiltroTipo(v)}>{l}</button>
        ))}
      </div>
      <div className="form-group">
        <select className="form-select" value={filtroEquipe} onChange={e=>setFiltroEquipe(e.target.value)}>
          <option value="">Todas as equipes</option>
          {equipes.map(eq=><option key={eq.id} value={eq.id}>{eq.name}</option>)}
        </select>
      </div>

      {canEdit && <button className="btn btn-primary btn-full" onClick={salvar} disabled={salvando}>{salvando?'Salvando...':'Salvar configuração'}</button>}
      {msg && <p style={{fontSize:12,textAlign:'center',marginTop:8,color:msg.startsWith('Erro')?'var(--danger)':'var(--success)'}}>{msg}</p>}
      <button className="btn btn-outline btn-full" onClick={()=>setImprimir(true)} disabled={pessoasFiltradas.length===0} style={{marginTop:10}}>
        <span className="icon icon-sm">print</span> Gerar crachás ({pessoasFiltradas.length}) — imprimir / PDF
      </button>
    </div>
  )
}
