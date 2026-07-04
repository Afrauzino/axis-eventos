import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isAdmin } from '../utils'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import { carregarConfig, salvarConfig } from '../lib/tema'
import HomeCarousel from '../components/HomeCarousel'
import BoasVindas, { type BVVariante } from '../components/BoasVindas'
import { MENUS_CATALOGO } from '../lib/permCatalog'
import type { Profile } from '../App'

type Stats = { encontristas:number; encontreiros:number; equipes:number; alertas:number }

// #tela-inicial — blocos reordenáveis (o admin arrasta e salva a ordem)
const ORDEM_PADRAO = ['evento','ranking','indicadores','carrossel','boasvindas']
function normalizarOrdem(arr:any): string[] {
  const base = ORDEM_PADRAO
  const filtrada = Array.isArray(arr) ? arr.filter((id:string)=>base.includes(id)) : []
  for (const id of base) if (!filtrada.includes(id)) filtrada.push(id)
  return filtrada
}

export default function Dashboard({ profile }: { profile: Profile }) {
  const { pode, carregado: permsCarregadas } = usePermissao(profile)
  const admin = isAdmin(profile.user_role) || profile.is_admin
  // Indicadores (Encontristas/Encontreiros/Equipes/Alertas) só p/ Admin e Financeiro
  const podeVerStats = admin || profile.user_role === 'financeiro'
  // Tela de boas-vindas para quem entrou SEM LIBERAÇÃO (não vê nenhum menu)
  const [roleType, setRoleType] = useState<string|null>(null)
  useEffect(() => {
    if (!profile?.user_id) return
    supabase.from('people').select('role_type').eq('user_id', profile.user_id).maybeSingle()
      .then(({ data }) => setRoleType(data?.role_type ?? null))
  }, [profile?.user_id])
  // #8 — visitante (sem cadastro no evento) tem tela própria; senão encontreiro/encontrista
  const variante: BVVariante = roleType === 'worker' ? 'encontreiro' : roleType === 'encounterer' ? 'encontrista' : 'visitante'
  // "Sem liberação" = não é admin e não enxerga NENHUM menu do sistema
  const semLiberacao = permsCarregadas && !admin && !MENUS_CATALOGO.some(m => pode(m.modulo))
  // mapa rota -> permissao de menu
  const PERM_ROTA: Record<string,string> = { '/encontristas':'menu_encontristas','/cadastros':'menu_cadastros','/equipes':'menu_equipes','/alertas':'menu_alertas_lideres','/cronograma':'menu_cronograma','/minhas-atividades':'menu_atividades','/locais':'menu_evento','/financeiro':'menu_financeiro','/admin':'menu_admin','/ranking':'menu_ranking' }
  const podeIr = (rota:string) => admin || pode(PERM_ROTA[rota] ?? '')
  const irSe = (rota:string) => { if (podeIr(rota)) navigate(rota) }
  const navigate  = useNavigate()
  const { evento, loading: evLoading } = useEvento()
  const [stats,    setStats]    = useState<Stats|null>(null)
  const [progresso, setProgresso] = useState<{pct:number;total:number;feitos:number}|null>(null)
  const [loading,  setLoading]  = useState(true)

  // #tela-inicial — ordem dos blocos + modo "arrastar" (admin)
  const [ordem, setOrdem] = useState<string[]>(ORDEM_PADRAO)
  const [reordenando, setReordenando] = useState(false)
  const [salvandoOrdem, setSalvandoOrdem] = useState(false)
  const [arrastando, setArrastando] = useState<string|null>(null)
  const dragId = useRef<string|null>(null)
  const blocosRef = useRef<Record<string, HTMLDivElement|null>>({})

  useEffect(() => { carregarConfig('home_ordem').then(v => { if (v) { try { setOrdem(normalizarOrdem(JSON.parse(v))) } catch {} } }) }, [])

  // Arrastar (mouse + toque): move o bloco conforme o dedo/cursor passa sobre os outros
  useEffect(() => {
    if (!reordenando) return
    function mover(clientY:number) {
      const id = dragId.current
      if (!id) return
      let alvo: string|null = null
      for (const sid of ordem) {
        const el = blocosRef.current[sid]
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (clientY >= r.top && clientY <= r.bottom) { alvo = sid; break }
      }
      if (alvo && alvo !== id) {
        setOrdem(prev => { const arr = prev.filter(x=>x!==id); const i = arr.indexOf(alvo!); arr.splice(i,0,id); return arr })
      }
    }
    const onMove = (e:PointerEvent) => { if (dragId.current) { e.preventDefault(); mover(e.clientY) } }
    const onUp = () => { dragId.current = null; setArrastando(null) }
    window.addEventListener('pointermove', onMove, { passive:false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp) }
  }, [reordenando, ordem])

  async function salvarOrdem() { setSalvandoOrdem(true); await salvarConfig('home_ordem', JSON.stringify(ordem)); setSalvandoOrdem(false); setReordenando(false) }

  useEffect(() => {
    if (evLoading) return
    if (!evento) { setLoading(false); return }
    carregarDados(evento.id)
  }, [evento, evLoading])

  async function carregarDados(eid: string) {
    const [enc, ser, eq, al, cron] = await Promise.all([
      supabase.from('people').select('id',{count:'exact',head:true}).eq('event_id',eid).eq('role_type','encounterer'),
      supabase.from('people').select('id',{count:'exact',head:true}).eq('event_id',eid).eq('role_type','worker'),
      supabase.from('teams').select('id',{count:'exact',head:true}).eq('event_id',eid),
      supabase.from('alerts').select('id',{count:'exact',head:true}).eq('event_id',eid),
      supabase.from('cronograma_eventos').select('tipo,status').eq('event_id',eid),
    ])

    setStats({ encontristas:enc.count??0, encontreiros:ser.count??0, equipes:eq.count??0, alertas:al.count??0 })

    // PROGRESSO DO EVENTO — amarrado ao cronograma
    // Regra: item de alimentação/refeição pesa 2; demais pesam 1 (proporção 6%:3%)
    // Normalizado para fechar em 100% ao concluir tudo
    // REGRA OFICIAL: máximo 93% (7% reservados, nunca chega a 100%)
    // Pesos fixos: Alimentação/Refeição = 6, Outros/Pausa = 3
    // Progresso = (peso concluído / peso total) * 93%
    const itens = cron.data ?? []
    if (itens.length > 0) {
      const ehRefeicao = (tipo:string) => {
        const t = (tipo||'').toLowerCase()
        return t.includes('refei') || t.includes('aliment') || t.includes('almoç') || t.includes('almoco')
            || t.includes('janta') || t.includes('café') || t.includes('cafe') || t.includes('lanche')
            || t.includes('ceia') || t.includes('comida')
      }
      const peso = (tipo:string) => ehRefeicao(tipo) ? 6 : 3
      const pesoTotal = itens.reduce((s,i)=> s + peso(i.tipo), 0)
      const pesoFeito = itens.filter(i=>i.status==='concluido').reduce((s,i)=> s + peso(i.tipo), 0)
      // Normaliza para o teto de 93%
      const pct = pesoTotal > 0 ? Math.min(93, Math.round((pesoFeito / pesoTotal) * 93)) : 0
      const feitos = itens.filter(i=>i.status==='concluido').length
      setProgresso({ pct, total: itens.length, feitos })
    } else {
      setProgresso(null)
    }
    setLoading(false)
  }

  if (evLoading || loading) return (
    <div className="page">{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:10,borderRadius:14}}/>)}</div>
  )

  // Desenha cada bloco da tela inicial (usado na ordem definida pelo admin)
  const renderSecao = (id:string) => {
    if (!evento) return null
    switch (id) {
      case 'evento':
        return (
          <div style={{background:'var(--primary)',borderRadius:14,padding:'16px 20px',marginBottom:16,boxShadow:'0 4px 14px rgba(0,169,157,0.3)'}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
              <div>
                <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'rgba(255,255,255,0.7)',marginBottom:4}}>Evento atual</p>
                <p style={{fontSize:17,fontWeight:700,color:'white'}}>{evento.name}</p>
                {evento.location && <p style={{fontSize:12,color:'rgba(255,255,255,0.65)',marginTop:2}}>{evento.location}</p>}
              </div>
              <span style={{fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:99,background:'rgba(255,255,255,0.2)',color:'white',flexShrink:0}}>
                {evento.status==='active'?'Em andamento':'Encerrado'}
              </span>
            </div>
            {progresso && (
              <div style={{marginTop:6}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <span style={{fontSize:11,color:'rgba(255,255,255,0.8)',fontWeight:600}}>{progresso.feitos} de {progresso.total} concluídos</span>
                  <span style={{fontSize:13,fontWeight:800,color:'white'}}>{progresso.pct}%</span>
                </div>
                <div style={{height:8,background:'rgba(255,255,255,0.25)',borderRadius:99,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${progresso.pct}%`,background:'white',borderRadius:99,transition:'width 0.4s ease'}}/>
                </div>
              </div>
            )}
          </div>
        )
      case 'ranking':
        return (
          <div style={{marginBottom:16}}>
            <RankingMini eventoId={evento.id} navigate={navigate}/>
          </div>
        )
      case 'indicadores':
        return (stats && podeVerStats) ? (
          <div className="stats-grid mb-4">
            {[
              {label:'Encontristas', value:stats.encontristas,  rota:'/encontristas', cor:'#6B46C1'},
              {label:'Encontreiros', value:stats.encontreiros,  rota:'/cadastros',    cor:'var(--primary)'},
              {label:'Equipes',      value:stats.equipes,       rota:'/equipes',      cor:'#2B6CB0'},
              {label:'Alertas',      value:stats.alertas,       rota:'/alertas',      cor:stats.alertas>0?'var(--danger)':'var(--muted)'},
            ].map(s=>(
              <div key={s.label} className="stat-card" onClick={()=>irSe(s.rota)} style={{cursor:podeIr(s.rota)?'pointer':'default',opacity:podeIr(s.rota)?1:0.55}}>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{color:s.cor}}>{s.value}</div>
              </div>
            ))}
          </div>
        ) : null
      case 'carrossel':
        return <HomeCarousel admin={admin} />
      case 'boasvindas':
        return admin ? <BoasVindas variante={variante} admin={true} /> : null
      default:
        return null
    }
  }

  return (
    <div className="page slide-up">
      {semLiberacao ? (
        <>
          <HomeCarousel admin={admin} />
          <BoasVindas variante={variante} admin={false} />
        </>
      ) : !evento ? (
        <>
          <HomeCarousel admin={admin} />
          {admin && <BoasVindas variante={variante} admin={true} />}
          <div className="info-section mb-4" style={{textAlign:'center',padding:'24px'}}>
            <span className="icon icon-xl" style={{color:'var(--muted-light)',display:'block',marginBottom:8}}>event</span>
            <p className="text-muted text-sm mb-3">Nenhum evento ativo no momento.</p>
            {isAdmin(profile.user_role) && <button className="btn btn-primary btn-sm" onClick={()=>navigate('/admin')}>Criar evento</button>}
          </div>
        </>
      ) : (
        <>
          {/* Admin pode reordenar os blocos da tela inicial (arrastar) */}
          {admin && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,gap:8}}>
              <span style={{fontSize:12,color:'var(--muted)'}}>{reordenando?'Arraste pela alça e toque em Salvar.':''}</span>
              <div style={{display:'flex',gap:8}}>
                {reordenando ? (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={salvarOrdem} disabled={salvandoOrdem}>{salvandoOrdem?'Salvando...':'Salvar ordem'}</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>{ setReordenando(false); carregarConfig('home_ordem').then(v=>{ if(v){try{setOrdem(normalizarOrdem(JSON.parse(v)))}catch{}} else setOrdem(ORDEM_PADRAO) }) }}>Cancelar</button>
                  </>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={()=>setReordenando(true)}><span className="icon icon-sm">swap_vert</span> Reordenar tela</button>
                )}
              </div>
            </div>
          )}

          {ordem.map(id => {
            const conteudo = renderSecao(id)
            if (!conteudo) return null
            return (
              <div key={id} ref={el=>{ blocosRef.current[id]=el }}
                style={reordenando
                  ? { position:'relative', border:'2px dashed var(--primary)', borderRadius:14, padding:'8px 8px 0', marginBottom:12, background: arrastando===id?'var(--primary-light)':'white', touchAction:'none' }
                  : { position:'relative' }}>
                {reordenando && (
                  <div onPointerDown={(e)=>{ e.preventDefault(); dragId.current=id; setArrastando(id) }}
                    style={{position:'absolute',top:-1,right:-1,zIndex:5,background:'var(--primary)',color:'white',borderTopRightRadius:12,borderBottomLeftRadius:12,padding:'5px 10px',cursor:'grab',touchAction:'none',userSelect:'none',display:'flex',alignItems:'center',gap:4,fontSize:12,fontWeight:800}}>
                    <span className="icon icon-sm">drag_indicator</span> arrastar
                  </div>
                )}
                {conteudo}
              </div>
            )
          })}
        </>
      )}

    </div>
  )
}

function RankingMini({ eventoId, navigate }: { eventoId:string; navigate:(to:string)=>void }) {
  const [top, setTop] = useState<{id:string;name:string;photo_url:string|null;media:number;total:number}[]>([])
  const [carregado, setCarregado] = useState(false)

  useEffect(() => { if (eventoId) load() }, [eventoId])

  async function load() {
    // Busca TODOS os votos do evento (todas as categorias juntas)
    const [vo, pe] = await Promise.all([
      supabase.from('ranking_votos').select('votado_id,estrelas').eq('event_id', eventoId),
      supabase.from('people').select('id,name,photo_url').eq('event_id', eventoId).eq('role_type','encounterer'),
    ])
    if (vo.error || pe.error) return

    // Calcular média geral de cada pessoa (todas as categorias combinadas)
    const notas: Record<string, number[]> = {}
    for (const v of vo.data ?? []) {
      if (!notas[v.votado_id]) notas[v.votado_id] = []
      notas[v.votado_id].push(v.estrelas)
    }

    const ranked = (pe.data ?? [])
      .map(p => {
        const ns = notas[p.id] ?? []
        const media = ns.length ? ns.reduce((s,n) => s+n, 0) / ns.length : 0
        return { ...p, media: +media.toFixed(1), total: ns.length }
      })
      .filter(p => p.total > 0)
      .sort((a, b) => b.media - a.media || b.total - a.total)
      .slice(0, 3)

    setTop(ranked)
    setCarregado(true)
  }

  const MEDALHAS = ['🥇','🥈','🥉']

  return (
    <div style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',overflow:'hidden',marginBottom:20}}>
      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#F6AD55,#FC8181)',padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:22}}>🏆</span>
          <div>
            <p style={{fontWeight:800,fontSize:15,color:'white'}}>Ranking Geral</p>
            <p style={{fontSize:11,color:'rgba(255,255,255,0.8)'}}>Média de todas as categorias</p>
          </div>
        </div>
        <button onClick={()=>navigate('/ranking')}
          style={{background:'rgba(255,255,255,0.25)',color:'white',border:'1px solid rgba(255,255,255,0.4)',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit'}}>
          Votar →
        </button>
      </div>

      {/* Lista */}
      {!carregado ? (
        <div style={{padding:'16px',textAlign:'center'}}><p style={{fontSize:13,color:'var(--muted)'}}>Carregando...</p></div>
      ) : top.length === 0 ? (
        <div style={{padding:'20px 16px',textAlign:'center'}}>
          <p style={{fontSize:28,marginBottom:8}}>🗳️</p>
          <p style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>Nenhum voto ainda. Seja o primeiro!</p>
          <button onClick={()=>navigate('/ranking')}
            style={{background:'var(--primary)',color:'white',border:'none',borderRadius:8,padding:'8px 20px',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'inherit'}}>
            Ir votar agora
          </button>
        </div>
      ) : (
        <>
          {top.map((p, i) => (
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:i<top.length-1?'1px solid var(--border)':'none',background:i===0?'#FFFBEB':'white'}}>
              <span style={{fontSize:24,flexShrink:0,width:28,textAlign:'center'}}>{MEDALHAS[i]}</span>
              <div style={{width:40,height:40,borderRadius:'50%',background:'var(--primary-light)',overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {p.photo_url
                  ? <img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : <span style={{fontSize:14,fontWeight:700,color:'var(--primary)'}}>{p.name.slice(0,2).toUpperCase()}</span>
                }
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontWeight:700,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</p>
                <p style={{fontSize:11,color:'var(--muted)'}}>{p.total} voto{p.total!==1?'s':''}</p>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <p style={{fontSize:18,fontWeight:800,color:i===0?'#D69E2E':'var(--text)'}}>{p.media.toFixed(1)}</p>
                <div style={{display:'flex',gap:1}}>
                  {[1,2,3,4,5].map(n=>(
                    <span key={n} style={{fontSize:11,color:n<=Math.round(p.media)?'#F6AD55':'var(--border)'}}>★</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <div style={{padding:'10px 16px',textAlign:'center',borderTop:'1px solid var(--border)'}}>
            <button onClick={()=>navigate('/ranking')}
              style={{background:'none',border:'none',color:'var(--primary)',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              Ver ranking completo →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
