import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isAdmin } from '../utils'
import { useEvento, invalidarEventoAtivo } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import { toast } from '../components/Toast'
import { carregarConfig, salvarConfig } from '../lib/tema'
import HomeCarousel from '../components/HomeCarousel'
import CronometroAoVivo from '../components/CronometroAoVivo'
import ContagemRegressiva from '../components/ContagemRegressiva'
import ProximoItem from '../components/ProximoItem'
import MuralGratidao from '../components/MuralGratidao'
import Aniversariantes from '../components/Aniversariantes'
import MetaEncontristas from '../components/MetaEncontristas'
import VersiculoDia from '../components/VersiculoDia'
import PlaylistHome from '../components/PlaylistHome'
import BoasVindas, { type BVVariante } from '../components/BoasVindas'
import { MENUS_CATALOGO } from '../lib/permCatalog'
import { estiloFundo } from '../lib/blocoFundo'
import type { Profile } from '../App'

type Stats = { encontristas:number; encontreiros:number; equipes:number; alertas:number }

// #tela-inicial — blocos reordenáveis (o admin arrasta e salva a ordem)
const ORDEM_PADRAO = ['evento','proximo','meta','mural','aniversarios','versiculo','ranking','indicadores','carrossel','playlist','boasvindas']
const HOME_CORES = ['#00A99D','#1565C0','#6B46C1','#2F855A','#C53030','#D69E2E','#E8821A','#0F766E','#B83280','#1A202C','#2D3748']
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

  // Personalização da caixa "Evento atual" (admin): cor + imagem de fundo
  const [cardCor, setCardCor] = useState('')
  const [cardBg, setCardBg]   = useState('')
  const [personalizando, setPersonalizando] = useState(false)
  const [salvandoCard, setSalvandoCard]     = useState(false)
  const bgFileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (evento) { setCardCor((evento as any).home_cor || ''); setCardBg((evento as any).home_bg_url || '') } }, [evento?.id]) // eslint-disable-line

  async function enviarBgEvento(file: File) {
    if (!evento) return
    setSalvandoCard(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `evento-bg/${evento.id}.${ext}`
    const { error } = await supabase.storage.from('pessoas').upload(path, file, { upsert: true })
    if (error) { setSalvandoCard(false); toast.falha('Não foi possível enviar a imagem.', error); return }
    const { data } = supabase.storage.from('pessoas').getPublicUrl(path)
    setCardBg(`${data.publicUrl}?t=${Date.now()}`)
    setSalvandoCard(false)
  }

  async function salvarVisualCard() {
    if (!evento) return
    setSalvandoCard(true)
    const { error } = await supabase.from('events').update({ home_cor: cardCor || null, home_bg_url: cardBg || null }).eq('id', evento.id)
    setSalvandoCard(false)
    if (error) { toast.falha('Não foi possível salvar.', error); return }
    invalidarEventoAtivo()
    setPersonalizando(false)
    toast.sucesso('Caixa personalizada!')
  }

  // #tela-inicial — ordem dos blocos + modo "arrastar" (admin)
  const [ordem, setOrdem] = useState<string[]>(ORDEM_PADRAO)
  const [ocultos, setOcultos] = useState<string[]>([])  // blocos que o admin escondeu
  const [estilos, setEstilos] = useState<Record<string, { cor?: string; bg?: string }>>({})  // cor/imagem por bloco
  const [estiloEditId, setEstiloEditId] = useState<string | null>(null)
  const [estiloCor, setEstiloCor] = useState('')
  const [estiloBg, setEstiloBg] = useState('')
  const [salvandoEstilo, setSalvandoEstilo] = useState(false)
  const estiloFileRef = useRef<HTMLInputElement>(null)
  const [reordenando, setReordenando] = useState(false)
  const [salvandoOrdem, setSalvandoOrdem] = useState(false)
  const [arrastando, setArrastando] = useState<string|null>(null)
  const dragId = useRef<string|null>(null)
  const blocosRef = useRef<Record<string, HTMLDivElement|null>>({})

  useEffect(() => { carregarConfig('home_ordem').then(v => { if (v) { try { setOrdem(normalizarOrdem(JSON.parse(v))) } catch {} } }) }, [])
  useEffect(() => { carregarConfig('home_ocultos').then(v => { if (v) { try { setOcultos(JSON.parse(v)) } catch {} } }) }, [])
  const escondido = (id: string) => ocultos.includes(id)
  async function toggleOculto(id: string) {
    const novo = escondido(id) ? ocultos.filter(x => x !== id) : [...ocultos, id]
    setOcultos(novo)
    await salvarConfig('home_ocultos', JSON.stringify(novo))
  }

  // Cor / imagem de fundo por bloco (genérico, vale para todos os blocos)
  useEffect(() => { carregarConfig('home_estilos').then(v => { if (v) { try { setEstilos(JSON.parse(v)) } catch {} } }) }, [])
  function abrirEstilo(id: string) { const e = estilos[id] || {}; setEstiloCor(e.cor || ''); setEstiloBg(e.bg || ''); setEstiloEditId(id) }
  async function enviarEstiloBg(file: File) {
    if (!estiloEditId) return
    setSalvandoEstilo(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `home-bloco/${estiloEditId}.${ext}`
    const { error } = await supabase.storage.from('pessoas').upload(path, file, { upsert: true })
    if (error) { setSalvandoEstilo(false); toast.falha('Não foi possível enviar a imagem.', error); return }
    const { data } = supabase.storage.from('pessoas').getPublicUrl(path)
    setEstiloBg(`${data.publicUrl}?t=${Date.now()}`)
    setSalvandoEstilo(false)
  }
  async function salvarEstilo() {
    if (!estiloEditId) return
    const novo = { ...estilos }
    if (estiloCor || estiloBg) novo[estiloEditId] = { cor: estiloCor || undefined, bg: estiloBg || undefined }
    else delete novo[estiloEditId]
    setSalvandoEstilo(true)
    setEstilos(novo)
    await salvarConfig('home_estilos', JSON.stringify(novo))
    setSalvandoEstilo(false)
    setEstiloEditId(null)
  }

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
      case 'evento': {
        const corCard = cardCor || 'var(--primary)'
        const cardStyle: React.CSSProperties = cardBg
          ? { backgroundImage:`linear-gradient(rgba(0,0,0,0.38),rgba(0,0,0,0.52)), url(${cardBg})`, backgroundSize:'cover', backgroundPosition:'center', borderRadius:14, padding:'16px 20px', marginBottom:16, boxShadow:'0 4px 14px rgba(0,0,0,0.28)', position:'relative' }
          : { background:corCard, borderRadius:14, padding:'16px 20px', marginBottom:16, boxShadow:'0 4px 14px rgba(0,0,0,0.15)', position:'relative' }
        return (
          <div style={cardStyle}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
              <div>
                <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'rgba(255,255,255,0.7)',marginBottom:4}}>Evento atual</p>
                <p style={{fontSize:17,fontWeight:700,color:'white'}}>{evento.name}</p>
                {evento.location && <p style={{fontSize:12,color:'rgba(255,255,255,0.75)',marginTop:2}}>{evento.location}</p>}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                <span style={{fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:99,background:'rgba(255,255,255,0.2)',color:'white'}}>
                  {evento.status==='active'?'Em andamento':'Encerrado'}
                </span>
                {admin && !reordenando && (
                  <button onClick={()=>setPersonalizando(true)} title="Personalizar caixa"
                    style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:8,width:30,height:30,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontFamily:'inherit'}}>
                    <span className="icon icon-sm">palette</span>
                  </button>
                )}
              </div>
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
      }
      case 'ranking':
        return (
          <div style={{marginBottom:16}}>
            <RankingMini eventoId={evento.id} navigate={navigate} fundo={estilos[id]} onEditar={admin?()=>abrirEstilo(id):undefined}/>
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
      case 'proximo':
        return <ProximoItem eventoId={evento.id} admin={admin} />
      case 'meta':
        return <MetaEncontristas eventoId={evento.id} admin={admin} fundo={estilos[id]} onEditar={admin?()=>abrirEstilo(id):undefined} />
      case 'mural':
        return <MuralGratidao eventoId={evento.id} profile={profile} fundo={estilos[id]} onEditar={admin?()=>abrirEstilo(id):undefined} />
      case 'aniversarios':
        return <Aniversariantes eventoId={evento.id} fundo={estilos[id]} onEditar={admin?()=>abrirEstilo(id):undefined} />
      case 'versiculo':
        return <VersiculoDia fundo={estilos[id]} onEditar={admin?()=>abrirEstilo(id):undefined} />
      case 'carrossel':
        return <HomeCarousel admin={admin} />
      case 'playlist':
        return <PlaylistHome admin={admin} fundo={estilos[id]} onEditar={admin?()=>abrirEstilo(id):undefined} />
      case 'boasvindas':
        return admin ? <BoasVindas variante={variante} admin={true} /> : null
      default:
        return null
    }
  }

  return (
    <div className="page slide-up">
      {/* Faixa AO VIVO: cronômetro de um bloco em andamento (visível a todos, não clicável) */}
      <CronometroAoVivo eventoId={evento?.id} />

      {/* Relógio digital: contagem regressiva para o 1º dia do evento */}
      <ContagemRegressiva evento={evento} admin={admin} />

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
            const oculto = escondido(id)
            // Fora do modo reordenar, bloco oculto some para todos (inclusive admin)
            if (oculto && !reordenando) return null
            const conteudo = renderSecao(id)
            if (!conteudo) return null
            return (
              <div key={id} ref={el=>{ blocosRef.current[id]=el }}
                style={reordenando
                  ? { position:'relative', border:'2px dashed var(--primary)', borderRadius:14, padding:'8px 8px 0', marginBottom:12, background: arrastando===id?'var(--primary-light)':'white', touchAction:'none', opacity: oculto?0.45:1 }
                  : { position:'relative' }}>
                {reordenando && (
                  <>
                    <button onClick={()=>toggleOculto(id)} title={oculto?'Mostrar':'Ocultar'}
                      style={{position:'absolute',top:-1,left:-1,zIndex:5,background:oculto?'var(--muted)':'var(--success)',color:'white',borderTopLeftRadius:12,borderBottomRightRadius:12,padding:'5px 10px',cursor:'pointer',border:'none',fontFamily:'inherit',userSelect:'none',display:'flex',alignItems:'center',gap:4,fontSize:12,fontWeight:800}}>
                      <span className="icon icon-sm">{oculto?'visibility_off':'visibility'}</span> {oculto?'Oculto':'Visível'}
                    </button>
                    <div onPointerDown={(e)=>{ e.preventDefault(); dragId.current=id; setArrastando(id) }}
                      style={{position:'absolute',top:-1,right:-1,zIndex:5,background:'var(--primary)',color:'white',borderTopRightRadius:12,borderBottomLeftRadius:12,padding:'5px 10px',cursor:'grab',touchAction:'none',userSelect:'none',display:'flex',alignItems:'center',gap:4,fontSize:12,fontWeight:800}}>
                      <span className="icon icon-sm">drag_indicator</span> arrastar
                    </div>
                  </>
                )}
                {reordenando && <div style={{height:26}}/>}
                {conteudo}
              </div>
            )
          })}
        </>
      )}

      {/* Personalizar a caixa "Evento atual" (admin) */}
      {personalizando && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setPersonalizando(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 28px',maxWidth:480,width:'100%',margin:'0 auto',maxHeight:'88vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 16px'}}/>
            <p style={{fontSize:16,fontWeight:800,marginBottom:14}}>Personalizar caixa do evento</p>

            {/* Prévia */}
            <div style={cardBg
              ? { backgroundImage:`linear-gradient(rgba(0,0,0,0.38),rgba(0,0,0,0.52)), url(${cardBg})`, backgroundSize:'cover', backgroundPosition:'center', borderRadius:14, padding:'14px 16px', marginBottom:16 }
              : { background: cardCor||'var(--primary)', borderRadius:14, padding:'14px 16px', marginBottom:16 }}>
              <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'rgba(255,255,255,0.7)'}}>Evento atual</p>
              <p style={{fontSize:16,fontWeight:700,color:'white'}}>{evento?.name}</p>
            </div>

            <label className="form-label">Cor de fundo</label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
              {['#00A99D','#1565C0','#6B46C1','#2F855A','#C53030','#D69E2E','#E8821A','#0F766E','#B83280','#1A202C'].map(c=>(
                <button key={c} type="button" onClick={()=>setCardCor(c)} aria-label={c}
                  style={{width:34,height:34,borderRadius:8,background:c,border:cardCor===c?'3px solid var(--text)':'2px solid white',boxShadow:'0 0 0 1px var(--border)',cursor:'pointer'}}/>
              ))}
            </div>

            <label className="form-label">Imagem de fundo</label>
            <p className="form-hint mb-2">Se colocar uma imagem, ela cobre a cor. Fica escurecida um pouco pra o texto ler bem.</p>
            <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={()=>bgFileRef.current?.click()} disabled={salvandoCard}>
                <span className="icon icon-sm">image</span> {salvandoCard?'Enviando...':'Enviar imagem'}
              </button>
              {cardBg && <button type="button" className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={()=>setCardBg('')}>
                <span className="icon icon-sm">delete</span> Remover imagem
              </button>}
            </div>

            <button className="btn btn-primary btn-full" onClick={salvarVisualCard} disabled={salvandoCard} style={{marginBottom:8}}>
              {salvandoCard?'Salvando...':'Salvar'}
            </button>
            <button className="btn btn-ghost btn-full" onClick={()=>setPersonalizando(false)}>Cancelar</button>
          </div>
        </div>
      )}
      <input ref={bgFileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0]; if(f) enviarBgEvento(f); e.target.value=''}}/>

      {/* Cor / imagem de fundo de um bloco qualquer da tela inicial */}
      {estiloEditId && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setEstiloEditId(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 28px',maxWidth:480,width:'100%',margin:'0 auto',maxHeight:'88vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 16px'}}/>
            <p style={{fontSize:16,fontWeight:800,marginBottom:14}}>Cor e imagem de fundo do bloco</p>

            {/* Prévia */}
            <div style={estiloBg
              ? { backgroundImage:`linear-gradient(rgba(0,0,0,0.28),rgba(0,0,0,0.40)), url(${estiloBg})`, backgroundSize:'cover', backgroundPosition:'center', borderRadius:14, padding:'18px 16px', marginBottom:16 }
              : { background: estiloCor || 'var(--bg)', borderRadius:14, padding:'18px 16px', marginBottom:16, border:'1px solid var(--border)' }}>
              <p style={{fontSize:13,fontWeight:800,color: (estiloBg||estiloCor)?'white':'var(--muted)'}}>Prévia do fundo</p>
            </div>

            <label className="form-label">Cor de fundo</label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
              {HOME_CORES.map(c=>(
                <button key={c} type="button" onClick={()=>setEstiloCor(c)} aria-label={c}
                  style={{width:34,height:34,borderRadius:8,background:c,border:estiloCor===c?'3px solid var(--text)':'2px solid white',boxShadow:'0 0 0 1px var(--border)',cursor:'pointer'}}/>
              ))}
              <button type="button" onClick={()=>setEstiloCor('')} title="Sem cor"
                style={{width:34,height:34,borderRadius:8,background:'white',border:!estiloCor?'3px solid var(--text)':'2px solid white',boxShadow:'0 0 0 1px var(--border)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <span className="icon icon-sm" style={{color:'var(--muted)'}}>block</span>
              </button>
            </div>

            <label className="form-label">Imagem de fundo</label>
            <p className="form-hint mb-2">A imagem cobre a cor e fica escurecida para dar contraste.</p>
            <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={()=>estiloFileRef.current?.click()} disabled={salvandoEstilo}>
                <span className="icon icon-sm">image</span> {salvandoEstilo?'Enviando...':'Enviar imagem'}
              </button>
              {estiloBg && <button type="button" className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={()=>setEstiloBg('')}>
                <span className="icon icon-sm">delete</span> Remover imagem
              </button>}
            </div>

            <button className="btn btn-primary btn-full" onClick={salvarEstilo} disabled={salvandoEstilo} style={{marginBottom:8}}>
              {salvandoEstilo?'Salvando...':'Salvar'}
            </button>
            <button className="btn btn-ghost btn-full" onClick={()=>setEstiloEditId(null)}>Cancelar</button>
          </div>
        </div>
      )}
      <input ref={estiloFileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0]; if(f) enviarEstiloBg(f); e.target.value=''}}/>

    </div>
  )
}

