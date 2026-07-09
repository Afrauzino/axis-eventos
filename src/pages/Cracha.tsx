import { useEffect, useRef, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { getInitials, isAdmin } from '../utils'
import { useEvento } from '../hooks/useEvento'
import Seletor from '../components/Seletor'
import type { Profile } from '../App'

type Pessoa = { id:string; name:string; photo_url:string|null; role_type?:string }
type Equipe = { id:string; name:string }
type Estilo = { fonte?:string; negrito?:boolean; italico?:boolean; sublinhado?:boolean; cor?:string }
type Campo  = { on:boolean; x:number; y:number; size:number; largura?:number } & Estilo
type FotoCampo = Campo & { formato?:'redondo'|'quadrado' }
type TextoLivre = { id:string; conteudo:string; x:number; y:number; size:number; largura?:number } & Estilo
type ImgLayer = { id:string; url:string; x:number; y:number; w:number } // x,y = centro %, w = largura %
type Config = { foto:FotoCampo; nome:Campo; equipe:Campo; textos:TextoLivre[] }
type ModeloCfg = { tamanho:string; cw:number; ch:number; unidade:'mm'|'cm'|'px'; fundo:string; cfg:Config; imagens:ImgLayer[] }

const CM = 37.8, MM = 3.78
const TAMANHOS: Record<string,{label:string;w:number;h:number}> = {
  grande:    { label:'Grande em pé — 10 × 15 cm', w:10, h:15 },
  pequeno_v: { label:'Pequeno em pé — 5,4 × 8,6 cm', w:5.4, h:8.6 },
  pequeno_h: { label:'Pequeno deitado — 8,6 × 5,4 cm', w:8.6, h:5.4 },
}
const MODELOS = [
  { key:'encontreiros', label:'Encontreiros', rt:'worker' as string },
  { key:'encontrista',  label:'Encontrista',  rt:'encounterer' },
  { key:'especiais',    label:'Especiais',    rt:'todos' },
]
const FONTES = ['Padrão','Arial','Helvetica','Georgia','Times New Roman','Verdana','Trebuchet MS','Tahoma','Courier New','Impact','Comic Sans MS','Brush Script MT']
const fontFamilyDe = (f?:string)=> (!f||f==='Padrão')?'inherit':`'${f}', sans-serif`
const CONFIG_PADRAO: Config = {
  foto:   { on:true, x:50, y:30, size:42, formato:'redondo' },
  nome:   { on:true, x:50, y:64, size:12, cor:'#111827', fonte:'Padrão', negrito:true },
  equipe: { on:true, x:50, y:78, size:6,  cor:'#6b7280', fonte:'Padrão' },
  textos: [],
}
const clone = <T,>(v:T):T => JSON.parse(JSON.stringify(v))
const modeloPadrao = ():ModeloCfg => ({ tamanho:'grande', cw:5.4, ch:8.6, unidade:'cm', fundo:'', cfg:clone(CONFIG_PADRAO), imagens:[] })
const modelosPadrao = ():Record<string,ModeloCfg> => Object.fromEntries(MODELOS.map(m=>[m.key, modeloPadrao()]))

function dimsPx(m:ModeloCfg) {
  if (m.tamanho==='custom') {
    const f = m.unidade==='cm'?CM : m.unidade==='mm'?MM : 1
    return { W: Math.max(60, m.cw*f), H: Math.max(60, m.ch*f) }
  }
  const t = TAMANHOS[m.tamanho] ?? TAMANHOS.grande
  return { W: t.w*CM, H: t.h*CM }
}

function estiloTexto(e:Estilo, fontSize:number) {
  return { fontFamily:fontFamilyDe(e.fonte), fontWeight:e.negrito?800:400, fontStyle:e.italico?'italic':'normal' as any, textDecoration:e.sublinhado?'underline':'none', color:e.cor, fontSize }
}

// ---- Crachá visual (com modo edição: arrastar/selecionar) ----
function CrachaView({ pessoa, equipeTxt, m, edit, sel, onSelect, onMove, exibirEm }:{
  pessoa:Pessoa; equipeTxt:string; m:ModeloCfg;
  edit?:boolean; sel?:string|null; onSelect?:(k:string)=>void; onMove?:(k:string,x:number,y:number)=>void
  exibirEm?:{ maxW:number; maxH:number }  // trava o tamanho NA TELA (mantém proporção); impressão usa o real
}) {
  const real = dimsPx(m)
  let W = real.W, H = real.H
  if (exibirEm) {
    // encaixa na caixa de edição mantendo a proporção → visualizador não cresce ao mudar o tamanho
    const s = Math.min(exibirEm.maxW / real.W, exibirEm.maxH / real.H)
    W = real.W * s; H = real.H * s
  }
  const cfg = m.cfg
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
  const fotoQuad = cfg.foto.formato==='quadrado'
  const fotoW = px(cfg.foto.size)
  const fotoH = fotoQuad ? fotoW*4/3 : fotoW

  return (
    <div ref={ref} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerLeave={pointerUp} onClick={e=>{ if(edit && e.target===e.currentTarget) onSelect?.('') }}
      style={{position:'relative',width:W,height:H,background:m.fundo?`center/cover no-repeat url(${m.fundo})`:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,overflow:'hidden',flexShrink:0,touchAction:'none'}}>

      {cfg.foto.on && (
        <div onPointerDown={e=>pointerDown('foto',e)} style={{position:'absolute',left:`${cfg.foto.x}%`,top:`${cfg.foto.y}%`,transform:'translate(-50%,-50%)',width:fotoW,height:fotoH,borderRadius:fotoQuad?fotoW*0.12:'50%',overflow:'hidden',background:'#e5e7eb',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid white',boxShadow:'0 1px 4px rgba(0,0,0,0.2)',...selStyle('foto')}}>
          {pessoa.photo_url?<img src={pessoa.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',pointerEvents:'none'}}/>:<span style={{fontWeight:700,fontSize:fotoW*0.35,color:'#6b7280'}}>{getInitials(pessoa.name)}</span>}
        </div>
      )}
      {cfg.nome.on && (
        <div onPointerDown={e=>pointerDown('nome',e)} style={{position:'absolute',left:`${cfg.nome.x}%`,top:`${cfg.nome.y}%`,transform:'translate(-50%,-50%)',width:`${cfg.nome.largura ?? 92}%`,textAlign:'center',lineHeight:1.15,...estiloTexto(cfg.nome,px(cfg.nome.size)),...selStyle('nome')}}>{pessoa.name}</div>
      )}
      {cfg.equipe.on && equipeTxt && (
        <div onPointerDown={e=>pointerDown('equipe',e)} style={{position:'absolute',left:`${cfg.equipe.x}%`,top:`${cfg.equipe.y}%`,transform:'translate(-50%,-50%)',width:`${cfg.equipe.largura ?? 92}%`,textAlign:'center',...estiloTexto(cfg.equipe,px(cfg.equipe.size)),...selStyle('equipe')}}>{equipeTxt}</div>
      )}
      {cfg.textos.map(tx=>(
        <div key={tx.id} onPointerDown={e=>pointerDown('t:'+tx.id,e)} style={{position:'absolute',left:`${tx.x}%`,top:`${tx.y}%`,transform:'translate(-50%,-50%)',width:`${tx.largura ?? 92}%`,textAlign:'center',...estiloTexto(tx,px(tx.size)),...selStyle('t:'+tx.id)}}>{tx.conteudo||' '}</div>
      ))}

      {/* PNGs em camadas (independentes) — por cima, fáceis de arrastar */}
      {m.imagens.map(im=>(
        <img key={im.id} src={im.url} alt="" draggable={false} onPointerDown={e=>pointerDown('img:'+im.id,e)}
          style={{position:'absolute',left:`${im.x}%`,top:`${im.y}%`,transform:'translate(-50%,-50%)',width:px(im.w),height:'auto',pointerEvents:edit?'auto':'none',userSelect:'none',WebkitUserDrag:'none',touchAction:'none',...selStyle('img:'+im.id)} as any}/>
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
  const [modeloAtivo, setModeloAtivo] = useState('encontrista')
  const [modelos, setModelos] = useState<Record<string,ModeloCfg>>(modelosPadrao())
  const [sel, setSel]         = useState<string>('')   // 'foto'|'nome'|'equipe'|'t:<id>'|'img:<id>'|''
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [subindo, setSubindo] = useState(false)
  const [msg, setMsg]         = useState('')
  const [imprimir, setImprimir] = useState(false)
  const [filtroTipo, setFiltroTipo]   = useState<'todos'|'encounterer'|'worker'>('encounterer')
  const [filtroEquipe, setFiltroEquipe] = useState('')
  const canEdit = isAdmin(profile?.user_role)

  const m = modelos[modeloAtivo] ?? modeloPadrao()
  const cfg = m.cfg

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
    if (cf.data) {
      const base = modelosPadrao()
      const camp:any = cf.data.campos || {}
      if (camp.modelos) {
        // formato novo (v2): configs por modelo
        for (const k of Object.keys(base)) if (camp.modelos[k]) base[k] = { ...base[k], ...camp.modelos[k], cfg:{ ...base[k].cfg, ...camp.modelos[k].cfg, textos:camp.modelos[k].cfg?.textos ?? [] }, imagens:camp.modelos[k].imagens ?? [] }
      } else if (Object.keys(camp).length) {
        // legado (v1): um único crachá -> vira o modelo Encontrista
        base.encontrista = { ...base.encontrista, tamanho:cf.data.tamanho||'grande', fundo:cf.data.fundo_url||'', cfg:{ ...CONFIG_PADRAO, ...camp, textos:camp.textos ?? [] }, imagens:[] }
      }
      setModelos(base)
    }
    setPessoas(pe.data ?? []); setEquipes(tm.data ?? [])
    const nomeEquipe: Record<string,string> = {}; (tm.data ?? []).forEach((t:any)=>{ nomeEquipe[t.id]=t.name })
    const nomes: Record<string,string[]> = {}; const ids: Record<string,string[]> = {}
    ;(pt.data ?? []).forEach((v:any)=>{ (ids[v.person_id]=ids[v.person_id]||[]).push(v.team_id); if(nomeEquipe[v.team_id]) (nomes[v.person_id]=nomes[v.person_id]||[]).push(nomeEquipe[v.team_id]) })
    const str: Record<string,string> = {}; Object.entries(nomes).forEach(([pid,arr])=>{ str[pid]=arr.join(' · ') })
    setEquipeDe(str); setEquipeIds(ids); setLoading(false)
  }

  // Troca de modelo: ajusta o filtro de quem entra
  function trocarModelo(key:string) {
    setModeloAtivo(key); setSel(''); setFiltroEquipe('')
    const rt = MODELOS.find(x=>x.key===key)?.rt
    setFiltroTipo(rt==='todos' ? 'todos' : (rt as any) ?? 'todos')
  }
  function restaurarPadrao() {
    if (!confirm('Restaurar este modelo para o padrão? Apaga fundo, PNGs e posições deste modelo.')) return
    setModelos(ms=>({...ms,[modeloAtivo]:modeloPadrao()})); setSel('')
  }

  async function salvar() {
    if (!evento) return
    setSalvando(true); setMsg('')
    const { error } = await supabase.from('crachas').upsert({
      event_id:evento.id, tamanho:m.tamanho==='custom'?'grande':m.tamanho, fundo_url:m.fundo||null,
      campos:{ modelos, _v:2 }, updated_at:new Date().toISOString(),
    }, { onConflict:'event_id' })
    setSalvando(false); setMsg(error?('Erro: '+error.message):'✓ Salvo!'); setTimeout(()=>setMsg(x=>x==='✓ Salvo!'?'':x),1500)
  }

  async function uploadArquivo(file:File, prefixo:string): Promise<string|null> {
    if (!evento) return null
    const ext=file.name.split('.').pop(); const path=`cracha/${evento.id}/${prefixo}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('arquivos').upload(path, file, { upsert:true })
    if (error) { setMsg('Erro ao subir: '+error.message); return null }
    const { data:u } = supabase.storage.from('arquivos').getPublicUrl(path)
    return u.publicUrl
  }
  async function uploadFundo(file:File) { setSubindo(true); const url=await uploadArquivo(file,'fundo'); if(url) updM({fundo:url}); setSubindo(false) }
  async function inserirImagem(file:File) {
    setSubindo(true); const url=await uploadArquivo(file,'png')
    if(url){ const id=Math.random().toString(36).slice(2,8); updM({imagens:[...m.imagens,{id,url,x:50,y:50,w:40}]}); setSel('img:'+id) }
    setSubindo(false)
  }

  // ===== helpers de edição (sempre no modelo ativo) =====
  function updM(patch: Partial<ModeloCfg>) { setModelos(ms=>({...ms,[modeloAtivo]:{...ms[modeloAtivo],...patch}})) }
  function updCfg(updater:(c:Config)=>Config) { setModelos(ms=>({...ms,[modeloAtivo]:{...ms[modeloAtivo],cfg:updater(ms[modeloAtivo].cfg)}})) }

  function move(k:string, x:number, y:number) {
    if (!canEdit) return
    if (k.startsWith('img:')) { const id=k.slice(4); updM({imagens:m.imagens.map(i=>i.id===id?{...i,x,y}:i)}); return }
    if (k.startsWith('t:')) { const id=k.slice(2); updCfg(c=>({...c,textos:c.textos.map(t=>t.id===id?{...t,x,y}:t)})); return }
    updCfg(c=>({ ...c, [k]:{ ...(c as any)[k], x, y } }))
  }
  function patchSel(patch:any) {
    if (!sel) return
    if (sel.startsWith('img:')) { const id=sel.slice(4); updM({imagens:m.imagens.map(i=>i.id===id?{...i,...patch}:i)}); return }
    if (sel.startsWith('t:')) { const id=sel.slice(2); updCfg(c=>({...c,textos:c.textos.map(t=>t.id===id?{...t,...patch}:t)})); return }
    updCfg(c=>({ ...c, [sel]:{ ...(c as any)[sel], ...patch } }))
  }
  function selObj():any {
    if(!sel) return null
    if(sel.startsWith('img:')) return m.imagens.find(i=>i.id===sel.slice(4))
    if(sel.startsWith('t:')) return cfg.textos.find(t=>t.id===sel.slice(2))
    return (cfg as any)[sel]
  }
  function addTexto() { const id=Math.random().toString(36).slice(2,8); updCfg(c=>({...c,textos:[...c.textos,{id,conteudo:'Texto',x:50,y:50,size:8,cor:'#111827',fonte:'Padrão'}]})); setSel('t:'+id) }
  function delTexto() { if(sel.startsWith('t:')){ const id=sel.slice(2); updCfg(c=>({...c,textos:c.textos.filter(t=>t.id!==id)})); setSel('') } }
  function delImagem() { if(sel.startsWith('img:')){ const id=sel.slice(4); updM({imagens:m.imagens.filter(i=>i.id!==id)}); setSel('') } }

  const pessoasFiltradas = pessoas.filter(p => {
    if (filtroTipo!=='todos' && p.role_type!==filtroTipo) return false
    if (filtroEquipe && !(equipeIds[p.id]??[]).includes(filtroEquipe)) return false
    return true
  })

  // Nome do crachá: 2 primeiros nomes; se dois baterem, acrescenta o próximo até diferenciar
  // (ex.: "Ana Clara Martins" e "Ana Clara Freitas"). HOOK: fica ANTES de qualquer return.
  const nomeCracha = useMemo(() => {
    const pre = (nm: string, n: number) => (nm || '').trim().split(/\s+/).filter(Boolean).slice(0, n).join(' ').toLowerCase()
    const base = pessoasFiltradas.length ? pessoasFiltradas : pessoas
    const map: Record<string, string> = {}
    for (const p of base) {
      const w = (p.name || '').trim().split(/\s+/).filter(Boolean)
      let n = Math.min(2, w.length)
      while (n < w.length && base.some(o => o.id !== p.id && pre(o.name, n) === pre(p.name, n))) n++
      map[p.id] = w.slice(0, n).join(' ')
    }
    return map
  }, [pessoasFiltradas, pessoas])

  if (evLoading || loading) return <div className="page">{[1,2].map(i=><div key={i} className="skeleton" style={{height:120,marginBottom:12,borderRadius:14}}/>)}</div>
  if (!evento) return <div className="page"><div className="empty"><p className="empty-title">Nenhum evento ativo</p></div></div>

  const amostra = pessoasFiltradas[0] ?? pessoas[0] ?? { id:'x', name:'Nome da Pessoa', photo_url:null }

  if (imprimir) {
    return (
      <div style={{padding:16,background:'white'}}>
        <style>{`
          @media print {
            /* solta a "gaiola" do app (main tem overflow:auto e cortava tudo na 1a folha) */
            html, body, #root, .app-root, .app-root > main { height:auto !important; max-height:none !important; overflow:visible !important; display:block !important; background:#fff !important; }
            .app-root > header { display:none !important; }
            .no-print { display:none !important; }
            /* NÃO corta um crachá no meio entre as folhas */
            .cracha-item { break-inside:avoid; page-break-inside:avoid; }
            /* imprime as CORES e as imagens de fundo */
            * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
            @page { margin:8mm; }
          }
        `}</style>
        <div className="no-print" style={{display:'flex',gap:8,marginBottom:8}}>
          <button className="btn btn-primary" onClick={()=>window.print()}>Imprimir / Salvar PDF</button>
          <button className="btn btn-ghost" onClick={()=>setImprimir(false)}>Voltar</button>
        </div>
        <p className="no-print" style={{fontSize:12,color:'var(--muted)',marginBottom:16}}>Modelo: {MODELOS.find(x=>x.key===modeloAtivo)?.label}. {pessoasFiltradas.length} crachá(s).</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:12,alignContent:'flex-start'}}>
          {pessoasFiltradas.map(p => <div key={p.id} className="cracha-item"><CrachaView pessoa={{...p, name: nomeCracha[p.id] ?? p.name}} equipeTxt={equipeDe[p.id]??''} m={m}/></div>)}
        </div>
      </div>
    )
  }

  const s = selObj()
  const ehImg = sel.startsWith('img:')
  const selLabel = sel==='foto'?'Foto':sel==='nome'?'Nome':sel==='equipe'?'Equipe':sel.startsWith('t:')?'Texto livre':ehImg?'Imagem (PNG)':''

  return (
    <div className="page">
      {/* Barra de modelos no topo */}
      <div style={{display:'flex',gap:6,marginBottom:12,background:'var(--bg)',padding:4,borderRadius:10}}>
        {MODELOS.map(mo=>(
          <button key={mo.key} onClick={()=>trocarModelo(mo.key)}
            style={{flex:1,padding:'8px 4px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700,border:'none',
              background:modeloAtivo===mo.key?'var(--primary)':'transparent',color:modeloAtivo===mo.key?'white':'var(--text2)'}}>
            {mo.label}
          </button>
        ))}
      </div>

      <p style={{fontSize:12,color:'var(--muted)',marginBottom:8}}>Arraste os elementos no crachá para posicionar. Toque para selecionar e editar abaixo.</p>
      <div style={{display:'flex',justifyContent:'center',marginBottom:14,padding:12,background:'var(--bg)',borderRadius:12}}>
        <CrachaView pessoa={{...amostra, name: nomeCracha[amostra.id] ?? amostra.name}} equipeTxt={equipeDe[amostra.id]??'Equipe'} m={m} edit={canEdit} sel={sel} onSelect={setSel} onMove={move} exibirEm={{maxW:210, maxH:350}}/>
      </div>

      {/* Controles do elemento selecionado */}
      {sel && s && (
        <div style={{border:'1px solid var(--primary)',borderRadius:10,padding:'12px',marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <span style={{flex:1,fontSize:13,fontWeight:800,color:'var(--primary)'}}>{selLabel} selecionado</span>
            {'on' in s && !sel.startsWith('t:') && !ehImg && <button className="btn btn-ghost btn-sm" onClick={()=>patchSel({on:!s.on})}>{s.on?'Ocultar':'Mostrar'}</button>}
            {sel.startsWith('t:') && <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={delTexto}>Remover</button>}
            {ehImg && <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={delImagem}>Remover</button>}
          </div>
          {sel.startsWith('t:') && (
            <div className="form-group"><label className="form-label">Texto</label>
              <input className="form-input" value={s.conteudo} onChange={e=>patchSel({conteudo:e.target.value})} placeholder="Digite o texto"/>
            </div>
          )}
          {/* Formato da foto */}
          {sel==='foto' && (
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              {([['redondo','Redondo'],['quadrado','Quadrado 3×4']] as const).map(([v,l])=>(
                <button key={v} className="btn btn-sm" onClick={()=>patchSel({formato:v})}
                  style={{flex:1,border:cfg.foto.formato===v?'2px solid var(--primary)':'1px solid var(--border)',background:cfg.foto.formato===v?'var(--primary-light)':'white',color:cfg.foto.formato===v?'var(--primary)':'var(--text2)'}}>{l}</button>
              ))}
            </div>
          )}
          {/* Tamanho / largura */}
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <span style={{fontSize:12,color:'var(--muted)'}}>{ehImg?'Largura':'Tamanho'}</span>
            <button className="btn btn-outline btn-sm" onClick={()=>patchSel(ehImg?{w:Math.max(5,s.w-2)}:{size:Math.max(4,s.size-1)})}>−</button>
            <span style={{minWidth:28,textAlign:'center',fontWeight:700}}>{ehImg?s.w:s.size}</span>
            <button className="btn btn-outline btn-sm" onClick={()=>patchSel(ehImg?{w:Math.min(100,s.w+2)}:{size:Math.min(80,s.size+1)})}>+</button>
          </div>
          {/* Largura da CAIXA de texto (onde o nome quebra a linha) — só p/ texto/nome/equipe */}
          {!ehImg && sel!=='foto' && (
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <span style={{fontSize:12,color:'var(--muted)'}}>Largura da caixa</span>
              <button className="btn btn-outline btn-sm" onClick={()=>patchSel({largura:Math.max(20,(s.largura??92)-4)})}>−</button>
              <span style={{minWidth:36,textAlign:'center',fontWeight:700}}>{s.largura??92}%</span>
              <button className="btn btn-outline btn-sm" onClick={()=>patchSel({largura:Math.min(100,(s.largura??92)+4)})}>+</button>
              <input type="range" min={20} max={100} value={s.largura??92} onChange={e=>patchSel({largura:Number(e.target.value)})} style={{flex:1}}/>
            </div>
          )}
          {/* Fonte/estilo/cor (texto/nome/equipe) */}
          {!ehImg && sel!=='foto' && (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1}}>
                <Seletor titulo="Fonte" placeholder="Fonte" sheet
                  value={s.fonte??'Padrão'} onChange={v=>patchSel({fonte:v})}
                  opcoes={FONTES.map(f=>({value:f, label:f}))}/>
              </div>
              {([['negrito','B',{fontWeight:800}],['italico','I',{fontStyle:'italic'}],['sublinhado','S',{textDecoration:'underline'}]] as const).map(([prop,lab,st])=>{
                const on=(s as any)[prop]
                return <button key={prop} type="button" onClick={()=>patchSel({[prop]:!on})} style={{width:34,height:34,borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:14,...st,border:on?'2px solid var(--primary)':'1px solid var(--border)',background:on?'var(--primary-light)':'white',color:on?'var(--primary)':'var(--text2)'}}>{lab}</button>
              })}
              <input type="color" value={s.cor??'#111827'} onChange={e=>patchSel({cor:e.target.value})} style={{width:34,height:34,border:'1px solid var(--border)',borderRadius:8}}/>
            </div>
          )}
        </div>
      )}

      {canEdit && (
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          <button className="btn btn-ghost btn-sm" style={{flex:1}} onClick={addTexto}><span className="icon icon-sm">add</span> Texto livre</button>
          <label className="btn btn-ghost btn-sm" style={{flex:1,cursor:'pointer',border:'1px dashed var(--primary)',color:'var(--primary)'}}>
            <span className="icon icon-sm">image</span> {subindo?'...':'Inserir PNG'}
            <input type="file" accept="image/png,image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0]; if(f) inserirImagem(f); e.target.value=''}}/>
          </label>
        </div>
      )}

      {/* Tamanho do crachá */}
      <div className="form-group">
        <label className="form-label">Tamanho do crachá</label>
        <Seletor titulo="Tamanho do crachá" placeholder="Selecionar tamanho" disabled={!canEdit}
          value={m.tamanho} onChange={v=>updM({tamanho:v})}
          opcoes={[...Object.entries(TAMANHOS).map(([k,v])=>({value:k, label:v.label})), {value:'custom', label:'Personalizar tamanho...'}]}/>
      </div>
      {m.tamanho==='custom' && (
        <div style={{display:'flex',gap:8,alignItems:'flex-end',marginBottom:12}}>
          <div style={{flex:1}}>
            <label className="form-label">Largura</label>
            <input className="form-input" type="number" min="1" step="0.1" value={m.cw} disabled={!canEdit} onChange={e=>updM({cw:Number(e.target.value)||1})}/>
          </div>
          <div style={{flex:1}}>
            <label className="form-label">Altura</label>
            <input className="form-input" type="number" min="1" step="0.1" value={m.ch} disabled={!canEdit} onChange={e=>updM({ch:Number(e.target.value)||1})}/>
          </div>
          <div style={{flex:1}}>
            <label className="form-label">Unidade</label>
            <Seletor titulo="Unidade" disabled={!canEdit}
              value={m.unidade} onChange={v=>updM({unidade:v as any})}
              opcoes={[{value:'mm',label:'mm'},{value:'cm',label:'cm'},{value:'px',label:'px'}]}/>
          </div>
        </div>
      )}

      {/* Imagem de fundo */}
      <div className="form-group">
        <label className="form-label">Imagem de fundo</label>
        <p className="form-hint mb-2">Faça a arte fora (Canva, etc.). Cole o link OU envie a imagem.</p>
        <input className="form-input" value={m.fundo} disabled={!canEdit} onChange={e=>updM({fundo:e.target.value})} placeholder="https://... (link da imagem)"/>
        {canEdit && (
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <label className="btn btn-ghost btn-sm" style={{cursor:'pointer',border:'1px dashed var(--primary)',color:'var(--primary)'}}>
              <span className="icon icon-sm">upload</span> {subindo?'Enviando...':'Enviar imagem'}
              <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0]; if(f) uploadFundo(f); e.target.value=''}}/>
            </label>
            {m.fundo && <button type="button" className="btn btn-ghost btn-sm" onClick={()=>updM({fundo:''})} style={{color:'var(--danger)'}}>Remover fundo</button>}
          </div>
        )}
      </div>

      {/* Filtro de equipes — só faz sentido para Encontreiros */}
      {filtroTipo==='worker' && (
        <div className="form-group">
          <label className="form-label">Filtrar por equipe</label>
          <Seletor titulo="Filtrar por equipe" placeholder="Todas as equipes"
            value={filtroEquipe} onChange={v=>setFiltroEquipe(v)}
            opcoes={[{value:'',label:'Todas as equipes'}, ...equipes.map(eq=>({value:eq.id,label:eq.name}))]}/>
        </div>
      )}

      {canEdit && <button className="btn btn-ghost btn-full btn-sm mb-2" onClick={restaurarPadrao} style={{color:'var(--danger)'}}><span className="icon icon-sm">restart_alt</span> Restaurar padrão deste modelo</button>}
      {canEdit && <button className="btn btn-primary btn-full" onClick={salvar} disabled={salvando}>{salvando?'Salvando...':'Salvar configuração'}</button>}
      {msg && <p style={{fontSize:12,textAlign:'center',marginTop:8,color:msg.startsWith('Erro')?'var(--danger)':'var(--success)'}}>{msg}</p>}
      <button className="btn btn-outline btn-full" onClick={()=>setImprimir(true)} disabled={pessoasFiltradas.length===0} style={{marginTop:10}}>
        <span className="icon icon-sm">print</span> Gerar crachás ({pessoasFiltradas.length}) — imprimir / PDF
      </button>
    </div>
  )
}
