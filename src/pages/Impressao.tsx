import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import { carregarConfig, salvarConfig } from '../lib/tema'
import { getInitials, isAdmin } from '../utils'
import { toast } from '../components/Toast'
import type { Profile } from '../App'

// #Impressão — listas configuráveis de pessoas (nome + foto) em GRADE (A4 deitada) ou TIRA.
// Modelos salvos e reutilizáveis. Separado do Crachá.

type Pessoa = { id:string; name:string; photo_url:string|null; role_type?:string|null }
type Cfg = {
  tipo:'grade'|'tira'|'pagina'   // pagina = 1 pessoa por folha
  fotoOn:boolean; fotoTam:number; fotoRedonda:boolean
  nomes:number            // base de nomes (1 ou 2) — a regra do 3º completa quando repete
  nomeTam:number          // tamanho da letra do nome (px)
  nomePos:'baixo'|'cima'  // nome abaixo ou acima da foto
  colunas:number          // grade: colunas por folha
  corFundo:string; corTexto:string; corBorda:string
}
type Modelo = { id:string; nome:string; cfg:Cfg }

const CFG_PADRAO: Cfg = { tipo:'grade', fotoOn:true, fotoTam:74, fotoRedonda:true, nomes:2, nomeTam:14, nomePos:'baixo', colunas:4, corFundo:'#ffffff', corTexto:'#111827', corBorda:'#e5e7eb' }
const CORES = ['#ffffff','#F3F4F6','#1E2D4D','#00A99D','#2B6CB0','#6B46C1','#2F855A','#C53030','#D69E2E','#111827']