type LinhaCat = {
  cat: { id:string; nome:string; icone:string; cor:string }
  winner: { id:string; name:string; photo_url:string|null; media:number; total:number }
}
function RankingMini({ eventoId, navigate, fundo, onEditar }: { eventoId:string; navigate:(to:string)=>void; fundo?:{cor?:string;bg?:string}; onEditar?:()=>void }) {
  const [linhas, setLinhas] = useState<LinhaCat[]>([])
  const [carregado, setCarregado] = useState(false)

  useEffect(() => { if (eventoId) load() }, [eventoId])

  async function load() {
    const [ca, vo, pe] = await Promise.all([
      supabase.from('ranking_categorias').select('id,nome,icone,cor,ordem').eq('event_id', eventoId).order('ordem'),
      supabase.from('ranking_votos').select('categoria_id,votado_id,estrelas').eq('event_id', eventoId),
      supabase.from('people').select('id,name,photo_url').eq('event_id', eventoId).eq('role_type','encounterer'),
    ])
    if (ca.error || vo.error || pe.error) { setCarregado(true); return }

    const pMap = new Map((pe.data ?? []).map(p => [p.id, p]))
    const votos = vo.data ?? []
    const out: LinhaCat[] = []

    // Para cada categoria: o encontrista com mais estrelas (maior média; desempate por nº de votos)
    for (const cat of ca.data ?? []) {
      const notas: Record<string, number[]> = {}
      for (const v of votos) {
        if (v.categoria_id !== cat.id) continue
        ;(notas[v.votado_id] = notas[v.votado_id] || []).push(v.estrelas)
      }
      let best: { id:string; media:number; total:number } | null = null
      for (const [pid, ns] of Object.entries(notas)) {
        const media = +(ns.reduce((s,n)=>s+n,0) / ns.length).toFixed(1)
        const cand = { id:pid, media, total:ns.length }
        if (!best || cand.media > best.media || (cand.media === best.media && cand.total > best.total)) best = cand
      }
      if (!best) continue
      const person = pMap.get(best.id)
      if (!person) continue
      out.push({ cat: { id:cat.id, nome:cat.nome, icone:cat.icone, cor:cat.cor }, winner: { ...person, media:best.media, total:best.total } })
    }

    setLinhas(out)
    setCarregado(true)
  }

  return (
    <div style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',overflow:'hidden',marginBottom:20}}>
      {/* Header */}
      <div style={{...estiloFundo(fundo,'linear-gradient(135deg,#F6AD55,#FC8181)'),padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:22}}>🏆</span>
          <div>
            <p style={{fontWeight:800,fontSize:15,color:'white'}}>Ranking</p>
            <p style={{fontSize:11,color:'rgba(255,255,255,0.8)'}}>Destaque de cada categoria</p>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          {onEditar && (
            <button onClick={onEditar} title="Cor / imagem"
              style={{background:'rgba(255,255,255,0.25)',color:'white',border:'none',borderRadius:8,width:30,height:30,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>
              <span className="icon icon-sm">palette</span>
            </button>
          )}
          <button onClick={()=>navigate('/ranking')}
            style={{background:'rgba(255,255,255,0.25)',color:'white',border:'1px solid rgba(255,255,255,0.4)',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit'}}>
            Votar →
          </button>
        </div>
      </div>

      {/* Lista: um campeão por categoria */}
      {!carregado ? (
        <div style={{padding:'16px',textAlign:'center'}}><p style={{fontSize:13,color:'var(--muted)'}}>Carregando...</p></div>
      ) : linhas.length === 0 ? (
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
          {linhas.map((l, i) => (
            <div key={l.cat.id} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 16px',borderBottom:i<linhas.length-1?'1px solid var(--border)':'none'}}>
              {/* Foto do campeão com anel na cor da categoria */}
              <div style={{position:'relative',flexShrink:0}}>
                <div style={{width:44,height:44,borderRadius:'50%',background:'var(--primary-light)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',border:`2px solid ${l.cat.cor}`}}>
                  {l.winner.photo_url
                    ? <img src={l.winner.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : <span style={{fontSize:14,fontWeight:700,color:'var(--primary)'}}>{l.winner.name.slice(0,2).toUpperCase()}</span>
                  }
                </div>
                <div style={{position:'absolute',bottom:-3,right:-3,width:20,height:20,borderRadius:'50%',background:l.cat.cor,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid white'}}>
                  <span className="icon" style={{fontSize:12,color:'white'}}>{l.cat.icone || 'star'}</span>
                </div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.04em',color:l.cat.cor,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.cat.nome}</p>
                <p style={{fontWeight:700,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.winner.name}</p>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <p style={{fontSize:17,fontWeight:800,color:'#D69E2E'}}>{l.winner.media.toFixed(1)}</p>
                <div style={{display:'flex',gap:1,justifyContent:'flex-end'}}>
                  {[1,2,3,4,5].map(n=>(
                    <span key={n} style={{fontSize:10,color:n<=Math.round(l.winner.media)?'#F6AD55':'var(--border)'}}>★</span>
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
