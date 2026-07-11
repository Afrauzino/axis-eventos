// Painel de análises (Administração) — Fase 1.
// Pensado como APRESENTAÇÃO (TV/notebook), modular (liga/desliga por card),
// tempo real (recarrega a cada 30s). Acesso: admin OU liberação 'painel' (ver),
// escolhida DENTRO desta tela. Números são reais (people, financeiro, escalas…).
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { isAdmin, getInitials, formatName, fmtBRL, normalizarNome } from '../utils'
import { toast } from '../components/Toast'
import type { Profile } from '../App'

type Pessoa = { id:string; name:string; photo_url:string|null; role_type:string|null; user_id:string|null; created_at:string|null }
type Team = { id:string; name:string; color:string }

// Cards disponíveis (liga/desliga fica no aparelho).
const CARDS = [
  { key:'acessos',   nome:'Acessos' },
  { key:'cadastros', nome:'Cadastros' },
  { key:'financeiro',nome:'Financeiro' },
  { key:'escalas',   nome:'Escalas' },
  { key:'equipes',   nome:'Escalas por equipe' },
  { key:'grafcad',   nome:'Gráfico: cadastros/dia' },
  { key:'tipos',     nome:'Gráfico: tipos' },
]
const CHAVE_OFF = 'painel_cards_off'

