import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getInitials, isAdmin } from '../utils'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Pessoa = { id:string; name:string; photo_url:string|null }
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
  equipe: { on:true, x:50, y:80, size:9,  cor:'#374151' },
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
  const [equipeDe, setEquipeDe] = useState<Record<string,string>>({})
  const [tamanho, setTamanho] = useState('grande')
  const [fundo, setFundo]     = useState('')
  const [campos, setCampos]   = useState<Campos>(CAMPOS_PADRAO)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg]         = useState('')
  const [imprimir, setImprimir] = useState(false)
  const canEdit = isAdmin(profile?.user_role)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [cf, pe, tm, pt] = await Promise.all([
      supabase.from('crachas').select('*').eq('event_id',evento.id).maybeSingle(),
      supabase.from('people').select('id,name,photo_url').eq('event_id',evento.id).order('name'),
      supabase.from('teams').select('id,name,emoji').eq('event_id',evento.id),
      supabase.from('people_teams').select('person_id,team_id'),
    ])
    if (cf.data) { setTamanho(cf.data.tamanho||'grande'); setFundo(cf.data.fundo_url||''); if (cf.data.campos && Object.keys(cf.data.campos).length) setCampos({ ...CAMPOS_PADRAO, ...cf.data.campos }) }
    setPessoas(pe.data ?? [])
    // equipe (emoji + nome) de cada pessoa (primeira equipe)
    const teams: Record<string,{name:string;emoji:string|null}> = {}
    ;(tm.data ?? []).forEach((t:any)=>{ teams[t.id]={name:t.name,emoji:t.emoji} })
    const map: Record<string,string> = {}
    ;(pt.data ?? []).forEach((v:any)=>{ if(!map[v.person_id] && teams[v.team_id]){ const t=teams[v.team_id]; map[v.person_id]=`${t.emoji?t.emoji+' ':''}${t.name}` } })
    setEquipeDe(map)
    setLoading(false)
  }

  async function salvar() {
    if (!evento) return
    setSalvando(true); setMsg('')
    const { error } = await supabase.from('crachas').upsert({ event_id:evento.id, tamanho, fundo_url:fundo||null, campos, updated_at:new Date().toISOString() }, { onConflict:'event_id' })
    setSalvando(false); setMsg(error?('Erro: '+error.message):'✓ Salvo!'); setTimeout(()=>setMsg(m=>m==='✓ Salvo!'?'':m),1500)
  }

  function setCampo(k:keyof Campos, patch:Partial<Campo>) { setCampos(c=>({ ...c, [k]:{ ...c[k], ...patch } })) }

  if (evLoading || loading) return <div className="page">{[1,2].map(i=><div key={i} className="skeleton" style={{height:120,marginBottom:12,borderRadius:14}}/>)}</div>
  if (!evento) return <div className="page"><div className="empty"><p className="empty-title">Nenhum evento ativo</p></div></div>

  const amostra = pessoas[0] ?? { id:'x', name:'Nome da Pessoa', photo_url:null }

  // Modo impressão: grade com todos
  if (imprimir) {
    return (
      <div style={{padding:16,background:'white'}}>
        <style>{`@media print { .no-print { display:none !important; } @page { margin:8mm; } }`}</style>
        <div className="no-print" style={{display:'flex',gap:8,marginBottom:16}}>
          <button className="btn btn-primary" onClick={()=>window.print()}>Imprimir</button>
          <button className="btn btn-ghost" onClick={()=>setImprimir(false)}>Voltar</button>
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
          {pessoas.map(p => <CrachaView key={p.id} pessoa={p} equipeTxt={equipeDe[p.id]??''} tamanho={tamanho} fundo={fundo||null} campos={campos}/>)}
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
        <CrachaView pessoa={amostra} equipeTxt={equipeDe[amostra.id]??'🎭 Equipe'} tamanho={tamanho} fundo={fundo||null} campos={campos}/>
      </div>

      <div className="form-group">
        <label className="form-label">Tamanho</label>
        <select className="form-select" value={tamanho} disabled={!canEdit} onChange={e=>setTamanho(e.target.value)}>
          {Object.entries(TAMANHOS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Imagem de fundo (link)</label>
        <p className="form-hint mb-2">Faça a arte fora (Canva, etc.) e cole aqui o link direto da imagem. O sistema põe foto/nome/equipe por cima.</p>
        <input className="form-input" value={fundo} disabled={!canEdit} onChange={e=>setFundo(e.target.value)} placeholder="https://... (imagem do fundo)"/>
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

      <button className="btn btn-outline btn-full" onClick={()=>setImprimir(true)} style={{marginTop:10}}>
        <span className="icon icon-sm">print</span> Gerar crachás ({pessoas.length}) para impressão
      </button>
    </div>
  )
}
