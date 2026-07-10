import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from '../components/Toast'
import { getInitials, formatName, isAdmin } from '../utils'
import { enviarPush } from '../lib/push'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Pessoa = { id:string; name:string; photo_url:string|null; user_id:string|null }
type Equipe = { id:string; name:string; leader_id:string|null; co_leader_id:string|null }
type Alerta = { id:string; remetente_nome:string|null; texto:string|null; foto_url:string|null; nivel:string|null; destino:string|null; created_at:string; lido?:boolean; dest_id?:string }
type Enviado = { id:string; texto:string|null; foto_url:string|null; nivel:string|null; created_at:string; total:number; lidos:number; nomes:{nome:string;lido:boolean}[] }

export default function AlertasLideres({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [minhaPessoa, setMinhaPessoa] = useState<Pessoa|null>(null)
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [recebidos, setRecebidos] = useState<Alerta[]>([])
  const [enviados, setEnviados] = useState<Enviado[]>([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<'recebidos'|'enviar'|'enviados'>('recebidos')

  // envio: lideres | equipe | encontreiros
  const [destino, setDestino] = useState<'lideres'|'equipe'|'encontreiros'>('lideres')
  const [nivel, setNivel] = useState<'comum'|'critico'>('comum')
  const [selec, setSelec] = useState<string[]>([])        // pessoas
  const [equipeSel, setEquipeSel] = useState<string[]>([]) // equipes (para equipes)
  const [equipeEnc, setEquipeEnc] = useState<string>('')   // 1 equipe escolhida (encontreiros) p/ listar membros
  const [todosEnc, setTodosEnc] = useState(false)          // mandar para TODOS os encontreiros do evento
  const [texto, setTexto] = useState('')
  const [foto, setFoto] = useState<File|null>(null)
  const [enviando, setEnviando] = useState(false)
  const [busca, setBusca] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [comAcesso, setComAcesso] = useState<Set<string>>(new Set())
  const [membrosCache, setMembrosCache] = useState<Record<string,string[]>>({}) // team_id -> [person_id]
  const [fotoAberta, setFotoAberta] = useState<Alerta|null>(null)
  const admin = isAdmin(profile?.user_role) || profile?.is_admin

  useEffect(() => { if (!evLoading) carregar() }, [evento, evLoading])

  async function carregar() {
    setLoading(true)
    let minha: Pessoa|null = null
    if (profile?.user_id) {
      const { data } = await supabase.from('people').select('id,name,photo_url,user_id').eq('user_id', profile.user_id).maybeSingle()
      minha = data; setMinhaPessoa(data)
    }
    const eid = evento?.id
    const [psR, eqR, vincsR] = await Promise.all([
      supabase.from('people').select('id,name,photo_url,user_id').not('user_id','is',null).order('name'),
      eid ? supabase.from('teams').select('id,name,leader_id,co_leader_id').eq('event_id', eid).order('name') : Promise.resolve({data:[]} as any),
      supabase.from('people_teams').select('person_id,team_id'),
    ])
    setPessoas(psR.data ?? [])
    setEquipes(eqR.data ?? [])

    // mapa equipe -> membros
    const mc: Record<string,string[]> = {}
    ;(vincsR.data ?? []).forEach(v => { (mc[v.team_id] ??= []).push(v.person_id) })
    setMembrosCache(mc)

    // acesso ao menu
    const [perms, adminsData] = await Promise.all([
      supabase.from('permissoes').select('person_id,team_id,permitido').eq('modulo','menu_alertas_lideres').eq('permitido', true),
      supabase.from('profiles').select('user_id').eq('is_admin', true),
    ])
    const acesso = new Set<string>()
    const teamsLib = new Set((perms.data ?? []).filter(p=>p.team_id).map(p=>p.team_id))
    ;(vincsR.data ?? []).forEach(v => { if (teamsLib.has(v.team_id)) acesso.add(v.person_id) })
    ;(perms.data ?? []).forEach(p => { if (p.person_id) acesso.add(p.person_id) })
    const adminUserIds = new Set((adminsData.data ?? []).map(a=>a.user_id))
    ;(psR.data ?? []).forEach(p => { if (p.user_id && adminUserIds.has(p.user_id)) acesso.add(p.id) })
    setComAcesso(acesso)

    if (minha) {
      // recebidos
      const { data: dest } = await supabase.from('alertas_lideres_dest')
        .select('id,lido,alerta_id,alertas_lideres(id,remetente_nome,texto,foto_url,nivel,destino,created_at)')
        .eq('destinatario_id', minha.id).order('id',{ascending:false})
      setRecebidos((dest ?? []).map((d:any) => ({ ...d.alertas_lideres, lido:d.lido, dest_id:d.id })).filter((a:any)=>a.id))

      // enviados por mim
      const { data: meus } = await supabase.from('alertas_lideres')
        .select('id,texto,foto_url,nivel,created_at').eq('remetente_id', minha.id).order('created_at',{ascending:false})
      if (meus && meus.length) {
        const ids = meus.map(m=>m.id)
        const { data: dests } = await supabase.from('alertas_lideres_dest')
          .select('alerta_id,lido,destinatario_id').in('alerta_id', ids)
        const pessoaNome: Record<string,string> = {}
        ;(psR.data ?? []).forEach(p => pessoaNome[p.id] = p.name)
        const lista: Enviado[] = meus.map(m => {
          const ds = (dests ?? []).filter(d=>d.alerta_id===m.id)
          return {
            ...m, total: ds.length, lidos: ds.filter(d=>d.lido).length,
            nomes: ds.map(d=>({ nome: pessoaNome[d.destinatario_id] ?? '—', lido: d.lido })),
          }
        })
        setEnviados(lista)
      } else setEnviados([])
    }
    setLoading(false)
  }

  const minhasEquipesLideradas = admin ? equipes : equipes.filter(e => e.leader_id===minhaPessoa?.id || e.co_leader_id===minhaPessoa?.id)
  const ehLider = admin || minhasEquipesLideradas.length>0
  // equipes onde sou MEMBRO (para encontreiros)
  const minhasEquipesMembro = equipes.filter(e => (membrosCache[e.id] ?? []).includes(minhaPessoa?.id ?? ''))

  function toggleSelec(id:string) { setSelec(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]) }

  async function enviar() {
    let destinatarios: string[] = []
    if (destino==='lideres') {
      destinatarios = selec
      if (destinatarios.length===0) { toast.aviso('Selecione ao menos um líder.'); return }
    } else if (destino==='equipe') {
      if (equipeSel.length===0) { toast.aviso('Selecione ao menos uma equipe.'); return }
      const { data: membros } = await supabase.from('people_teams').select('person_id').in('team_id', equipeSel)
      destinatarios = Array.from(new Set((membros ?? []).map(m=>m.person_id)))
      if (destinatarios.length===0) { toast.aviso('As equipes não têm membros.'); return }
    } else { // encontreiros
      if (todosEnc) {
        // TODOS os encontreiros do evento (role_type = worker)
        const { data: workers } = await supabase.from('people').select('id')
          .eq('event_id', evento?.id ?? '').eq('role_type','worker').not('user_id','is',null)
        destinatarios = (workers ?? []).map(w=>w.id).filter(id => id !== minhaPessoa?.id)
        if (destinatarios.length===0) { toast.aviso('Não há encontreiros no evento.'); return }
      } else { // pessoas específicas dentro da equipe
        destinatarios = selec
        if (destinatarios.length===0) { toast.aviso('Selecione ao menos uma pessoa.'); return }
      }
    }
    if (!texto.trim() && !foto) { toast.aviso('Escreva um texto ou anexe uma foto.'); return }
    // crítico só para líder
    const nivelFinal = (ehLider ? nivel : 'comum')
    setEnviando(true)
    let fotoUrl: string|null = null
    if (foto) {
      const ext = foto.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('alertas').upload(path, foto, { upsert:true })
      if (!error) { const { data:u } = supabase.storage.from('alertas').getPublicUrl(path); fotoUrl = u.publicUrl }
    }
    const { data: al } = await supabase.from('alertas_lideres').insert({
      event_id: evento?.id ?? null, remetente_id: minhaPessoa?.id ?? null,
      remetente_nome: minhaPessoa?.name ?? profile?.full_name ?? null,
      texto: texto.trim() || null, foto_url: fotoUrl, nivel: nivelFinal, destino,
    }).select().single()
    if (al) await supabase.from('alertas_lideres_dest').insert(destinatarios.map(d => ({ alerta_id: al.id, destinatario_id: d })))
    // Avisa no celular (app fechado) quem recebeu
    enviarPush({
      person_ids: destinatarios,
      title: nivelFinal==='critico' ? '🚨 Alerta crítico da liderança' : '📨 Aviso da liderança',
      body: (texto.trim().slice(0,140)) || '📷 Foto',
      url: '/alertas-lideres',
      tag: nivelFinal==='critico' ? undefined : 'aviso-lider',
    })
    setEnviando(false); setTexto(''); setFoto(null); setSelec([]); setEquipeSel([]); setEquipeEnc(''); setTodosEnc(false)
    toast.sucesso('Alerta enviado!'); setAba('enviados'); carregar()
  }

  async function marcarLido(a: Alerta) {
    if (a.dest_id && !a.lido) {
      await supabase.from('alertas_lideres_dest').update({ lido:true, lido_em:new Date().toISOString() }).eq('id', a.dest_id)
      setRecebidos(prev => prev.map(x => x.dest_id===a.dest_id ? {...x, lido:true} : x))
    }
    setFotoAberta(null)
  }

  if (evLoading || loading) return <div className="page">{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:10,borderRadius:14}}/>)}</div>

  const podeEnviar = ehLider || comAcesso.has(minhaPessoa?.id??'') || minhasEquipesMembro.length>0

  // lista de pessoas para destino 'encontreiros' (membros da equipe escolhida)
  const membrosDaEquipeEnc = equipeEnc ? pessoas.filter(p => (membrosCache[equipeEnc] ?? []).includes(p.id) && p.id!==minhaPessoa?.id) : []

  return (
    <div className="page slide-up">
      <div className="tabs mb-4">
        <button className={`tab ${aba==='recebidos'?'active':''}`} onClick={()=>setAba('recebidos')}>Recebidos</button>
        {podeEnviar && <button className={`tab ${aba==='enviar'?'active':''}`} onClick={()=>setAba('enviar')}>Enviar</button>}
        {podeEnviar && <button className={`tab ${aba==='enviados'?'active':''}`} onClick={()=>setAba('enviados')}>Enviados</button>}
      </div>

      {/* ===== RECEBIDOS ===== */}
      {aba==='recebidos' && (
        recebidos.length===0
          ? <div className="empty"><p className="empty-title">Nenhum alerta</p></div>
          : recebidos.map(a => (
            <div key={a.dest_id} onClick={()=> (a.foto_url||a.nivel==='critico') ? setFotoAberta(a) : marcarLido(a)}
              style={{background:'white',borderRadius:14,padding:'14px 16px',marginBottom:8,boxShadow:'var(--shadow-sm)',cursor:'pointer',borderLeft:`4px solid ${a.nivel==='critico'?'var(--danger)':(a.lido?'var(--border)':'var(--primary)')}`}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:700}}>{a.remetente_nome?formatName(a.remetente_nome):'Líder'}{a.nivel==='critico' && <span style={{marginLeft:6,fontSize:10,color:'white',background:'var(--danger)',padding:'1px 6px',borderRadius:99,fontWeight:700}}>CRÍTICO</span>}</span>
                {!a.lido && <span style={{fontSize:10,color:'var(--danger)',fontWeight:700}}>● novo</span>}
              </div>
              {a.texto && <p style={{fontSize:13,color:'var(--text)'}}>{a.texto}</p>}
              {a.foto_url && <p style={{fontSize:11,color:'var(--primary)',fontWeight:600,marginTop:4}}>📷 Toque para ver</p>}
              {a.lido && <p style={{fontSize:10,color:'var(--success)',fontWeight:600,marginTop:4}}>✓ Leitura confirmada</p>}
            </div>
          ))
      )}

      {/* ===== ENVIADOS ===== */}
      {aba==='enviados' && (
        enviados.length===0
          ? <div className="empty"><p className="empty-title">Nada enviado ainda</p></div>
          : enviados.map(e => (
            <div key={e.id} style={{background:'white',borderRadius:14,padding:'14px 16px',marginBottom:8,boxShadow:'var(--shadow-sm)'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                {e.nivel==='critico' && <span style={{fontSize:10,color:'white',background:'var(--danger)',padding:'1px 6px',borderRadius:99,fontWeight:700}}>CRÍTICO</span>}
                <span style={{fontSize:11,color:'var(--success)',fontWeight:700,marginLeft:'auto'}}>{e.lidos}/{e.total} leram</span>
              </div>
              {e.texto && <p style={{fontSize:13,color:'var(--text)',marginBottom:8}}>{e.texto}</p>}
              {e.foto_url && <p style={{fontSize:11,color:'var(--primary)',marginBottom:8}}>📷 com foto</p>}
              <details>
                <summary style={{fontSize:11,color:'var(--muted)',cursor:'pointer',fontWeight:600}}>Ver destinatários ({e.total})</summary>
                <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:4}}>
                  {e.nomes.map((n,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:12}}>
                      <span>{formatName(n.nome)}</span>
                      <span style={{color:n.lido?'var(--success)':'var(--muted)',fontWeight:600}}>{n.lido?'✓ Leu':'• Não leu'}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ))
      )}

      {/* ===== ENVIAR ===== */}
      {aba==='enviar' && (
        <>
          {/* Destino — régua */}
          <div className="tabs mb-3" style={{flexWrap:'wrap'}}>
            {ehLider && <button className={`tab ${destino==='lideres'?'active':''}`} onClick={()=>{setDestino('lideres');setSelec([])}}>Entre líderes</button>}
            {ehLider && <button className={`tab ${destino==='equipe'?'active':''}`} onClick={()=>{setDestino('equipe');setSelec([])}}>Para equipes</button>}
            {(ehLider || minhasEquipesMembro.length>0) && <button className={`tab ${destino==='encontreiros'?'active':''}`} onClick={()=>{setDestino('encontreiros');setSelec([]);setTodosEnc(ehLider)}}>Encontreiros</button>}
          </div>

          {/* Nível — crítico só p/ líder */}
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <button onClick={()=>setNivel('comum')} style={{flex:1,padding:'10px',borderRadius:10,border:nivel==='comum'?'2px solid var(--primary)':'1px solid var(--border)',background:nivel==='comum'?'var(--primary-light)':'white',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700,color:nivel==='comum'?'var(--primary)':'var(--muted)'}}>🔔 Comum</button>
            {ehLider && <button onClick={()=>setNivel('critico')} style={{flex:1,padding:'10px',borderRadius:10,border:nivel==='critico'?'2px solid var(--danger)':'1px solid var(--border)',background:nivel==='critico'?'#FFF5F5':'white',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700,color:nivel==='critico'?'var(--danger)':'var(--muted)'}}>🚨 Crítico</button>}
          </div>

          <div style={{background:'white',borderRadius:14,padding:'14px 16px',marginBottom:12,boxShadow:'var(--shadow-sm)'}}>
            <label className="form-label">Mensagem</label>
            <textarea className="form-input" value={texto} onChange={e=>setTexto(e.target.value)} placeholder="Escreva o alerta..." rows={3} style={{resize:'vertical'}}/>
            <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>setFoto(e.target.files?.[0]??null)}/>
            <button className="btn btn-ghost btn-sm btn-full" onClick={()=>fileRef.current?.click()} style={{marginTop:8}}>
              <span className="icon icon-sm">image</span> {foto?foto.name:'Anexar foto (opcional)'}
            </button>
          </div>

          {/* PARA EQUIPES (multi) */}
          {destino==='equipe' && (
            <>
              <p style={{fontSize:12,fontWeight:700,color:'var(--muted)',marginBottom:8}}>Para quais equipes? (todos os membros) — {equipeSel.length} selecionada(s)</p>
              {minhasEquipesLideradas.length===0
                ? <p style={{fontSize:12,color:'var(--muted)',padding:12,background:'white',borderRadius:12}}>Você não lidera nenhuma equipe.</p>
                : <div style={{background:'white',borderRadius:14,overflow:'hidden',boxShadow:'var(--shadow-sm)',marginBottom:12}}>
                    {minhasEquipesLideradas.map(eq => {
                      const at = equipeSel.includes(eq.id)
                      return (
                      <div key={eq.id} onClick={()=>setEquipeSel(prev=>prev.includes(eq.id)?prev.filter(x=>x!==eq.id):[...prev,eq.id])} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer',background:at?'var(--primary-light)':'white'}}>
                        <span className="icon" style={{color:'var(--primary)'}}>shield</span>
                        <span style={{flex:1,fontSize:13,fontWeight:600}}>{eq.name}</span>
                        {at && <span className="icon" style={{color:'var(--primary)'}}>check_circle</span>}
                      </div>
                    )})}
                  </div>
              }
            </>
          )}

          {/* ENTRE LÍDERES (multi pessoas) */}
          {destino==='lideres' && (
            <>
              <p style={{fontSize:12,fontWeight:700,color:'var(--muted)',marginBottom:8}}>Para quais líderes? ({selec.length} selecionado(s))</p>
              <div className="search-bar mb-2">
                <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
                <input placeholder="Buscar por nome..." value={busca} onChange={e=>setBusca(e.target.value)}/>
              </div>
              <div style={{background:'white',borderRadius:14,overflow:'hidden',boxShadow:'var(--shadow-sm)',marginBottom:12,maxHeight:300,overflowY:'auto'}}>
                {pessoas.filter(p=>p.id!==minhaPessoa?.id).filter(p=>comAcesso.has(p.id)).filter(p=>formatName(p.name).toLowerCase().includes(busca.toLowerCase())).map(p => {
                  const ativo = selec.includes(p.id)
                  return (
                    <div key={p.id} onClick={()=>toggleSelec(p.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer',background:ativo?'var(--primary-light)':'white'}}>
                      {p.photo_url ? <img src={p.photo_url} alt="" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/> : <div style={{width:32,height:32,borderRadius:'50%',background:'var(--primary-light)',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,flexShrink:0}}>{getInitials(p.name)}</div>}
                      <span style={{flex:1,fontSize:13,fontWeight:600}}>{formatName(p.name)}</span>
                      {ativo && <span className="icon" style={{color:'var(--primary)'}}>check_circle</span>}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* ENCONTREIROS: TODOS, ou escolhe equipe -> pessoas dentro */}
          {destino==='encontreiros' && (
            <>
              {ehLider && (
                <div style={{display:'flex',gap:8,marginBottom:12}}>
                  <button onClick={()=>{setTodosEnc(true);setEquipeEnc('');setSelec([])}} style={{flex:1,padding:'10px',borderRadius:10,border:todosEnc?'2px solid var(--primary)':'1px solid var(--border)',background:todosEnc?'var(--primary-light)':'white',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700,color:todosEnc?'var(--primary)':'var(--muted)'}}>🛡️ Todos os encontreiros</button>
                  <button onClick={()=>setTodosEnc(false)} style={{flex:1,padding:'10px',borderRadius:10,border:!todosEnc?'2px solid var(--primary)':'1px solid var(--border)',background:!todosEnc?'var(--primary-light)':'white',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700,color:!todosEnc?'var(--primary)':'var(--muted)'}}>Escolher equipe/pessoas</button>
                </div>
              )}
              {todosEnc ? (
                <div style={{background:'var(--primary-light)',borderRadius:12,padding:'14px 16px',marginBottom:12,fontSize:13,color:'var(--primary-dark)',fontWeight:600}}>🛡️ Este alerta vai para <b>todos os encontreiros do evento</b>.</div>
              ) : (
              <>
              <p style={{fontSize:12,fontWeight:700,color:'var(--muted)',marginBottom:8}}>1. Escolha a equipe</p>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
                {minhasEquipesMembro.map(eq => (
                  <button key={eq.id} onClick={()=>{setEquipeEnc(eq.id);setSelec([])}} style={{padding:'8px 12px',borderRadius:99,border:equipeEnc===eq.id?'2px solid var(--primary)':'1px solid var(--border)',background:equipeEnc===eq.id?'var(--primary-light)':'white',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700,color:equipeEnc===eq.id?'var(--primary)':'var(--muted)'}}>{eq.name}</button>
                ))}
              </div>
              {equipeEnc && (
                <>
                  <p style={{fontSize:12,fontWeight:700,color:'var(--muted)',marginBottom:8}}>2. Escolha as pessoas ({selec.length} selecionada(s))</p>
                  <div className="search-bar mb-2">
                    <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
                    <input placeholder="Buscar por nome..." value={busca} onChange={e=>setBusca(e.target.value)}/>
                  </div>
                  <div style={{background:'white',borderRadius:14,overflow:'hidden',boxShadow:'var(--shadow-sm)',marginBottom:12,maxHeight:300,overflowY:'auto'}}>
                    {membrosDaEquipeEnc.filter(p=>formatName(p.name).toLowerCase().includes(busca.toLowerCase())).map(p => {
                      const ativo = selec.includes(p.id)
                      return (
                        <div key={p.id} onClick={()=>toggleSelec(p.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer',background:ativo?'var(--primary-light)':'white'}}>
                          {p.photo_url ? <img src={p.photo_url} alt="" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/> : <div style={{width:32,height:32,borderRadius:'50%',background:'var(--primary-light)',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,flexShrink:0}}>{getInitials(p.name)}</div>}
                          <span style={{flex:1,fontSize:13,fontWeight:600}}>{formatName(p.name)}</span>
                          {ativo && <span className="icon" style={{color:'var(--primary)'}}>check_circle</span>}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
              </>
              )}
            </>
          )}

          <button className="btn btn-primary btn-full" onClick={enviar} disabled={enviando}>{enviando?'Enviando...':'Enviar alerta'}</button>
        </>
      )}

      {/* Crítico/foto em tela cheia com OK */}
      {fotoAberta && (
        <div style={{position:'fixed',inset:0,background:fotoAberta.nivel==='critico'?'rgba(180,0,0,0.96)':'rgba(0,0,0,0.92)',zIndex:600,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24}}>
          {fotoAberta.nivel==='critico' && <p style={{color:'white',fontSize:13,fontWeight:800,letterSpacing:'0.1em',marginBottom:12}}>🚨 ALERTA CRÍTICO</p>}
          <p style={{color:'white',fontSize:12,opacity:0.8,marginBottom:8}}>{fotoAberta.remetente_nome?formatName(fotoAberta.remetente_nome):'Líder'}</p>
          {fotoAberta.texto && <p style={{color:'white',fontSize:18,fontWeight:600,textAlign:'center',marginBottom:16,maxWidth:420}}>{fotoAberta.texto}</p>}
          {fotoAberta.foto_url && <img src={fotoAberta.foto_url} alt="" style={{maxWidth:'100%',maxHeight:'60vh',objectFit:'contain',borderRadius:12,marginBottom:20}}/>}
          <button className="btn" onClick={()=>marcarLido(fotoAberta)} style={{minWidth:160,background:'white',color:fotoAberta.nivel==='critico'?'var(--danger)':'var(--text)',fontWeight:800}}>OK, confirmar leitura</button>
        </div>
      )}
    </div>
  )
}