export default function Impressao({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const { pode } = usePermissao(profile ?? null)
  const canEdit = isAdmin(profile?.user_role) || pode('impressao','editar')

  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [equipes, setEquipes] = useState<{id:string;name:string}[]>([])
  const [equipeIds, setEquipeIds] = useState<Record<string,string[]>>({})
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<'todos'|'encounterer'|'worker'>('encounterer')
  const [filtroEquipe, setFiltroEquipe] = useState('')

  const [cfg, setCfg] = useState<Cfg>(CFG_PADRAO)
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [modeloAtual, setModeloAtual] = useState<string>('')  // id do modelo carregado
  const [imprimir, setImprimir] = useState(false)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])
  useEffect(() => { carregarConfig('impressao_modelos').then(v => { if (v) { try { setModelos(JSON.parse(v)) } catch {} } }) }, [])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [pe, tm, pt] = await Promise.all([
      supabase.from('people').select('id,name,photo_url,role_type').eq('event_id',evento.id).order('name'),
      supabase.from('teams').select('id,name').eq('event_id',evento.id).order('name'),
      supabase.from('people_teams').select('person_id,team_id'),
    ])
    setPessoas(pe.data ?? [])
    setEquipes(tm.data ?? [])
    const ids: Record<string,string[]> = {}
    ;(pt.data ?? []).forEach((v:any)=>{ (ids[v.person_id]=ids[v.person_id]||[]).push(v.team_id) })
    setEquipeIds(ids)
    setLoading(false)
  }

  const lista = pessoas.filter(p => {
    if (filtroTipo!=='todos' && p.role_type!==filtroTipo) return false
    if (filtroEquipe && !(equipeIds[p.id]??[]).includes(filtroEquipe)) return false
    return true
  })

  // Nome: começa com `nomes` (1 ou 2); se dois baterem, acrescenta o próximo até diferenciar.
  const nomeDe = useMemo(() => {
    const pre = (nm:string, n:number) => (nm||'').trim().split(/\s+/).filter(Boolean).slice(0,n).join(' ').toLowerCase()
    const map: Record<string,string> = {}
    for (const p of lista) {
      const w = (p.name||'').trim().split(/\s+/).filter(Boolean)
      let n = Math.min(cfg.nomes, w.length)
      while (n < w.length && lista.some(o => o.id!==p.id && pre(o.name,n)===pre(p.name,n))) n++
      map[p.id] = w.slice(0,n).join(' ')
    }
    return map
  }, [lista, cfg.nomes])

  const set = (patch: Partial<Cfg>) => { setCfg(c => ({ ...c, ...patch })); setModeloAtual('') }

  async function salvarModelos(novos: Modelo[]) { setModelos(novos); await salvarConfig('impressao_modelos', JSON.stringify(novos)) }
  async function salvarModelo() {
    const nome = prompt('Nome do modelo:', modelos.find(m=>m.id===modeloAtual)?.nome || 'Meu modelo')
    if (!nome) return
    const existe = modelos.find(m => m.id===modeloAtual)
    let novos: Modelo[]
    if (existe) novos = modelos.map(m => m.id===existe.id ? { ...m, nome, cfg } : m)
    else { const id = 'm'+Date.now(); novos = [...modelos, { id, nome, cfg }]; setModeloAtual(id) }
    await salvarModelos(novos)
    toast.sucesso('Modelo salvo!')
  }
  function carregarModelo(id:string) { const m = modelos.find(x=>x.id===id); if (m) { setCfg(m.cfg); setModeloAtual(id) } }
  async function excluirModelo(id:string) { if (!confirm('Excluir este modelo?')) return; await salvarModelos(modelos.filter(m=>m.id!==id)); if (modeloAtual===id) setModeloAtual('') }

  // ---------- Cartão de uma pessoa ----------
  const Cartao = ({ p, grande=false }: { p: Pessoa; grande?:boolean }) => {
    const ft = grande ? cfg.fotoTam*3.4 : cfg.fotoTam
    const fotoStyle: React.CSSProperties = { width:ft, height:cfg.fotoRedonda?ft:ft*1.25, borderRadius:cfg.fotoRedonda?'50%':10, objectFit:'cover', flexShrink:0, background:'#e5e7eb' }
    const foto = cfg.fotoOn && (
      p.photo_url
        ? <img src={p.photo_url} alt="" style={fotoStyle}/>
        : <div style={{...fotoStyle, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#6b7280', fontSize:ft*0.34}}>{getInitials(p.name)}</div>
    )
    const nomeSz = grande ? cfg.nomeTam*2.4 : cfg.nomeTam
    const nome = <span style={{fontWeight:700, fontSize:nomeSz, color:cfg.corTexto, lineHeight:1.2, textAlign:cfg.tipo==='tira'?'left':'center'}}>{nomeDe[p.id] ?? p.name}</span>
    if (cfg.tipo==='tira') {
      return <div className="imp-item" style={{display:'flex', alignItems:'center', gap:12, padding:'8px 12px', background:cfg.corFundo, border:`1px solid ${cfg.corBorda}`, borderRadius:8}}>{foto}{nome}</div>
    }
    const corpo = cfg.nomePos==='cima' ? <>{nome}{foto}</> : <>{foto}{nome}</>
    return <div className="imp-item" style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:grande?22:8, padding:grande?24:'12px 8px', background:cfg.corFundo, border:`1px solid ${cfg.corBorda}`, borderRadius:grande?16:10, ...(grande?{minHeight:'90vh'}:{})}}>{corpo}</div>
  }

  if (evLoading || loading) return <div className="page">{[1,2].map(i=><div key={i} className="skeleton" style={{height:110,marginBottom:12,borderRadius:14}}/>)}</div>
  if (!evento) return <div className="page"><div className="empty"><p className="empty-title">Nenhum evento ativo</p></div></div>

  // ---------- MODO IMPRESSÃO (A4 deitada) ----------
  if (imprimir) {
    return (
      <div style={{padding:16, background:'white'}}>
        <style>{`
          @media print {
            html, body, #root, .app-root, .app-root > main { height:auto !important; max-height:none !important; overflow:visible !important; display:block !important; background:#fff !important; }
            .app-root > header { display:none !important; }
            .no-print { display:none !important; }
            .imp-item { break-inside:avoid; page-break-inside:avoid; }
            .imp-pagina .imp-item { break-after: page; page-break-after: always; }
            * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
            @page { size: ${cfg.tipo==='pagina'?'A4 portrait':'A4 landscape'}; margin: 8mm; }
          }
        `}</style>
        <div className="no-print" style={{display:'flex', gap:8, marginBottom:10}}>
          <button className="btn btn-primary" onClick={()=>window.print()}>Imprimir / Salvar PDF</button>
          <button className="btn btn-ghost" onClick={()=>setImprimir(false)}>Voltar</button>
        </div>
        <p className="no-print" style={{fontSize:12, color:'var(--muted)', marginBottom:12}}>{cfg.tipo==='grade'?'Grade':cfg.tipo==='tira'?'Tira':'1 por folha'} · {lista.length} pessoa(s) · {cfg.tipo==='pagina'?'A4 em pé':'A4 deitada'}.</p>
        {cfg.tipo==='pagina'
          ? <div className="imp-pagina">{lista.map(p=><Cartao key={p.id} p={p} grande/>)}</div>
          : cfg.tipo==='grade'
            ? <div style={{display:'grid', gridTemplateColumns:`repeat(${cfg.colunas}, 1fr)`, gap:10}}>{lista.map(p=><Cartao key={p.id} p={p}/>)}</div>
            : <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>{lista.map(p=><Cartao key={p.id} p={p}/>)}</div>}
      </div>
    )
  }

  // ---------- EDITOR ----------
  return (
    <div className="page">
      {/* Modelos salvos */}
      <div style={{background:'var(--bg)', borderRadius:12, padding:'12px 14px', marginBottom:14}}>
        <p style={{fontSize:11, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8}}>Modelos salvos</p>
        {modelos.length===0 ? <p style={{fontSize:13, color:'var(--muted)'}}>Nenhum modelo ainda. Configure abaixo e toque em "Salvar modelo".</p> : (
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {modelos.map(m => (
              <div key={m.id} style={{display:'flex', alignItems:'center', gap:4, background: modeloAtual===m.id?'var(--primary)':'white', color: modeloAtual===m.id?'white':'var(--text)', border:'1px solid var(--border)', borderRadius:99, padding:'5px 6px 5px 12px'}}>
                <button onClick={()=>carregarModelo(m.id)} style={{background:'none', border:'none', cursor:'pointer', color:'inherit', fontFamily:'inherit', fontWeight:700, fontSize:13}}>{m.nome}</button>
                {canEdit && <button onClick={()=>excluirModelo(m.id)} title="Excluir" style={{background:'none', border:'none', cursor:'pointer', color:'inherit', opacity:0.7, display:'flex'}}><span className="icon icon-sm">close</span></button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tipo */}
      <div style={{display:'flex', gap:6, marginBottom:14, background:'var(--bg)', padding:4, borderRadius:10}}>
        {([['grade','▦ Grade'],['tira','▤ Tira'],['pagina','▢ 1 por folha']] as const).map(([v,l])=>(
          <button key={v} onClick={()=>set({tipo:v})} style={{flex:1, padding:'9px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:13, background: cfg.tipo===v?'var(--primary)':'transparent', color: cfg.tipo===v?'white':'var(--text2)'}}>{l}</button>
        ))}
      </div>

      {/* Configurações */}
      <div style={{background:'white', borderRadius:12, boxShadow:'var(--shadow-sm)', padding:'14px 16px', marginBottom:14, display:'flex', flexDirection:'column', gap:14}}>
        {/* Foto */}
        <Linha label="Mostrar foto"><Toggle on={cfg.fotoOn} onClick={()=>set({fotoOn:!cfg.fotoOn})}/></Linha>
        {cfg.fotoOn && <>
          <Linha label={`Tamanho da foto (${cfg.fotoTam}px)`}><input type="range" min={40} max={120} value={cfg.fotoTam} onChange={e=>set({fotoTam:Number(e.target.value)})} style={{flex:1}}/></Linha>
          <Linha label="Formato da foto">
            <div style={{display:'flex', gap:6}}>
              {([['redonda','Redonda',true],['quadrada','Quadrada',false]] as const).map(([k,l,r])=>(
                <button key={k} onClick={()=>set({fotoRedonda:r})} className="btn btn-sm" style={{border: cfg.fotoRedonda===r?'2px solid var(--primary)':'1px solid var(--border)', background: cfg.fotoRedonda===r?'var(--primary-light)':'white', color: cfg.fotoRedonda===r?'var(--primary)':'var(--text2)'}}>{l}</button>
              ))}
            </div>
          </Linha>
        </>}
        {/* Nome */}
        <Linha label="Nomes mostrados">
          <div style={{display:'flex', gap:6}}>
            {[1,2].map(n=>(
              <button key={n} onClick={()=>set({nomes:n})} className="btn btn-sm" style={{border: cfg.nomes===n?'2px solid var(--primary)':'1px solid var(--border)', background: cfg.nomes===n?'var(--primary-light)':'white', color: cfg.nomes===n?'var(--primary)':'var(--text2)'}}>{n===1?'1º nome':'1º e 2º'}</button>
            ))}
          </div>
        </Linha>
        <p style={{fontSize:11, color:'var(--muted)', marginTop:-8}}>Se dois ficarem iguais, o app acrescenta o próximo nome automaticamente (ex.: Ana Clara <b>Martins</b> / Ana Clara <b>Freitas</b>).</p>
        {/* Letra: tamanho e posição */}
        <Linha label={`Tamanho da letra (${cfg.nomeTam}px)`}><input type="range" min={8} max={40} value={cfg.nomeTam} onChange={e=>set({nomeTam:Number(e.target.value)})} style={{flex:1}}/></Linha>
        {cfg.tipo!=='tira' && cfg.fotoOn && (
          <Linha label="Posição do nome">
            <div style={{display:'flex', gap:6}}>
              {([['baixo','Abaixo da foto'],['cima','Acima da foto']] as const).map(([k,l])=>(
                <button key={k} onClick={()=>set({nomePos:k})} className="btn btn-sm" style={{border: cfg.nomePos===k?'2px solid var(--primary)':'1px solid var(--border)', background: cfg.nomePos===k?'var(--primary-light)':'white', color: cfg.nomePos===k?'var(--primary)':'var(--text2)'}}>{l}</button>
              ))}
            </div>
          </Linha>
        )}
        {/* Grade colunas */}
        {cfg.tipo==='grade' && <Linha label={`Colunas por folha (${cfg.colunas})`}><input type="range" min={2} max={8} value={cfg.colunas} onChange={e=>set({colunas:Number(e.target.value)})} style={{flex:1}}/></Linha>}
        {/* Cores */}
        <Linha label="Cor de fundo"><Cores val={cfg.corFundo} onPick={c=>set({corFundo:c})}/></Linha>
        <Linha label="Cor do texto"><Cores val={cfg.corTexto} onPick={c=>set({corTexto:c})}/></Linha>
      </div>

      {/* Filtro de quem entra */}
      <div style={{background:'white', borderRadius:12, boxShadow:'var(--shadow-sm)', padding:'12px 14px', marginBottom:14}}>
        <p style={{fontSize:11, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8}}>Quem entra na lista</p>
        <div style={{display:'flex', gap:6, marginBottom:8, flexWrap:'wrap'}}>
          {([['encounterer','Encontristas'],['worker','Encontreiros'],['todos','Todos']] as const).map(([v,l])=>(
            <button key={v} onClick={()=>setFiltroTipo(v)} className="btn btn-sm" style={{border: filtroTipo===v?'2px solid var(--primary)':'1px solid var(--border)', background: filtroTipo===v?'var(--primary-light)':'white', color: filtroTipo===v?'var(--primary)':'var(--text2)'}}>{l}</button>
          ))}
        </div>
        <select className="form-input" value={filtroEquipe} onChange={e=>setFiltroEquipe(e.target.value)}>
          <option value="">Todas as equipes</option>
          {equipes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Prévia */}
      <p style={{fontSize:11, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8}}>Prévia ({lista.length})</p>
      <div style={{background:'var(--bg)', borderRadius:12, padding:12, marginBottom:14}}>
        {cfg.tipo==='pagina'
          ? <div style={{display:'flex', justifyContent:'center'}}>{lista.slice(0,1).map(p=><Cartao key={p.id} p={p}/>)}</div>
          : cfg.tipo==='grade'
            ? <div style={{display:'grid', gridTemplateColumns:`repeat(${Math.min(cfg.colunas,4)}, 1fr)`, gap:8}}>{lista.slice(0,8).map(p=><Cartao key={p.id} p={p}/>)}</div>
            : <div style={{display:'flex', flexDirection:'column', gap:8}}>{lista.slice(0,5).map(p=><Cartao key={p.id} p={p}/>)}</div>}
        {lista.length===0 && <p style={{fontSize:13, color:'var(--muted)', textAlign:'center', padding:12}}>Ninguém neste filtro.</p>}
      </div>

      {/* Ações */}
      <div style={{display:'flex', gap:8}}>
        <button className="btn btn-primary" style={{flex:1}} onClick={()=>setImprimir(true)} disabled={lista.length===0}>
          <span className="icon icon-sm">print</span> Imprimir ({cfg.tipo==='pagina'?'A4 em pé, 1 por folha':'A4 deitada'})
        </button>
        {canEdit && <button className="btn btn-ghost" onClick={salvarModelo}><span className="icon icon-sm">bookmark_add</span> Salvar modelo</button>}
      </div>
    </div>
  )
}

// ---------- pecinhas ----------
function Linha({ label, children }: { label:string; children:React.ReactNode }) {
  return <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}><span style={{fontSize:13, color:'var(--text2)', flexShrink:0}}>{label}</span>{children}</div>
}
function Toggle({ on, onClick }: { on:boolean; onClick:()=>void }) {
  return <div onClick={onClick} style={{width:44, height:24, borderRadius:99, background: on?'var(--primary)':'var(--border)', position:'relative', cursor:'pointer', flexShrink:0}}><span style={{position:'absolute', top:2, left: on?22:2, width:20, height:20, borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/></div>
}
function Cores({ val, onPick }: { val:string; onPick:(c:string)=>void }) {
  return <div style={{display:'flex', gap:5, flexWrap:'wrap', justifyContent:'flex-end'}}>
    {CORES.map(c=><button key={c} onClick={()=>onPick(c)} aria-label={c} style={{width:24, height:24, borderRadius:6, background:c, border: val===c?'2px solid var(--primary)':'1px solid var(--border)', cursor:'pointer'}}/>)}
    <input type="color" value={val} onChange={e=>onPick(e.target.value)} style={{width:28, height:24, borderRadius:6, border:'1px solid var(--border)', cursor:'pointer', padding:1}}/>
  </div>
}
