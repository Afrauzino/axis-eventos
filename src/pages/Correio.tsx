import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import PrintOverlay from '../components/PrintOverlay'
import { toast } from '../components/Toast'
import CardItem from '../components/CardItem'
import FotoAmpliada from '../components/FotoAmpliada'
import { useRegistrarChrome } from '../lib/chrome'
import { getInitials, isAdmin, formatName } from '../utils'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Pessoa   = { id:string; name:string; photo_url:string|null; role_type:string; user_id:string|null; referencia_id:string|null }
type ItemChk  = { id:string; texto:string; ordem:number }
type Padrinho = { id:string; padrinho_id:string; afiliado_id:string }
type StatusChk= { id:string; afiliado_id:string; item_id:string; concluido:boolean }
type Arquivo  = { id:string; afiliado_id:string; nome:string; url:string; tipo:string|null; created_at:string }
type AfStatus = { afiliado_id:string; status:string }

const STATUS_LABEL: Record<string,{label:string;cor:string}> = {
  em_processo: { label:'Em processo', cor:'var(--warning)' },
  concluido:   { label:'Concluído',   cor:'var(--success)' },
  cancelado:   { label:'Cancelado',   cor:'var(--danger)' },
}

export default function Correio({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [loading, setLoading]   = useState(true)
  const [minhaPessoa, setMinhaPessoa] = useState<Pessoa|null>(null)
  const [souLider, setSouLider] = useState(false)
  const [souCorreio, setSouCorreio] = useState(false)

  const [encontristas, setEncontristas] = useState<Pessoa[]>([])
  const [todasPessoas, setTodasPessoas] = useState<Pessoa[]>([])
  const [checklist, setChecklist]   = useState<ItemChk[]>([])
  const [padrinhos, setPadrinhos]   = useState<Padrinho[]>([])
  const [statusChk, setStatusChk]   = useState<StatusChk[]>([])
  const [arquivos, setArquivos]     = useState<Arquivo[]>([])
  const [afStatus, setAfStatus]     = useState<AfStatus[]>([])
  const [correioIds, setCorreioIds] = useState<string[]>([]) // person_ids da equipe Correio (só eles podem ser padrinho)

  // aba: 'meus' (padrinho) | 'todos' (líder) | 'config' (líder de correio)
  const [aba, setAba] = useState<'meus'|'todos'|'config'>('meus')
  const [afiliadoAberto, setAfiliadoAberto] = useState<Pessoa|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadando, setUploadando] = useState(false)
  const [imprimir, setImprimir] = useState(false)

  // config do líder de correio
  const [novoItem, setNovoItem] = useState('')
  const [modalPadrinho, setModalPadrinho] = useState<Pessoa|null>(null) // afiliado a quem atribuir padrinhos
  useVoltarFecha(!!modalPadrinho, () => setModalPadrinho(null))
  const [buscaPadrinho, setBuscaPadrinho] = useState('') // filtro de nome no modal de padrinhos
  const [fotoAmpliada, setFotoAmpliada] = useState<string|null>(null)
  useRegistrarChrome(aba==='todos' ? { impressoes:[{ label:'Imprimir com checklist', onClick:()=>setImprimir(true) }] } : {}, [aba])

  // Admin e Líder veem tudo. Membro da equipe Correio vê só "Meus Afilhados".
  const podeVerTudo = isAdmin(profile?.user_role) || souLider

  useEffect(() => {
    if (evLoading) return
    if (!evento) { setLoading(false); return }
    carregar()
  }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const eid = evento.id

    // Minha pessoa (para saber se sou padrinho/líder)
    let minha: Pessoa|null = null
    if (profile?.user_id) {
      const { data } = await supabase.from('people')
        .select('id,name,photo_url,role_type,user_id,referencia_id')
        .eq('user_id', profile.user_id).maybeSingle()
      minha = data
      setMinhaPessoa(data)
    }

    // Equipe(s) Correio do evento + todos os seus integrantes (líder, co-líder e membros).
    // SÓ quem está na equipe Correio pode ser padrinho.
    let lider = false, correio = false
    const idsCorreio = new Set<string>()
    const { data: teamsCorreio } = await supabase.from('teams')
      .select('id,name,leader_id,co_leader_id,equipe_correio').eq('event_id', eid)
      .or('equipe_correio.eq.true,name.ilike.%correio%')
    if (teamsCorreio && teamsCorreio.length) {
      const ids = teamsCorreio.map(t=>t.id)
      // líderes e co-líderes já contam como integrantes da equipe
      teamsCorreio.forEach(t => { if (t.leader_id) idsCorreio.add(t.leader_id); if (t.co_leader_id) idsCorreio.add(t.co_leader_id) })
      const { data: membros } = await supabase.from('people_teams')
        .select('person_id').in('team_id', ids)
      ;(membros ?? []).forEach(m => idsCorreio.add(m.person_id))
      if (minha) {
        lider   = teamsCorreio.some(t => t.leader_id === minha!.id || t.co_leader_id === minha!.id)
        correio = idsCorreio.has(minha.id)
      }
    }
    setCorreioIds([...idsCorreio])
    setSouLider(lider)
    setSouCorreio(correio)

    const [enc, todas, chk, pad, st, arq, afs] = await Promise.all([
      supabase.from('people').select('id,name,photo_url,role_type,user_id,referencia_id').eq('event_id',eid).eq('role_type','encounterer').order('name'),
      supabase.from('people').select('id,name,photo_url,role_type,user_id,referencia_id').eq('event_id',eid).order('name'),
      supabase.from('correio_checklist_itens').select('*').eq('event_id',eid).order('ordem'),
      supabase.from('correio_padrinhos').select('*').eq('event_id',eid),
      supabase.from('correio_checklist_status').select('*').eq('event_id',eid),
      supabase.from('correio_arquivos').select('*').eq('event_id',eid).order('created_at',{ascending:false}),
      supabase.from('correio_afiliado_status').select('afiliado_id,status').eq('event_id',eid),
    ])
    setEncontristas(enc.data ?? [])
    setTodasPessoas(todas.data ?? [])
    setChecklist(chk.data ?? [])
    setPadrinhos(pad.data ?? [])
    setStatusChk(st.data ?? [])
    setArquivos(arq.data ?? [])
    setAfStatus(afs.data ?? [])

    // Aba inicial: líder/correio começa em "todos", padrinho em "meus"
    if (lider || isAdmin(profile?.user_role)) setAba('todos')
    else setAba('meus')

    setLoading(false)
  }

  // ===== AFILIADOS QUE EU VEJO =====
  const meusAfiliadosIds = padrinhos
    .filter(p => p.padrinho_id === minhaPessoa?.id)
    .map(p => p.afiliado_id)
  const meusAfiliados = encontristas.filter(e => meusAfiliadosIds.includes(e.id))

  // Concluídos vão para o fim da lista
  function ordenarPorStatus(lista: Pessoa[]): Pessoa[] {
    return [...lista].sort((a,b) => {
      const sa = statusDe(a.id) === 'concluido' ? 1 : 0
      const sb = statusDe(b.id) === 'concluido' ? 1 : 0
      if (sa !== sb) return sa - sb
      return a.name.localeCompare(b.name)
    })
  }

  // ===== PROGRESSO =====
  function progressoAfiliado(afiliadoId: string): number {
    if (checklist.length === 0) return 0
    const feitos = statusChk.filter(s => s.afiliado_id === afiliadoId && s.concluido).length
    return Math.round((feitos / checklist.length) * 100)
  }
  function statusDe(afiliadoId: string): string {
    return afStatus.find(s => s.afiliado_id === afiliadoId)?.status ?? 'em_processo'
  }

  // Progresso do conjunto: concluídos sobre os ativos (cancelados saem da conta)
  function progressoConjunto(afiliados: Pessoa[]): number {
    const ativos = afiliados.filter(a => statusDe(a.id) !== 'cancelado')
    if (ativos.length === 0) return 0
    const concluidos = ativos.filter(a => statusDe(a.id) === 'concluido').length
    return Math.round((concluidos / ativos.length) * 100)
  }

  // ===== AÇÕES =====
  async function toggleItem(afiliadoId: string, itemId: string, atual: boolean) {
    const existe = statusChk.find(s => s.afiliado_id === afiliadoId && s.item_id === itemId)
    if (existe) {
      await supabase.from('correio_checklist_status').update({
        concluido: !atual, concluido_em: !atual ? new Date().toISOString() : null,
        concluido_por: minhaPessoa?.id ?? null,
      }).eq('id', existe.id)
      setStatusChk(prev => prev.map(s => s.id === existe.id ? { ...s, concluido: !atual } : s))
    } else {
      const { data } = await supabase.from('correio_checklist_status').insert({
        event_id: evento!.id, afiliado_id: afiliadoId, item_id: itemId,
        concluido: true, concluido_em: new Date().toISOString(), concluido_por: minhaPessoa?.id ?? null,
      }).select().single()
      if (data) setStatusChk(prev => [...prev, data])
    }
  }

  async function mudarStatusAfiliado(afiliadoId: string, status: string) {
    const existe = afStatus.find(s => s.afiliado_id === afiliadoId)
    if (existe) {
      await supabase.from('correio_afiliado_status').update({ status, updated_at:new Date().toISOString() }).eq('afiliado_id', afiliadoId).eq('event_id', evento!.id)
      setAfStatus(prev => prev.map(s => s.afiliado_id === afiliadoId ? { ...s, status } : s))
    } else {
      await supabase.from('correio_afiliado_status').insert({ event_id:evento!.id, afiliado_id:afiliadoId, status })
      setAfStatus(prev => [...prev, { afiliado_id:afiliadoId, status }])
    }
  }

  async function subirArquivo(afiliadoId: string, file: File) {
    setUploadando(true)
    const ext = file.name.split('.').pop()
    const path = `${evento!.id}/${afiliadoId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('correio').upload(path, file, { upsert:true })
    if (error) {
      setUploadando(false)
      toast.falha('Não foi possível enviar o arquivo.', error)
      return
    }
    const { data:u } = supabase.storage.from('correio').getPublicUrl(path)
    const { data, error: dbErr } = await supabase.from('correio_arquivos').insert({
      event_id: evento!.id, afiliado_id: afiliadoId, nome: file.name,
      url: u.publicUrl, tipo: file.type, tamanho: file.size, enviado_por: minhaPessoa?.id ?? null,
    }).select().single()
    setUploadando(false)
    if (dbErr) { toast.falha('Não foi possível registrar o arquivo.', dbErr); return }
    if (data) { setArquivos(prev => [data, ...prev]); toast.sucesso('Arquivo enviado!') }
  }

  async function excluirArquivo(arq: Arquivo) {
    if (!confirm(`Excluir "${arq.nome}"?`)) return
    await supabase.from('correio_arquivos').delete().eq('id', arq.id)
    setArquivos(prev => prev.filter(a => a.id !== arq.id))
  }

  // ---- Config do líder de correio ----
  async function addItemChecklist() {
    if (!novoItem.trim()) return
    const { data } = await supabase.from('correio_checklist_itens').insert({
      event_id: evento!.id, texto: novoItem.trim(), ordem: checklist.length,
    }).select().single()
    if (data) { setChecklist(prev => [...prev, data]); setNovoItem('') }
  }
  async function removerItemChecklist(id: string) {
    await supabase.from('correio_checklist_itens').delete().eq('id', id)
    setChecklist(prev => prev.filter(i => i.id !== id))
  }
  async function togglePadrinho(afiliadoId: string, padrinhoId: string) {
    const existe = padrinhos.find(p => p.afiliado_id === afiliadoId && p.padrinho_id === padrinhoId)
    if (existe) {
      await supabase.from('correio_padrinhos').delete().eq('id', existe.id)
      setPadrinhos(prev => prev.filter(p => p.id !== existe.id))
    } else {
      const { data } = await supabase.from('correio_padrinhos').insert({
        event_id: evento!.id, afiliado_id: afiliadoId, padrinho_id: padrinhoId,
      }).select().single()
      if (data) setPadrinhos(prev => [...prev, data])
    }
  }

  if (evLoading || loading) return (
    <div className="page">{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:10,borderRadius:14}}/>)}</div>
  )
  if (!evento) return <div className="page"><div className="empty"><p className="empty-title">Nenhum evento ativo</p></div></div>

  const arquivosDe = (afId:string) => arquivos.filter(a => a.afiliado_id === afId)

  // Quem pode ser padrinho: SOMENTE integrantes da equipe Correio (líder, co-líder e membros).
  const possiveisPadrinhos = todasPessoas.filter(p => correioIds.includes(p.id))

  return (
    <div className="page slide-up">
      {/* Abas conforme papel */}
      <div className="tabs mb-4" style={{flexWrap:'wrap'}}>
        {!podeVerTudo && (
          <button className={`tab ${aba==='meus'?'active':''}`} onClick={()=>setAba('meus')}>Meus Afilhados</button>
        )}
        {podeVerTudo && (
          <button className={`tab ${aba==='meus'?'active':''}`} onClick={()=>setAba('meus')}>Meus Afilhados</button>
        )}
        {podeVerTudo && (
          <button className={`tab ${aba==='todos'?'active':''}`} onClick={()=>setAba('todos')}>Todos os Encontristas</button>
        )}
        {podeVerTudo && (
          <button className={`tab ${aba==='config'?'active':''}`} onClick={()=>setAba('config')}>Configurar</button>
        )}
      </div>

      {/* ===== MEUS AFILIADOS (PADRINHO) ===== */}
      {aba==='meus' && (
        <>
          <BarraProgresso titulo={`Conclusão dos meus afilhados`} pct={progressoConjunto(meusAfiliados)} />
          {meusAfiliados.length === 0
            ? <div className="empty"><p className="empty-title">Você ainda não tem afilhados</p><p className="empty-sub">O líder de correio define os padrinhos.</p></div>
            : ordenarPorStatus(meusAfiliados).map(af => (
              <CardAfiliado key={af.id} af={af} pct={progressoAfiliado(af.id)} status={statusDe(af.id)} onClick={()=>setAfiliadoAberto(af)} />
            ))
          }
        </>
      )}

      {/* ===== TODOS (LÍDER) ===== */}
      {aba==='todos' && (
        <>
          <BarraProgresso titulo="Conclusão de todos os encontristas" pct={progressoConjunto(encontristas)} />
          {encontristas.length === 0
            ? <div className="empty"><p className="empty-title">Nenhum encontrista cadastrado</p></div>
            : ordenarPorStatus(encontristas).map(af => (
              <CardAfiliado key={af.id} af={af} pct={progressoAfiliado(af.id)} status={statusDe(af.id)} onClick={()=>setAfiliadoAberto(af)} />
            ))
          }
        </>
      )}

      {/* ===== CONFIGURAR (LÍDER DE CORREIO) ===== */}
      {aba==='config' && (
        <>
          <div className="section-label mb-2">Checklist universal</div>
          <p style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>Um único checklist aplicado a TODOS os afilhados.</p>
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <input className="form-input" value={novoItem} onChange={e=>setNovoItem(e.target.value)} placeholder="Novo item do checklist" style={{flex:1}} onKeyDown={e=>e.key==='Enter'&&addItemChecklist()}/>
            <button className="btn btn-primary btn-sm" onClick={addItemChecklist}>Adicionar</button>
          </div>
          <div style={{background:'white',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow-sm)',marginBottom:24}}>
            {checklist.length === 0
              ? <p style={{padding:16,fontSize:13,color:'var(--muted)',textAlign:'center'}}>Nenhum item ainda</p>
              : checklist.map((it,idx) => (
                <div key={it.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 14px',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:13}}><strong style={{color:'var(--muted)'}}>{idx+1}.</strong> {it.texto}</span>
                  <button onClick={()=>removerItemChecklist(it.id)} style={{background:'none',border:'none',cursor:'pointer',padding:4}}>
                    <span className="icon" style={{fontSize:18,color:'var(--danger)'}}>delete</span>
                  </button>
                </div>
              ))
            }
          </div>

          <div className="section-label mb-2">Definir padrinhos</div>
          <p style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>Clique num encontrista para atribuir padrinhos (pode ter vários).</p>
          {encontristas.map(af => {
            const qtd = padrinhos.filter(p=>p.afiliado_id===af.id).length
            return (
              <CardItem
                key={af.id}
                cor="var(--primary)"
                ehPessoa
                fotoUrl={(af as any).photo_url ?? null}
                iniciais={getInitials(af.name)}
                titulo={formatName(af.name)}
                subtitulo={qtd>0?`${qtd} padrinho(s)`:'Sem padrinho'}
                onVer={()=>{setBuscaPadrinho('');setModalPadrinho(af)}}
                onFoto={()=>(af as any).photo_url && setFotoAmpliada((af as any).photo_url)}
              />
            )
          })}
        </>
      )}

      {/* ===== MODAL DETALHE DO AFILIADO ===== */}
      {afiliadoAberto && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setAfiliadoAberto(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 24px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 16px'}}/>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
              <Avatar p={afiliadoAberto} size={52}/>
              <div style={{flex:1}}>
                <p style={{fontWeight:800,fontSize:17}}>{formatName(afiliadoAberto.name)}</p>
                {afiliadoAberto.referencia_id && <ReferenciaNome id={afiliadoAberto.referencia_id} pessoas={todasPessoas}/>}
              </div>
            </div>

            {/* Status */}
            <div style={{display:'flex',gap:6,marginBottom:16}}>
              {Object.entries(STATUS_LABEL).map(([k,v]) => (
                <button key={k} onClick={()=>mudarStatusAfiliado(afiliadoAberto.id,k)}
                  style={{flex:1,padding:'8px',borderRadius:8,border:statusDe(afiliadoAberto.id)===k?`2px solid ${v.cor}`:'1px solid var(--border)',background:statusDe(afiliadoAberto.id)===k?v.cor:'white',color:statusDe(afiliadoAberto.id)===k?'white':'var(--text)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'inherit'}}>
                  {v.label}
                </button>
              ))}
            </div>

            {/* Barra individual */}
            <BarraProgresso titulo="Progresso do checklist" pct={progressoAfiliado(afiliadoAberto.id)} small/>

            {/* Checklist */}
            <div className="section-label mb-2" style={{marginTop:16}}>Checklist</div>
            <div style={{background:'white',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow-sm)',marginBottom:16}}>
              {checklist.length === 0
                ? <p style={{padding:14,fontSize:12,color:'var(--muted)',textAlign:'center'}}>Nenhum item no checklist</p>
                : checklist.map(it => {
                  const feito = statusChk.find(s=>s.afiliado_id===afiliadoAberto.id && s.item_id===it.id)?.concluido ?? false
                  return (
                    <div key={it.id} onClick={()=>toggleItem(afiliadoAberto.id,it.id,feito)} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
                      <span className="icon" style={{fontSize:22,color:feito?'var(--success)':'var(--muted-light)'}}>{feito?'check_circle':'radio_button_unchecked'}</span>
                      <span style={{fontSize:13,textDecoration:feito?'line-through':'none',color:feito?'var(--muted)':'var(--text)'}}>{it.texto}</span>
                    </div>
                  )
                })
              }
            </div>

            {/* Arquivos */}
            <div className="section-label mb-2">Arquivos</div>
            <input ref={fileRef} type="file" multiple style={{display:'none'}} onChange={async e=>{const fs=Array.from(e.target.files??[]); for(const f of fs){await subirArquivo(afiliadoAberto.id,f)} e.target.value=''}}/>
            <button className="btn btn-ghost btn-sm btn-full" onClick={()=>fileRef.current?.click()} style={{marginBottom:10}} disabled={uploadando}>
              <span className="icon icon-sm">upload_file</span> {uploadando?'Enviando...':'Enviar arquivo(s)'}
            </button>
            {arquivosDe(afiliadoAberto.id).map(arq => (
              <div key={arq.id} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',background:'white',borderRadius:10,marginBottom:6,boxShadow:'var(--shadow-sm)'}}>
                <span className="icon" style={{color:'var(--primary)'}}>description</span>
                <a href={arq.url} target="_blank" rel="noreferrer" style={{flex:1,fontSize:12,color:'var(--text)',textDecoration:'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{arq.nome}</a>
                <button onClick={()=>excluirArquivo(arq)} style={{background:'none',border:'none',cursor:'pointer',padding:2}}>
                  <span className="icon" style={{fontSize:16,color:'var(--danger)'}}>delete</span>
                </button>
              </div>
            ))}

            <button className="btn btn-ghost btn-full" onClick={()=>setAfiliadoAberto(null)} style={{marginTop:12}}>Fechar</button>
          </div>
        </div>
      )}

      {/* ===== MODAL DEFINIR PADRINHOS ===== */}
      {modalPadrinho && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModalPadrinho(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 24px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 16px'}}/>
            <p style={{fontWeight:800,fontSize:16,marginBottom:4}}>Padrinhos de {formatName(modalPadrinho.name)}</p>
            <p style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>Selecione quem acompanha este encontrista (pode marcar vários).</p>
            {(() => {
              const selecionados = padrinhos.filter(p=>p.afiliado_id===modalPadrinho.id).length
              const busca = buscaPadrinho.trim().toLowerCase()
              const filtrados = busca
                ? possiveisPadrinhos.filter(p => formatName(p.name).toLowerCase().includes(busca) || p.name.toLowerCase().includes(busca))
                : possiveisPadrinhos
              return (
            <>
            <div style={{position:'relative',marginBottom:10}}>
              <span className="icon" style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:18,color:'var(--muted)'}}>search</span>
              <input className="form-input" value={buscaPadrinho} onChange={e=>setBuscaPadrinho(e.target.value)} placeholder="Pesquisar nome..." style={{paddingLeft:36,width:'100%'}} autoFocus/>
            </div>
            <p style={{fontSize:11,color:'var(--muted)',marginBottom:8}}>{selecionados} selecionado(s) · {filtrados.length} de {possiveisPadrinhos.length} na equipe Correio</p>
            <div style={{maxHeight:340,overflowY:'auto'}}>
              {possiveisPadrinhos.length===0
                ? <p style={{textAlign:'center',fontSize:13,color:'var(--muted)',padding:'16px 0'}}>Ninguém na equipe Correio ainda. Adicione integrantes à equipe Correio (em Equipes) para poder defini-los como padrinhos.</p>
                : filtrados.length===0 && <p style={{textAlign:'center',fontSize:13,color:'var(--muted)',padding:'16px 0'}}>Nenhum integrante encontrado com esse nome.</p>}
              {filtrados.map(pad => {
                const ativo = padrinhos.some(p=>p.afiliado_id===modalPadrinho.id && p.padrinho_id===pad.id)
                return (
                  <div key={pad.id} onClick={()=>togglePadrinho(modalPadrinho.id,pad.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,marginBottom:6,background:ativo?'var(--primary-light)':'white',border:ativo?'1px solid var(--primary)':'1px solid var(--border)',cursor:'pointer'}}>
                    <Avatar p={pad}/>
                    <span style={{flex:1,fontSize:13,fontWeight:600}}>{formatName(pad.name)}</span>
                    {ativo && <span className="icon" style={{color:'var(--primary)'}}>check_circle</span>}
                  </div>
                )
              })}
            </div>
            </>
              )
            })()}
            <button className="btn btn-primary btn-full" onClick={()=>setModalPadrinho(null)} style={{marginTop:12}}>Concluir</button>
          </div>
        </div>
      )}

      {/* ===== IMPRESSÃO — CHECKLIST DE CADA ENCONTRISTA ===== */}
      {imprimir && (
        <PrintOverlay titulo="Correio — checklist por encontrista" onClose={()=>setImprimir(false)}>
          {ordenarPorStatus(encontristas).map(af => {
            const st = STATUS_LABEL[statusDe(af.id)] ?? STATUS_LABEL.em_processo
            const temArquivo = arquivos.some(a => a.afiliado_id === af.id)
            const padris = padrinhos.filter(p=>p.afiliado_id===af.id).map(p=>todasPessoas.find(t=>t.id===p.padrinho_id)).filter(Boolean) as Pessoa[]
            return (
              <div key={af.id} style={{border:'1px solid #e5e7eb',borderRadius:8,padding:'12px 14px',marginBottom:12,breakInside:'avoid'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                  <div style={{width:44,height:44,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {af.photo_url?<img src={af.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontWeight:700,color:'#6b7280',fontSize:15}}>{getInitials(af.name)}</span>}
                  </div>
                  <p style={{fontWeight:800,fontSize:15,flex:1}}>{formatName(af.name)}</p>
                  <span style={{fontSize:10,fontWeight:700,color:'white',background:st.cor,padding:'2px 8px',borderRadius:99}}>{st.label}</span>
                </div>
                {padris.length>0 && <p style={{fontSize:11,color:'#6b7280',marginBottom:6}}>Padrinho(s): {padris.map(p=>formatName(p.name)).join(', ')}</p>}
                {temArquivo && <p style={{fontSize:11,fontWeight:700,color:'#2563eb',marginBottom:6}}>📎 Tem arquivo no app</p>}
                {checklist.length===0
                  ? <p style={{fontSize:12,color:'#9ca3af'}}>Sem checklist configurado.</p>
                  : checklist.map(it => {
                      const feito = statusChk.find(s=>s.afiliado_id===af.id && s.item_id===it.id)?.concluido ?? false
                      return <p key={it.id} style={{fontSize:13,margin:'3px 0'}}>{feito?'☑':'☐'} {it.texto}</p>
                    })}
              </div>
            )
          })}
        </PrintOverlay>
      )}
      <FotoAmpliada url={fotoAmpliada} onClose={()=>setFotoAmpliada(null)} />
    </div>
  )
}

// ===== COMPONENTES AUXILIARES =====
function Avatar({ p, size=40 }: { p:{name:string;photo_url:string|null}; size?:number }) {
  return p.photo_url
    ? <img src={p.photo_url} alt="" style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
    : <div style={{width:size,height:size,borderRadius:'50%',background:'var(--primary-light)',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:size*0.4,flexShrink:0}}>{getInitials(p.name)}</div>
}

function CardAfiliado({ af, pct, status, onClick }: { af:any; pct:number; status:string; onClick:()=>void }) {
  const st = STATUS_LABEL[status] ?? STATUS_LABEL.em_processo
  return (
    <CardItem
      cor="var(--primary)"
      ehPessoa
      fotoUrl={af.photo_url ?? null}
      iniciais={getInitials(af.name)}
      titulo={formatName(af.name)}
      direita={<span style={{fontSize:15,fontWeight:800,color:'var(--primary)'}}>{pct}%</span>}
      progresso={pct}
      extra={<span style={{fontSize:10,fontWeight:700,color:'white',background:st.cor,padding:'2px 8px',borderRadius:99,display:'inline-block'}}>{st.label}</span>}
      onVer={onClick}
    />
  )
}

function BarraProgresso({ titulo, pct, small }: { titulo:string; pct:number; small?:boolean }) {
  return (
    <div style={{background:small?'transparent':'var(--primary)',borderRadius:14,padding:small?'0':'16px 18px',marginBottom:16,boxShadow:small?'none':'0 4px 14px rgba(0,169,157,0.3)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <span style={{fontSize:13,fontWeight:700,color:small?'var(--text)':'white'}}>{titulo}</span>
        <span style={{fontSize:15,fontWeight:800,color:small?'var(--primary)':'white'}}>{pct}%</span>
      </div>
      <div style={{height:8,background:small?'var(--bg)':'rgba(255,255,255,0.25)',borderRadius:99,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:small?'var(--primary)':'white',borderRadius:99,transition:'width 0.4s ease'}}/>
      </div>
    </div>
  )
}

function ReferenciaNome({ id, pessoas }: { id:string; pessoas:any[] }) {
  const ref = pessoas.find(p => p.id === id)
  if (!ref) return null
  return <p style={{fontSize:12,color:'var(--muted)'}}>Referência: {formatName(ref.name)}</p>
}
