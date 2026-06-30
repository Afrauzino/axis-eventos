import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getInitials } from '../utils'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Categoria = { id:string; nome:string; descricao:string|null; icone:string; cor:string; ordem:number }
type Pessoa    = { id:string; name:string; photo_url:string|null }
type Voto      = { categoria_id:string; votante_id:string; votado_id:string; estrelas:number }

function MatIcon({ name, size=18, color='currentColor' }: { name:string; size?:number; color?:string }) {
  return <span style={{fontFamily:"'Material Symbols Outlined'",fontWeight:'normal',fontStyle:'normal',fontSize:size,lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',userSelect:'none',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",color}}>{name}</span>
}

function Estrelas({ valor, max=5, onChange, size=20 }: { valor:number; max?:number; onChange?:(v:number)=>void; size?:number }) {
  return (
    <div style={{display:'flex',gap:2}}>
      {Array.from({length:max},(_,i)=>(
        <button key={i} type="button" onMouseDown={e=>{e.preventDefault(); onChange?.(i+1)}}
          style={{background:'none',border:'none',cursor:onChange?'pointer':'default',padding:0,lineHeight:1}}>
          <MatIcon name="star" size={size} color={i<valor?'#F6AD55':'var(--border)'}/>
        </button>
      ))}
    </div>
  )
}

export default function Ranking({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [pessoas,    setPessoas]    = useState<Pessoa[]>([])
  const [votos,      setVotos]      = useState<Voto[]>([])
  const [loading,    setLoading]    = useState(true)
  const [erro,       setErro]       = useState<string|null>(null)
  const [catSel,     setCatSel]     = useState<Categoria|null>(null)
  const [votando,    setVotando]    = useState<{pessoa:Pessoa;cat:Categoria}|null>(null)
  const [estrelas,   setEstrelas]   = useState(0)
  const [salvando,   setSalvando]   = useState(false)
  const [myPersonId, setMyPersonId] = useState<string|null>(null)
  const canAdmin = profile && ['admin','coordenador'].includes(profile.user_role)

  useEffect(() => {
    if (evLoading) return
    if (!evento) { setLoading(false); return }
    carregar()
  }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true); setErro(null)

    const [ca, pe, vo] = await Promise.all([
      supabase.from('ranking_categorias').select('*').eq('event_id',evento.id).order('ordem'),
      supabase.from('people').select('id,name,photo_url').eq('event_id',evento.id).eq('role_type','encounterer').order('name'),
      supabase.from('ranking_votos').select('categoria_id,votante_id,votado_id,estrelas').eq('event_id',evento.id),
    ])

    if (ca.error) {
      // code 42P01 = table does not exist; PGRST116 = no rows (RLS)
      const code = (ca.error as any).code ?? ''
      if (code === '42P01' || ca.error.message?.includes('does not exist')) {
        setErro('Tabela de ranking não existe. Execute o SQL 0.1.3_ranking.sql no Supabase.')
      } else {
        setErro(`Erro ao carregar ranking: ${ca.error.message}`)
      }
      setLoading(false); return
    }

    setCategorias(ca.data??[])
    setPessoas(pe.data??[])
    setVotos(vo.data??[])
    if (ca.data?.length && !catSel) setCatSel(ca.data[0])

    // Qualquer usuário logado pode votar - usar user_id diretamente
    if (profile) setMyPersonId(profile.user_id)
    setLoading(false)
  }

  const CATEGORIAS_PADRAO = [
    {nome:'Quem mais conversou',                   descricao:'O encontrista mais comunicativo', icone:'chat',          cor:'#48BB78',ordem:1},
    {nome:'O que mais dormiu nas ministrações',     descricao:'Especialista em cochilos',         icone:'bedtime',       cor:'#667EEA',ordem:2},
    {nome:'O que mais resistiu... mas se entregou', descricao:'Teimoso mas abençoado',            icone:'change_circle', cor:'#F6AD55',ordem:3},
    {nome:'O que mais se entregou',                 descricao:'Coração aberto desde o início',    icone:'favorite',      cor:'#FC8181',ordem:4},
    {nome:'O mais quebrado',                        descricao:'Passagem de lágrimas',             icone:'water_drop',    cor:'#63B3ED',ordem:5},
  ]

  async function criarCategorias() {
    if (!evento) return
    setLoading(true)
    for (const cat of CATEGORIAS_PADRAO) {
      await supabase.from('ranking_categorias').insert({ ...cat, event_id: evento.id })
    }
    await carregar()
  }

  function notaMedia(catId:string, personId:string) {
    const vv = votos.filter(v=>v.categoria_id===catId && v.votado_id===personId)
    return vv.length ? +(vv.reduce((s,v)=>s+v.estrelas,0)/vv.length).toFixed(1) : 0
  }

  function meuVoto(catId:string, personId:string) {
    if (!myPersonId) return 0
    return votos.find(v=>v.categoria_id===catId && v.votado_id===personId && v.votante_id===myPersonId)?.estrelas ?? 0
  }

  function top3(catId:string) {
    return [...pessoas]
      .map(p=>({...p, nota:notaMedia(catId,p.id)}))
      .filter(p=>p.nota>0)
      .sort((a,b)=>b.nota-a.nota)
      .slice(0,3)
  }

  function rankingCompleto(catId:string) {
    return [...pessoas]
      .map(p=>({...p, nota:notaMedia(catId,p.id), mv:meuVoto(catId,p.id)}))
      .sort((a,b)=>b.nota-a.nota)
  }

  async function votar() {
    if (!votando || !myPersonId || !evento || !estrelas) return
    setSalvando(true)
    const { error } = await supabase.from('ranking_votos').upsert({
      event_id: evento.id,
      categoria_id: votando.cat.id,
      votante_id: myPersonId,
      votado_id: votando.pessoa.id,
      estrelas,
    }, { onConflict:'categoria_id,votante_id,votado_id' })
    if (!error) {
      setVotos(prev=>[
        ...prev.filter(v=>!(v.categoria_id===votando.cat.id && v.votante_id===myPersonId && v.votado_id===votando.pessoa.id)),
        {categoria_id:votando.cat.id,votante_id:myPersonId,votado_id:votando.pessoa.id,estrelas}
      ])
    }
    setSalvando(false); setVotando(null); setEstrelas(0)
  }

  if (loading) return <div className="page">{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:8,borderRadius:14}}/>)}</div>

  if (erro) return (
    <div className="page">
      <div className="alert-box alert-error">{erro}</div>
    </div>
  )

  if (categorias.length === 0) return (
    <div className="page">
      <div className="empty">
        <div className="empty-icon"><MatIcon name="leaderboard" size={28} color="var(--muted-light)"/></div>
        <p className="empty-title">Ranking não configurado</p>
        <p className="empty-desc">Clique abaixo para criar as 5 categorias padrão do ranking.</p>
        {canAdmin && (
          <button className="btn btn-primary" style={{marginTop:16}} onClick={criarCategorias}>
            <MatIcon name="auto_awesome" size={16} color="white"/> Criar 5 categorias padrão
          </button>
        )}
      </div>
    </div>
  )

  const lista = catSel ? rankingCompleto(catSel.id) : []
  const poderes = !!profile && (profile.role_status === 'approved' || profile.user_role === 'admin')

  return (
    <div className="page">
      {/* Chips de categoria */}
      <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4,scrollbarWidth:'none',marginBottom:16}}>
        {categorias.map(cat=>(
          <button key={cat.id} onClick={()=>setCatSel(cat)}
            style={{flexShrink:0,padding:'8px 14px',borderRadius:20,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600,
              border:`2px solid ${catSel?.id===cat.id?cat.cor:'var(--border)'}`,
              background:catSel?.id===cat.id?cat.cor+'22':'white',
              color:catSel?.id===cat.id?cat.cor:'var(--text2)',
              display:'flex',alignItems:'center',gap:6}}>
            <MatIcon name={cat.icone||'star'} size={14} color={catSel?.id===cat.id?cat.cor:'var(--muted)'}/>
            {cat.nome}
          </button>
        ))}
      </div>

      {catSel && (
        <>
          {/* Descrição da categoria */}
          {catSel.descricao && (
            <div style={{background:catSel.cor+'18',borderRadius:10,padding:'10px 14px',marginBottom:14,border:`1px solid ${catSel.cor}33`,display:'flex',alignItems:'center',gap:8}}>
              <MatIcon name={catSel.icone||'star'} size={18} color={catSel.cor}/>
              <p style={{fontSize:13,color:catSel.cor,fontWeight:600}}>{catSel.descricao}</p>
            </div>
          )}

          {/* Top 3 */}
          {top3(catSel.id).length > 0 && (
            <>
              <p className="section-label mb-2">🏆 Top 3</p>
              {top3(catSel.id).map((p,i)=>(
                <div key={p.id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:6,display:'flex',alignItems:'center',gap:12,padding:'10px 14px'}}>
                  <span style={{fontSize:20,flexShrink:0}}>{['🥇','🥈','🥉'][i]}</span>
                  <div style={{width:38,height:38,borderRadius:'50%',background:catSel.cor+'33',overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {p.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      :<span style={{fontWeight:700,fontSize:13,color:catSel.cor}}>{getInitials(p.name)}</span>}
                  </div>
                  <p style={{flex:1,fontWeight:700,fontSize:14}}>{p.name}</p>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <MatIcon name="star" size={16} color="#F6AD55"/>
                    <span style={{fontWeight:700,fontSize:14,color:catSel.cor}}>{p.nota.toFixed(1)}</span>
                  </div>
                </div>
              ))}
              <div style={{height:1,background:'var(--border)',margin:'12px 0'}}/>
            </>
          )}

          {/* Lista para votar */}
          <p className="section-label mb-2">
            {poderes ? 'Clique para votar' : 'Classificação'} — {pessoas.length} encontristas
          </p>
          {pessoas.length === 0 ? (
            <div className="empty"><p className="empty-desc">Nenhum encontrista cadastrado.</p></div>
          ) : lista.map((p,i)=>(
            <div key={p.id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,display:'flex',alignItems:'center',gap:12,padding:'12px 14px'}}>
              <span style={{fontSize:12,fontWeight:700,color:'var(--muted)',width:20,textAlign:'center',flexShrink:0}}>{i+1}</span>
              <div style={{width:40,height:40,borderRadius:'50%',background:'var(--primary-light)',overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {p.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  :<span style={{fontWeight:700,fontSize:13,color:'var(--primary)'}}>{getInitials(p.name)}</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontWeight:700,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</p>
                {p.mv>0 && <p style={{fontSize:11,color:catSel.cor,fontWeight:600}}>Meu voto: {p.mv}★</p>}
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                {p.nota>0 && <Estrelas valor={Math.round(p.nota)} size={16}/>}
                {poderes && (
                  <button onClick={()=>{setVotando({pessoa:p,cat:catSel});setEstrelas(p.mv)}}
                    style={{background:catSel.cor,color:'white',border:'none',borderRadius:8,padding:'5px 12px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
                    <MatIcon name="how_to_vote" size={13} color="white"/>
                    {p.mv>0?'Alterar':'Votar'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Modal votar */}
      {votando && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}
          onClick={e=>e.target===e.currentTarget&&setVotando(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 20px'}}/>
            <div style={{textAlign:'center'}}>
              <div style={{width:72,height:72,borderRadius:'50%',background:votando.cat.cor+'33',margin:'0 auto 12px',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {votando.pessoa.photo_url
                  ?<img src={votando.pessoa.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  :<span style={{fontWeight:700,fontSize:24,color:votando.cat.cor}}>{getInitials(votando.pessoa.name)}</span>}
              </div>
              <p style={{fontWeight:800,fontSize:18,marginBottom:4}}>{votando.pessoa.name}</p>
              <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'center',marginBottom:16}}>
                <MatIcon name={votando.cat.icone||'star'} size={16} color={votando.cat.cor}/>
                <p style={{fontSize:13,color:votando.cat.cor,fontWeight:700}}>{votando.cat.nome}</p>
              </div>
              <div style={{display:'flex',justifyContent:'center',gap:8,marginBottom:24}}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} type="button" onClick={()=>setEstrelas(n)}
                    style={{background:'none',border:'none',cursor:'pointer',padding:'4px',transform:estrelas>=n?'scale(1.25)':'scale(1)',transition:'transform 0.1s'}}>
                    <MatIcon name="star" size={42} color={estrelas>=n?'#F6AD55':'var(--border)'}/>
                  </button>
                ))}
              </div>
              <button className="btn btn-primary btn-full" disabled={!estrelas||salvando} onClick={votar}>
                {salvando?'Salvando...':estrelas?`Votar com ${estrelas} estrela${estrelas>1?'s':''}`:'Selecione as estrelas'}
              </button>
              <button className="btn btn-ghost btn-full" style={{marginTop:8}} onClick={()=>setVotando(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
