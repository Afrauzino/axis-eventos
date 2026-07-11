import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { getInitials } from '../utils'
import { useEvento } from '../hooks/useEvento'
import { useRegistrarChrome } from '../lib/chrome'
import { carregarConfig, salvarConfig } from '../lib/tema'
import { enviarPush } from '../lib/push'
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
        <button key={i} type="button" onMouseDown={e=>{e.preventDefault(); onChange?.(i+1===valor ? 0 : i+1)}}
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
  const [pessoaAberta, setPessoaAberta] = useState<Pessoa|null>(null)
  useVoltarFecha(!!pessoaAberta, () => setPessoaAberta(null))
  const [myPersonId, setMyPersonId] = useState<string|null>(null)
  const [aberto, setAberto] = useState(false)  // votação aberta? (admin inicia/termina)
  const [voltarPara, setVoltarPara] = useState<string|null>(null) // origem quando aberto via "Votar neste encontrista"
  const canAdmin = profile && ['admin','coordenador'].includes(profile.user_role)
  const location = useLocation()
  const navigate = useNavigate()

  // Deep-link: veio de "Votar neste encontrista" -> abre a pessoa direto
  useEffect(() => {
    if (!pessoas.length) return
    const st = location.state as any
    if (st?.votarPessoaId) {
      const p = pessoas.find(x=>x.id===st.votarPessoaId)
      if (p) { setPessoaAberta(p); setVoltarPara(st.origem ?? '/encontristas') }
      navigate(location.pathname, { replace:true, state:{} }) // limpa para não reabrir em refresh
    }
  }, [location.state, pessoas])

  // Fecha o modal da pessoa; se veio por deep-link, volta para a página de origem
  function fecharPessoa() {
    if (voltarPara) { const dest = voltarPara; setVoltarPara(null); setPessoaAberta(null); navigate(dest) }
    else setPessoaAberta(null)
  }

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
    const cfg = await carregarConfig('ranking_aberto')
    setAberto(cfg === '1')
    setLoading(false)
  }

  // Admin abre/fecha a votação. Abrir avisa todos no celular (não mexe no painel de regras).
  async function iniciarVotacao() {
    await salvarConfig('ranking_aberto', '1'); setAberto(true)
    if (evento) enviarPush({ alerta: { event_id: evento.id, target_type: 'all' }, title: '🏆 Votação do Ranking começou!', body: 'Vote nos destaques do encontro!', url: '/ranking' })
  }
  async function terminarVotacao() {
    if (!confirm('Terminar a votação? Ninguém mais poderá votar.')) return
    await salvarConfig('ranking_aberto', '0'); setAberto(false)
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

  // Vota / altera / TIRA o voto direto ao clicar na estrela — sem botão "votar".
  // estrelas <= 0 remove o voto de vez (não conta como 0, que baixaria a média).
  async function votarInline(catId:string, personId:string, novasEstrelas:number) {
    if (!myPersonId || !evento) return
    if (novasEstrelas <= 0) {
      // tira o voto (apaga a linha)
      setVotos(prev=>prev.filter(v=>!(v.categoria_id===catId && v.votante_id===myPersonId && v.votado_id===personId)))
      await supabase.from('ranking_votos').delete()
        .eq('event_id', evento.id).eq('categoria_id', catId).eq('votante_id', myPersonId).eq('votado_id', personId)
      return
    }
    // atualiza a tela na hora (otimista)
    setVotos(prev=>[
      ...prev.filter(v=>!(v.categoria_id===catId && v.votante_id===myPersonId && v.votado_id===personId)),
      {categoria_id:catId, votante_id:myPersonId, votado_id:personId, estrelas:novasEstrelas}
    ])
    await supabase.from('ranking_votos').upsert({
      event_id: evento.id, categoria_id: catId, votante_id: myPersonId, votado_id: personId, estrelas: novasEstrelas,
    }, { onConflict:'categoria_id,votante_id,votado_id' })
  }

  // Quantos votos essa pessoa recebeu numa categoria
  function totalVotos(catId:string, personId:string) {
    return votos.filter(v=>v.categoria_id===catId && v.votado_id===personId).length
  }

  // ⚙️ do topo: escolher a categoria do ranking (padrao das outras telas)
  useRegistrarChrome({
    grupos: categorias.length ? [{ chave:'categoria', label:'Categoria', opcoes: categorias.map(c=>({ value:c.id, label:c.nome })) }] : undefined,
    valores: { categoria: catSel?.id ?? '' },
    onFiltro: (_k, v) => { const c = categorias.find(x=>x.id===v); if (c) setCatSel(c) },
  }, [categorias, catSel])

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
  const podeVotar = poderes && aberto   // só vota com a votação ABERTA

  return (
    <div className="page">
      {/* Status da votação + controle do admin */}
      <div style={{background:'white',borderRadius:12,padding:'12px 14px',boxShadow:'var(--shadow-sm)',marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
        <span style={{fontSize:22}}>{aberto?'🟢':'🔴'}</span>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:14,fontWeight:800}}>{aberto?'Votação aberta':'Votação encerrada'}</p>
          <p style={{fontSize:12,color:'var(--muted)'}}>{aberto?'Todos podem votar agora.':'Ninguém pode votar — só ver o resultado.'}</p>
        </div>
        {canAdmin && (aberto
          ? <button className="btn btn-sm" style={{background:'var(--danger-bg)',color:'var(--danger)'}} onClick={terminarVotacao}>Terminar</button>
          : <button className="btn btn-sm btn-primary" onClick={iniciarVotacao}>Iniciar votação</button>)}
      </div>

      {/* Categoria atual (escolhida na ⚙️) */}
      {catSel && (
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
          <div style={{width:34,height:34,borderRadius:10,background:catSel.cor+'22',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <MatIcon name={catSel.icone||'star'} size={18} color={catSel.cor}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:16,fontWeight:800,color:catSel.cor,lineHeight:1.2}}>{catSel.nome}</p>
            <p style={{fontSize:11,color:'var(--muted)'}}>Toque na ⚙️ pra trocar de categoria</p>
          </div>
        </div>
      )}

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

          {/* Lista de pessoas — clique abre todas as categorias para votar */}
          <p className="section-label mb-2">
            {podeVotar ? 'Toque numa pessoa para ver e votar em todas as categorias' : 'Classificação'} — {pessoas.length} encontristas
          </p>
          {pessoas.length === 0 ? (
            <div className="empty"><p className="empty-desc">Nenhum encontrista cadastrado.</p></div>
          ) : lista.map((p,i)=>(
            <button key={p.id} onClick={()=>setPessoaAberta(p)}
              style={{width:'100%',textAlign:'left',fontFamily:'inherit',background:'white',borderRadius:12,border:'none',boxShadow:'0 1px 5px rgba(0,0,0,0.12)',marginBottom:10,display:'flex',alignItems:'center',gap:12,padding:'14px 15px',cursor:'pointer'}}>
              <span style={{fontSize:13,fontWeight:800,color:'var(--muted)',width:22,textAlign:'center',flexShrink:0}}>{i+1}</span>
              <div style={{width:50,height:50,borderRadius:'50%',background:'var(--primary-light)',overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {p.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  :<span style={{fontWeight:700,fontSize:16,color:'var(--primary)'}}>{getInitials(p.name)}</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontWeight:700,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</p>
                {p.mv>0 && <p style={{fontSize:11,color:catSel.cor,fontWeight:600}}>Meu voto: {p.mv}★</p>}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                {p.nota>0 && <Estrelas valor={Math.round(p.nota)} size={16}/>}
                <MatIcon name="chevron_right" size={20} color="var(--muted)"/>
              </div>
            </button>
          ))}
        </>
      )}

      {/* Modal da pessoa — todas as categorias, votos recebidos e votação inline */}
      {pessoaAberta && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}
          onClick={e=>e.target===e.currentTarget&&fecharPessoa()}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>

            {/* Cabeçalho da pessoa */}
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 20px'}}>
              <div style={{width:56,height:56,borderRadius:'50%',background:'var(--primary-light)',overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {pessoaAberta.photo_url
                  ?<img src={pessoaAberta.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  :<span style={{fontWeight:700,fontSize:20,color:'var(--primary)'}}>{getInitials(pessoaAberta.name)}</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontWeight:800,fontSize:18}}>{pessoaAberta.name}</p>
                <p style={{fontSize:12,color:'var(--muted)'}}>{podeVotar?'Toque nas estrelas para votar em cada categoria':'Votos recebidos'}</p>
              </div>
            </div>

            {/* Lista de categorias */}
            <div style={{padding:'4px 16px 28px'}}>
              {categorias.map(cat=>{
                const media = notaMedia(cat.id, pessoaAberta!.id)
                const qtd   = totalVotos(cat.id, pessoaAberta!.id)
                const meu   = meuVoto(cat.id, pessoaAberta!.id)
                return (
                  <div key={cat.id} style={{border:`1px solid ${cat.cor}33`,borderRadius:12,padding:'12px 14px',marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                      <MatIcon name={cat.icone||'star'} size={18} color={cat.cor}/>
                      <p style={{flex:1,fontSize:13,fontWeight:700,color:cat.cor}}>{cat.nome}</p>
                      <span style={{fontSize:12,fontWeight:700,color:'var(--muted)'}}>
                        {media>0?`${media.toFixed(1)}★`:'—'} · {qtd} voto{qtd===1?'':'s'}
                      </span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <span style={{fontSize:11,color:'var(--muted)'}}>{podeVotar?'Meu voto':'Média'}</span>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        {podeVotar && meu>0 && (
                          <button type="button" onClick={()=>votarInline(cat.id, pessoaAberta!.id, 0)}
                            style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',fontSize:11,fontWeight:700,fontFamily:'inherit',padding:'2px 4px'}}>Tirar voto</button>
                        )}
                        {podeVotar
                          ? <Estrelas valor={meu} size={26} onChange={v=>votarInline(cat.id, pessoaAberta!.id, v)}/>
                          : <Estrelas valor={Math.round(media)} size={22}/>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{padding:'0 20px 28px'}}>
              <button className="btn btn-ghost btn-full" onClick={fecharPessoa}>{voltarPara?'Concluir e voltar':'Fechar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
