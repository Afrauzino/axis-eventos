import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getInitials, isAdmin } from '../utils'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Pessoa = { id:string; name:string; photo_url:string|null; role_type?:string }
type Equipe = { id:string; name:string }
type Campo = { on:boolean; x:number; y:number; size:number; cor?:string }
type Campos = { foto:Campo; nome:Campo; equipe:Campo }

const CM = 37.8 // 1cm ~ 37.8px (96dpi) — px = tamanho físico ao imprimir
const TAMANHOS: Record<string,{label:string;w:number;h:number}> = {
  grande:    { label:'Grande em pé — 10 × 15 cm', w:10, h:15 },
  pequeno_v: { label:'Pequeno em pé — 5,4 × 8,6 cm', w:5.4, h:8.6 },
  pequeno_h: { label:'Pequeno deitado — 8,6 × 5,4 cm', w:8.6, h:5.4 },
}
const CAMPOS_PADRAO: Campos = {
  foto:   { on:true, x:50, y:30, size:42 },
  nome:   { on:true, x:50, y:64, size:12, cor:'#111827' },
  equipe: { on:true, x:50, y:78, size:6,  cor:'#6b7280' },
}

function CrachaView({ pessoa, equipeTxt, tamanho, fundo, campos }: { pessoa:Pessoa; equipeTxt:string; tamanho:string; fundo:string|null; campos:Campos }) {
  const t = TAMANHOS[tamanho] ?? TAMANHOS.grande
  const W = t.w*CM, H = t.h*CM
  const px = (p:number)=>W*p/100
  return (
    <div style={{position:'relative',width:W,height:H,background:fundo?`center/cover no-repeat url(${fundo})`:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,overflow:'hidden',flexShrink:0}}>
      {campos.foto.on && (
        <div style={{position:'absolute',left:`${campos.foto.x}%`,top:`${campos.foto.y}%`,transform:'translate(-50%,-50%)',width:px(campos.foto.size),height:px(campos.foto.size),borderRadius:'50%',overflow:'hidden',background:'#e5e7eb',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid white',boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}}>
          {pessoa.photo_url?<img src={pessoa.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontWeight:700,fontSize:px(campos.foto.size)*0.35,color:'#6b7280'}}>{getInitials(pessoa.name)}</span>}
        </div>
      )}
      {campos.nome.on && (
        <div style={{position:'absolute',left:`${campos.nome.x}%`,top:`${campos.nome.y}%`,transform:'translate(-50%,-50%)',width:'92%',textAlign:'center',fontWeight:800,fontSize:px(campos.nome.size),color:campos.nome.cor,lineHeight:1.15}}>{pessoa.name}</div>
      )}
      {campos.equipe.on && equipeTxt && (
        <div style={{position:'absolute',left:`${campos.equipe.x}%`,top:`${campos.equipe.y}%`,transform:'translate(-50%,-50%)',width:'92%',textAlign:'center',fontWeight:600,fontSize:px(campos.equipe.size),color:campos.equipe.cor}}>{equipeTxt}</div>
      )}
    </div>
  )
}

export default function Cracha({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [equipeDe, setEquipeDe] = useState<Record<string,string>>({})   // nomes (sem emoji) juntos
  const [equipeIds, setEquipeIds] = useState<Record<string,string[]>>({}) // ids das equipes de cada pessoa
  const [tamanho, setTamanho] = useState('grande')
  const [fundo, setFundo]     = useState('')
  const [campos, setCampos]   = useState<Campos>(CAMPOS_PADRAO)
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
    if (cf.data) { setTamanho(cf.data.tamanho||'grande'); setFundo(cf.data.fundo_url||''); if (cf.data.campos && Object.keys(cf.data.campos).length) setCampos({ ...CAMPOS_PADRAO, ...cf.data.campos }) }
    setPessoas(pe.data ?? [])
    setEquipes(tm.data ?? [])
    // TODAS as equipes de cada pessoa — só o nome, sem emoji, texto simples
    const nomeEquipe: Record<string,string> = {}
    ;(tm.data ?? []).forEach((t:any)=>{ nomeEquipe[t.id]=t.name })
    const nomes: Record<string,string[]> = {}
    const ids: Record<string,string[]> = {}
    ;(pt.data ?? []).forEach((v:any)=>{
      ;(ids[v.person_id]=ids[v.person_id]||[]).push(v.team_id)
      if (nomeEquipe[v.team_id]) (nomes[v.person_id]=nomes[v.person_id]||[]).push(nomeEquipe[v.team_id])
    })
    const str: Record<string,string> = {}
    Object.entries(nomes).forEach(([pid,arr])=>{ str[pid]=arr.join(' · ') })
    setEquipeDe(str); setEquipeIds(ids)
    setLoading(false)
  }

  async function salvar() {
    if (!evento) return
    setSalvando(true); setMsg('')
    const { error } = await supabase.from('crachas').upsert({ event_id:evento.id, tamanho, fundo_url:fundo||null, campos, updated_at:new Date().toISOString() }, { onConflict:'event_id' })
    setSalvando(false); setMsg(error?('Erro: '+error.message):'✓ Salvo!'); setTimeout(()=>setMsg(m=>m==='✓ Salvo!'?'':m),1500)
  }

  function setCampo(k:keyof Campos, patch:Partial<Campo>) { setCampos(c=>({ ...c, [k]:{ ...c[k], ...patch } })) }

  async function uploadFundo(file:File) {
    if (!evento) return
    setSubindo(true); setMsg('')
    const ext = file.name.split('.').pop()
    const path = `cracha/${evento.id}/fundo_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('arquivos').upload(path, file, { upsert:true })
    if (error) { setMsg('Erro ao subir: '+error.message) }
    else { const { data:u } = supabase.storage.from('arquivos').getPublicUrl(path); setFundo(u.publicUrl) }
    setSubindo(false)
  }

  const pessoasFiltradas = pessoas.filter(p => {
    if (filtroTipo!=='todos' && p.role_type!==filtroTipo) return false
    if (filtroEquipe && !(equipeIds[p.id]??[]).includes(filtroEquipe)) return false
    return true
  })

  if (evLoading || loading) return <div className="page">{[1,2].map(i=><div key={i} className="skeleton" style={{height:120,marginBottom:12,borderRadius:14}}/>)}</div>
  if (!evento) return <div className="page"><div className="empty"><p className="empty-title">Nenhum evento ativo</p></div></div>

  const amostra = pessoasFiltradas[0] ?? pessoas[0] ?? { id:'x', name:'Nome da Pessoa', photo_url:null }

  // Modo impressão: grade com todos
  if (imprimir) {
    return (
      <div style={{padding:16,background:'white'}}>
        <style>{`@media print { .no-print { display:none !important; } @page { margin:8mm; } }`}</style>
        <div className="no-print" style={{display:'flex',gap:8,marginBottom:8,alignItems:'center'}}>
          <button className="btn btn-primary" onClick={()=>window.print()}>Imprimir / Salvar PDF</button>
          <button className="btn btn-ghost" onClick={()=>setImprimir(false)}>Voltar</button>
        </div>
        <p className="no-print" style={{fontSize:12,color:'var(--muted)',marginBottom:16}}>No diálogo de impressão, escolha <strong>"Salvar como PDF"</strong> para exportar. {pessoasFiltradas.length} crachá(s).</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
          {pessoasFiltradas.map(p => <CrachaView key={p.id} pessoa={p} equipeTxt={equipeDe[p.id]??''} tamanho={tamanho} fundo={fundo||null} campos={campos}/>)}
        </div>
      </div>
    )
  }

  const CampoEditor = ({ k, label }: { k:keyof Campos; label:string }) => {
    const c = campos[k]
    return (
      <div style={{border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px',marginBottom:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:c.on?8:0}}>
          <span style={{flex:1,fontSize:13,fontWeight:700}}>{label}</span>
          <button type="button" disabled={!canEdit} onClick={()=>setCampo(k,{on:!c.on})} style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',background:c.on?'var(--primary)':'var(--border)',position:'relative'}}>
            <span style={{position:'absolute',top:3,left:c.on?23:3,width:18,height:18,borderRadius:'50%',background:'white',transition:'left 0.2s'}}/>
          </button>
        </div>
        {c.on && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {([['x','Horizontal'],['y','Vertical'],['size','Tamanho']] as const).map(([f,lab])=>(
              <div key={f}>
                <label style={{fontSize:10,color:'var(--muted)'}}>{lab}</label>
                <input type="range" min={f==='size'?4:0} max={f==='size'?60:100} value={(c as any)[f]} disabled={!canEdit} onChange={e=>setCampo(k,{[f]:parseInt(e.target.value)} as any)} style={{width:'100%'}}/>
              </div>
            ))}
            {k!=='foto' && <div><label style={{fontSize:10,color:'var(--muted)'}}>Cor</label><input type="color" value={c.cor} disabled={!canEdit} onChange={e=>setCampo(k,{cor:e.target.value})} style={{width:'100%',height:28,border:'1px solid var(--border)',borderRadius:6}}/></div>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      {/* Preview */}
      <div style={{display:'flex',justifyContent:'center',marginBottom:16,padding:12,background:'var(--bg)',borderRadius:12,overflow:'auto'}}>
        <CrachaView pessoa={amostra} equipeTxt={equipeDe[amostra.id]??'Equipe'} tamanho={tamanho} fundo={fundo||null} campos={campos}/>
      </div>

      <div className="form-group">
        <label className="form-label">Tamanho</label>
        <select className="form-select" value={tamanho} disabled={!canEdit} onChange={e=>setTamanho(e.target.value)}>
          {Object.entries(TAMANHOS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Imagem de fundo</label>
        <p className="form-hint mb-2">Faça a arte fora (Canva, etc.). Cole o link OU envie a imagem. O sistema põe foto/nome/equipe por cima.</p>
        <input className="form-input" value={fundo} disabled={!canEdit} onChange={e=>setFundo(e.target.value)} placeholder="https://... (link da imagem)"/>
        {canEdit && (
          <div style={{display:'flex',gap:8,marginTop:8,alignItems:'center'}}>
            <label className="btn btn-ghost btn-sm" style={{cursor:'pointer',border:'1px dashed var(--primary)',color:'var(--primary)'}}>
              <span className="icon icon-sm">upload</span> {subindo?'Enviando...':'Enviar imagem'}
              <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0]; if(f) uploadFundo(f); e.target.value=''}}/>
            </label>
            {fundo && <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setFundo('')} style={{color:'var(--danger)'}}>Remover fundo</button>}
          </div>
        )}
      </div>

      {/* Quem entra na impressão */}
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

      <div className="section-label mb-2">Posição dos campos</div>
      <CampoEditor k="foto" label="Foto"/>
      <CampoEditor k="nome" label="Nome"/>
      <CampoEditor k="equipe" label="Equipe"/>

      {canEdit && (
        <button className="btn btn-primary btn-full" onClick={salvar} disabled={salvando} style={{marginTop:8}}>
          {salvando?'Salvando...':'Salvar configuração'}
        </button>
      )}
      {msg && <p style={{fontSize:12,textAlign:'center',marginTop:8,color:msg.startsWith('Erro')?'var(--danger)':'var(--success)'}}>{msg}</p>}

      <button className="btn btn-outline btn-full" onClick={()=>setImprimir(true)} disabled={pessoasFiltradas.length===0} style={{marginTop:10}}>
        <span className="icon icon-sm">print</span> Gerar crachás ({pessoasFiltradas.length}) — imprimir / PDF
      </button>
    </div>
  )
}