export default function PainelAnalises({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const { pode, carregado } = usePermissao(profile ?? null)
  const admin = (!!profile && isAdmin(profile.user_role)) || !!profile?.is_admin
  const podeVer = admin || pode('painel','ver')

  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [lastSeen, setLastSeen] = useState<Record<string, string|null>>({})   // user_id -> last_seen
  const [pagamentos, setPagamentos] = useState<{valor:number;status:string}[]>([])
  const [escalas, setEscalas] = useState<{team_id:string|null;status:string}[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  const [off, setOff] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem(CHAVE_OFF) || '[]')) } catch { return new Set() } })
  const [modalCards, setModalCards] = useState(false)
  const [modalAcesso, setModalAcesso] = useState(false)
  useVoltarFecha(modalCards, () => setModalCards(false))
  useVoltarFecha(modalAcesso, () => setModalAcesso(false))

  useEffect(() => { if (evLoading || !podeVer) return; carregar(); const t = setInterval(carregar, 30000); return () => clearInterval(t) }, [evento?.id, evLoading, podeVer])

  async function carregar() {
    if (!evento) { setLoading(false); return }
    const [pe, fin, esc, tm] = await Promise.all([
      supabase.from('people').select('id,name,photo_url,role_type,user_id,created_at').eq('event_id', evento.id),
      supabase.from('financeiro').select('valor,status').eq('event_id', evento.id),
      supabase.from('escalas').select('team_id,status').eq('event_id', evento.id),
      supabase.from('teams').select('id,name,color').eq('event_id', evento.id),
    ])
    const ps = pe.data ?? []
    setPessoas(ps)
    setPagamentos((fin.data as any) ?? [])
    setEscalas((esc.data as any) ?? [])
    setTeams((tm.data as any) ?? [])
    // last_seen dos que têm conta
    const uids = ps.map(p=>p.user_id).filter(Boolean) as string[]
    if (uids.length) {
      const { data: pr } = await supabase.from('profiles').select('user_id,last_seen').in('user_id', uids)
      const map: Record<string,string|null> = {}; (pr ?? []).forEach((r:any)=>{ map[r.user_id]=r.last_seen })
      setLastSeen(map)
    }
    setLoading(false)
  }

  function toggleCard(k: string) {
    setOff(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); try { localStorage.setItem(CHAVE_OFF, JSON.stringify([...n])) } catch {}; return n })
  }
  const mostra = (k: string) => !off.has(k)

  // ---- métricas ----
  const m = useMemo(() => {
    const total = pessoas.length
    const comConta = pessoas.filter(p=>p.user_id).length
    const encontristas = pessoas.filter(p=>p.role_type==='encounterer').length
    const encontreiros = pessoas.filter(p=>p.role_type==='worker').length
    const agora = Date.now()
    let online = 0, hoje = 0
    const hojeIni = new Date(); hojeIni.setHours(0,0,0,0)
    for (const p of pessoas) {
      const ls = p.user_id ? lastSeen[p.user_id] : null
      if (!ls) continue
      const t = new Date(ls).getTime()
      if (agora - t < 5*60000) online++
      if (t >= hojeIni.getTime()) hoje++
    }
    const arrecadado = pagamentos.filter(p=>p.status==='pago').reduce((s,p)=>s+(p.valor||0),0)
    const escTotal = escalas.length
    const escConcl = escalas.filter(e=>e.status==='concluido').length
    const escPct = escTotal ? Math.round(escConcl/escTotal*100) : 0
    // escalas por equipe
    const porEq = teams.map(t => {
      const arr = escalas.filter(e=>e.team_id===t.id)
      const c = arr.filter(e=>e.status==='concluido').length
      return { team:t, total:arr.length, concl:c, pct: arr.length ? Math.round(c/arr.length*100) : 0 }
    }).filter(x=>x.total>0).sort((a,b)=>b.pct-a.pct)
    // cadastros por dia (últimos 7)
    const dias: {label:string;n:number}[] = []
    for (let i=6;i>=0;i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i)
      const key = d.toISOString().slice(0,10)
      const n = pessoas.filter(p=>(p.created_at||'').slice(0,10)===key).length
      dias.push({ label: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`, n })
    }
    return { total, comConta, semConta: total-comConta, encontristas, encontreiros, online, hoje, arrecadado, escTotal, escConcl, escPct, porEq, dias }
  }, [pessoas, lastSeen, pagamentos, escalas, teams])

  if (evLoading || (loading && podeVer)) return <div className="page">{[1,2].map(i=><div key={i} className="skeleton" style={{height:120,marginBottom:12,borderRadius:14}}/>)}</div>
  if (!carregado) return <div className="page"><div className="skeleton" style={{height:120,borderRadius:14}}/></div>
  if (!podeVer) return <div className="page"><div className="empty"><p className="empty-title">Acesso restrito</p><p className="empty-desc">Só quem tem liberação do Painel entra aqui.</p></div></div>
  if (!evento) return <div className="page"><div className="empty"><p className="empty-title">Nenhum evento ativo</p></div></div>

  const maxCad = Math.max(1, ...m.dias.map(d=>d.n))

  return (
    <div style={{ padding:'14px 16px 60px', maxWidth:1400, margin:'0 auto' }}>
      {/* Cabeçalho */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,marginBottom:16}}>
        <div>
          <p style={{fontSize:20,fontWeight:800}}>Painel · {evento.name}</p>
          <p style={{fontSize:12,color:'var(--muted)'}}>atualiza sozinho a cada 30s</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,fontWeight:700,padding:'6px 12px',borderRadius:99,background:'var(--success-bg)',color:'var(--success)'}}><span style={{width:8,height:8,borderRadius:'50%',background:'var(--success)'}}/>{m.online} online</span>
          <button onClick={()=>setModalCards(true)} className="btn btn-ghost btn-sm"><span className="icon icon-sm">tune</span> Cards</button>
          {admin && <button onClick={()=>setModalAcesso(true)} className="btn btn-ghost btn-sm"><span className="icon icon-sm">lock_open</span> Acesso</button>}
        </div>
      </div>

      {/* KPIs */}
      {mostra('acessos') && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:12}}>
          <Kpi label="Online agora" valor={m.online} cor="var(--success)"/>
          <Kpi label="Acessaram hoje" valor={m.hoje} cor="var(--primary)"/>
          <Kpi label="Com conta" valor={m.comConta} sub={`de ${m.total}`} cor="#2F855A"/>
          <Kpi label="Sem conta" valor={m.semConta} cor="#E8821A"/>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:16}}>
        {mostra('cadastros') && <Kpi label="Encontristas" valor={m.encontristas} cor="#6B46C1"/>}
        {mostra('cadastros') && <Kpi label="Encontreiros" valor={m.encontreiros} cor="var(--primary)"/>}
        {mostra('financeiro') && <Kpi label="Arrecadado" valor={fmtBRL(m.arrecadado)} cor="#2F855A"/>}
        {mostra('escalas') && <Kpi label="Escalas concluídas" valor={`${m.escPct}%`} sub={`${m.escConcl}/${m.escTotal}`} cor="var(--primary)"/>}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:12}}>
        {/* Escalas por equipe */}
        {mostra('equipes') && m.porEq.length>0 && (
          <div style={cardBox}>
            <p style={tituloBox}>Escalas concluídas por equipe</p>
            {m.porEq.map(x => (
              <div key={x.team.id} style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                  <span style={{fontWeight:600}}>{x.team.name}</span>
                  <span style={{fontWeight:800,color:x.pct===100?'#2F855A':x.pct<50?'#D69E2E':'var(--primary)'}}>{x.pct}% <span style={{color:'var(--muted)',fontWeight:600}}>({x.concl}/{x.total})</span></span>
                </div>
                <div style={{height:8,background:'var(--bg)',borderRadius:99,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${x.pct}%`,background:x.team.color||'var(--primary)',borderRadius:99}}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Gráfico cadastros por dia */}
        {mostra('grafcad') && (
          <div style={cardBox}>
            <p style={tituloBox}>Cadastros nos últimos 7 dias</p>
            <div style={{display:'flex',alignItems:'flex-end',gap:8,height:120,paddingTop:8}}>
              {m.dias.map((d,i)=>(
                <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                  <span style={{fontSize:11,fontWeight:800,color:'var(--text2)'}}>{d.n||''}</span>
                  <div style={{width:'100%',height:`${Math.max(4,(d.n/maxCad)*90)}px`,background:'var(--primary)',borderRadius:'4px 4px 0 0',transition:'height .3s'}}/>
                  <span style={{fontSize:10,color:'var(--muted)'}}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tipos (donut) */}
        {mostra('tipos') && (m.encontristas+m.encontreiros)>0 && (() => {
          const tot = m.encontristas+m.encontreiros
          const pctEnc = Math.round(m.encontristas/tot*100)
          return (
            <div style={cardBox}>
              <p style={tituloBox}>Encontristas × Encontreiros</p>
              <div style={{display:'flex',alignItems:'center',gap:18}}>
                <div style={{width:110,height:110,borderRadius:'50%',flexShrink:0,background:`conic-gradient(#6B46C1 0 ${pctEnc}%, var(--primary) ${pctEnc}% 100%)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div style={{width:66,height:66,borderRadius:'50%',background:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800}}>{tot}</div>
                </div>
                <div style={{fontSize:13}}>
                  <p style={{marginBottom:6}}><span style={{display:'inline-block',width:11,height:11,borderRadius:3,background:'#6B46C1',marginRight:6}}/>Encontristas · <b>{m.encontristas}</b></p>
                  <p><span style={{display:'inline-block',width:11,height:11,borderRadius:3,background:'var(--primary)',marginRight:6}}/>Encontreiros · <b>{m.encontreiros}</b></p>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {modalCards && <ModalCards off={off} toggle={toggleCard} fechar={()=>setModalCards(false)} />}
      {modalAcesso && admin && <ModalAcesso pessoas={pessoas.filter(p=>p.user_id)} fechar={()=>setModalAcesso(false)} />}
    </div>
  )
}

const cardBox: React.CSSProperties = { background:'white', borderRadius:14, padding:'16px 18px', boxShadow:'var(--shadow-sm)' }
const tituloBox: React.CSSProperties = { fontSize:13, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }

function Kpi({ label, valor, sub, cor }: { label:string; valor:string|number; sub?:string; cor:string }) {
  return (
    <div style={{background:'white',borderRadius:14,padding:'14px 16px',boxShadow:'var(--shadow-sm)',borderLeft:`4px solid ${cor}`}}>
      <p style={{fontSize:12,color:'var(--muted)',fontWeight:600}}>{label}</p>
      <p style={{fontSize:26,fontWeight:800,color:cor,lineHeight:1.1,marginTop:2}}>{valor}{sub && <span style={{fontSize:13,color:'var(--muted)',fontWeight:600}}> {sub}</span>}</p>
    </div>
  )
}

function ModalCards({ off, toggle, fechar }: { off:Set<string>; toggle:(k:string)=>void; fechar:()=>void }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&fechar()}>
      <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 28px',maxWidth:480,width:'100%',margin:'0 auto',maxHeight:'80vh',overflowY:'auto'}}>
        <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 14px'}}/>
        <p style={{fontSize:17,fontWeight:800,marginBottom:14}}>Cards do painel</p>
        {CARDS.map(c=>{
          const on = !off.has(c.key)
          return (
            <button key={c.key} onClick={()=>toggle(c.key)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 4px',background:'none',border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',fontFamily:'inherit'}}>
              <span style={{fontSize:14,fontWeight:600}}>{c.nome}</span>
              <span style={{width:44,height:26,borderRadius:99,background:on?'var(--success)':'var(--border)',position:'relative',flexShrink:0,transition:'background .15s'}}>
                <span style={{position:'absolute',top:3,left:on?21:3,width:20,height:20,borderRadius:'50%',background:'white',transition:'left .15s',boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}/>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ModalAcesso({ pessoas, fechar }: { pessoas:Pessoa[]; fechar:()=>void }) {
  const [liberados, setLiberados] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { (async()=>{ const { data } = await supabase.from('permissoes').select('person_id').eq('modulo','painel').eq('acao','ver').eq('permitido',true); setLiberados(new Set((data??[]).map((x:any)=>x.person_id).filter(Boolean))); setLoading(false) })() }, [])
  async function toggle(p: Pessoa) {
    const on = liberados.has(p.id)
    setLiberados(prev => { const n = new Set(prev); on ? n.delete(p.id) : n.add(p.id); return n })
    if (on) await supabase.from('permissoes').delete().eq('person_id',p.id).eq('modulo','painel').eq('acao','ver')
    else { const { error } = await supabase.from('permissoes').insert({ person_id:p.id, modulo:'painel', acao:'ver', permitido:true }); if (error) toast.falha('Não foi possível liberar.', error) }
  }
  const lista = pessoas.filter(p=>!busca || normalizarNome(p.name).includes(normalizarNome(busca)))
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&fechar()}>
      <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 24px',maxWidth:480,width:'100%',margin:'0 auto',maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
        <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 12px',flexShrink:0}}/>
        <p style={{fontSize:17,fontWeight:800,marginBottom:4}}>Quem acessa o Painel</p>
        <p style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>Independente de equipe. Admin sempre entra.</p>
        <div className="search-bar" style={{marginBottom:10,flexShrink:0}}>
          <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
          <input placeholder="Buscar pessoa..." value={busca} onChange={e=>setBusca(e.target.value)}/>
        </div>
        <div style={{overflowY:'auto',flex:1}}>
          {loading ? <p style={{fontSize:13,color:'var(--muted)',padding:'16px 0'}}>Carregando…</p> :
          lista.map(p=>{
            const on = liberados.has(p.id)
            return (
              <button key={p.id} onClick={()=>toggle(p)} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 4px',background:'none',border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                <div style={{width:34,height:34,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {p.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:12,fontWeight:700,color:'var(--primary)'}}>{getInitials(p.name)}</span>}
                </div>
                <span style={{flex:1,fontSize:14,fontWeight:on?700:500}}>{formatName(p.name)}</span>
                <span className="icon" style={{color:on?'var(--primary)':'var(--border)'}}>{on?'check_circle':'radio_button_unchecked'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
