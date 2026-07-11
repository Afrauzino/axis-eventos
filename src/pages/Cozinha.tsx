import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import EmojiGrid from '../components/EmojiGrid'
import PrintOverlay from '../components/PrintOverlay'
import CardItem from '../components/CardItem'
import Seletor from '../components/Seletor'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import { isAdmin, getInitials, formatName } from '../utils'
import type { Profile } from '../App'

type RefTipo = { id:string; nome:string; cor:string; ordem:number; emoji?:string|null }
type Cardapio = { id:string; refeicao_tipo_id:string|null; tipo_refeicao_nome:string|null; titulo:string|null; itens:string|null }
type Restricao = { person_id:string; name:string; photo_url:string|null; texto:string; alergias:string }

const CORES = ['#00A99D','#6B46C1','#2F855A','#D69E2E','#E53E3E','#3182CE','#DD6B20','#805AD5']

export default function Cozinha({ profile }: { profile?: Profile }) {
  const { evento, loading:evLoading } = useEvento()
  const [aba, setAba] = useState<'cardapio'|'tipo'|'restricao'|'progresso'>('restricao')
  // Progresso da equipe (líder marca pelos liderados)
  const [cozMembros, setCozMembros] = useState<{id:string;name:string;photo_url:string|null}[]>([])
  const [cozFeitos, setCozFeitos] = useState<Set<string>>(new Set())   // "personId|cardapioId"
  const [cozLoad, setCozLoad] = useState(false)
  const [expandido, setExpandido] = useState<string|null>(null)
  const [tipos, setTipos] = useState<RefTipo[]>([])
  const [cardapios, setCardapios] = useState<Cardapio[]>([])
  const [restricoes, setRestricoes] = useState<Restricao[]>([])
  const [loading, setLoading] = useState(true)
  const [imprimir, setImprimir] = useState(false)

  const { pode } = usePermissao(profile ?? null)
  // Admin OU liberação (individual/equipe) "ver e editar Cozinha" na tela do Admin
  const canEdit = (!!profile && isAdmin(profile.user_role)) || pode('cozinha','editar')

  // Restrição alimentar — puxa da Ficha Médica (saude_fichas)
  async function carregarRestricoes(eid: string) {
    const { data: fichas } = await supabase.from('saude_fichas')
      .select('person_id,restricao_alimentar,restricoes_alimentares,alergias').eq('event_id', eid)
    // Só quem marcou SIM em "restrição alimentar" na ficha médica
    const com = (fichas ?? []).filter((f:any) => f.restricao_alimentar === true)
    if (!com.length) { setRestricoes([]); return }
    const ids = com.map((f:any) => f.person_id)
    const { data: pes } = await supabase.from('people').select('id,name,photo_url').in('id', ids)
    const pmap = new Map((pes ?? []).map((p:any) => [p.id, p]))
    const out: Restricao[] = com.map((f:any) => {
      const p = pmap.get(f.person_id)
      return { person_id:f.person_id, name:p?.name ?? '—', photo_url:p?.photo_url ?? null, texto:(f.restricoes_alimentares || '').trim(), alergias:(f.alergias || '').trim() }
    }).filter(r => r.name !== '—').sort((a,b) => a.name.localeCompare(b.name))
    setRestricoes(out)
  }
  useEffect(() => { if (aba === 'restricao' && evento?.id) carregarRestricoes(evento.id) }, [aba, evento?.id])

  // modal tipo
  const [modalTipo, setModalTipo] = useState(false)
  useVoltarFecha(modalTipo, () => setModalTipo(false))
  const [editTipo, setEditTipo] = useState<RefTipo|null>(null)
  const [novoTipo, setNovoTipo] = useState({ nome:'', cor:CORES[0], emoji:'🍽️' })

  // modal cardapio
  const [modalCard, setModalCard] = useState(false)
  useVoltarFecha(modalCard, () => setModalCard(false))
  const [editCard, setEditCard] = useState<Cardapio|null>(null)
  const [formCard, setFormCard] = useState({ refeicao_tipo_id:'', titulo:'', itens:'', data_servir:'' })

  useEffect(()=>{ if(!evLoading) carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) { setLoading(false); return }
    setLoading(true)
    const [t, c] = await Promise.all([
      supabase.from('refeicao_tipos').select('*').eq('event_id',evento.id).order('ordem'),
      supabase.from('cozinha_cardapios').select('*').eq('event_id',evento.id).order('created_at',{ascending:false}),
    ])
    setTipos(t.data ?? [])
    setCardapios(c.data ?? [])
    setLoading(false)
  }

  // Progresso: carrega os liderados da(s) equipe(s) da cozinha + o que cada um concluiu
  useEffect(() => { if (aba==='progresso' && evento?.id) carregarProgresso() }, [aba, evento?.id])
  async function carregarProgresso() {
    if (!evento || !profile) return
    setCozLoad(true)
    const { data: myP } = await supabase.from('people').select('id').eq('event_id', evento.id).eq('user_id', profile.user_id).maybeSingle()
    const meuId = myP?.id ?? null
    const { data: times } = await supabase.from('teams').select('id,leader_id,co_leader_id').eq('event_id', evento.id).eq('equipe_cardapio', true)
    const admin = (!!profile && isAdmin(profile.user_role)) || pode('cozinha','editar')
    const minhas = (times ?? []).filter((t:any) => admin || t.leader_id===meuId || t.co_leader_id===meuId)
    const teamIds = minhas.map((t:any)=>t.id)
    const liderIds = new Set(minhas.flatMap((t:any)=>[t.leader_id,t.co_leader_id]).filter(Boolean))
    let membros: {id:string;name:string;photo_url:string|null}[] = []
    if (teamIds.length) {
      const { data: pt } = await supabase.from('people_teams').select('person_id').in('team_id', teamIds)
      const ids = [...new Set((pt ?? []).map((x:any)=>x.person_id))].filter(id => !liderIds.has(id))
      if (ids.length) {
        const { data: pes } = await supabase.from('people').select('id,name,photo_url').in('id', ids).order('name')
        membros = pes ?? []
      }
    }
    let conc: any[] = []
    if (membros.length) {
      const { data } = await supabase.from('cozinha_conclusoes').select('cardapio_id,person_id').eq('feito', true).in('person_id', membros.map(m=>m.id))
      conc = data ?? []
    }
    setCozMembros(membros)
    setCozFeitos(new Set(conc.map((c:any)=>c.person_id+'|'+c.cardapio_id)))
    setCozLoad(false)
  }
  // Líder marca/desmarca um cardápio POR um liderado
  async function togglePorMembro(personId: string, cardapioId: string) {
    if (!evento) return
    const key = personId+'|'+cardapioId
    const feito = cozFeitos.has(key)
    setCozFeitos(prev => { const n = new Set(prev); feito ? n.delete(key) : n.add(key); return n })
    if (feito) {
      await supabase.from('cozinha_conclusoes').delete().eq('cardapio_id', cardapioId).eq('person_id', personId)
    } else {
      await supabase.from('cozinha_conclusoes').upsert(
        { event_id: evento.id, cardapio_id: cardapioId, person_id: personId, feito: true, updated_at: new Date().toISOString() },
        { onConflict: 'cardapio_id,person_id' })
    }
  }

  function abrirNovoTipo() { setEditTipo(null); setNovoTipo({ nome:'', cor:CORES[0], emoji:'🍽️' }); setModalTipo(true) }
  function abrirEditarTipo(t:RefTipo) { setEditTipo(t); setNovoTipo({ nome:t.nome, cor:t.cor, emoji:t.emoji||'🍽️' }); setModalTipo(true) }

  async function salvarTipo() {
    if (!novoTipo.nome.trim() || !evento) return
    if (editTipo) {
      await supabase.from('refeicao_tipos').update({ nome:novoTipo.nome.trim(), cor:novoTipo.cor }).eq('id',editTipo.id)
      await supabase.from('refeicao_tipos').update({ emoji:novoTipo.emoji||null }).eq('id',editTipo.id) // resiliente
      setTipos(prev=>prev.map(t=>t.id===editTipo.id?{...t,nome:novoTipo.nome.trim(),cor:novoTipo.cor,emoji:novoTipo.emoji}:t))
    } else {
      const { data } = await supabase.from('refeicao_tipos').insert({
        event_id:evento.id, nome:novoTipo.nome.trim(), cor:novoTipo.cor, ordem:tipos.length,
      }).select().single()
      if (data) {
        await supabase.from('refeicao_tipos').update({ emoji:novoTipo.emoji||null }).eq('id',data.id) // resiliente
        setTipos(prev=>[...prev,{...data,emoji:novoTipo.emoji}])
      }
    }
    setNovoTipo({ nome:'', cor:CORES[0], emoji:'🍽️' }); setEditTipo(null); setModalTipo(false)
  }
  async function excluirTipo(id:string) {
    if (!confirm('Excluir este tipo de refeição?')) return
    await supabase.from('refeicao_tipos').delete().eq('id',id)
    setTipos(prev=>prev.filter(t=>t.id!==id))
  }

  // Dias do evento, com o nome do dia da semana (ex.: "Sexta · 24/07")
  const DIAS_SEM = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
  const diasEvento = (() => {
    const s = (evento as any)?.start_date, f = (evento as any)?.end_date
    if (!s || !f) return [] as {value:string;label:string}[]
    const out: {value:string;label:string}[] = []
    const d = new Date(s+'T00:00'), fim = new Date(f+'T00:00')
    let guard = 0
    while (d <= fim && guard++ < 60) {
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      out.push({ value: iso, label: `${DIAS_SEM[d.getDay()]} · ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}` })
      d.setDate(d.getDate()+1)
    }
    return out
  })()

  function abrirNovoCardapio() {
    setEditCard(null); setFormCard({ refeicao_tipo_id: tipos[0]?.id ?? '', titulo:'', itens:'', data_servir: diasEvento[0]?.value ?? '' }); setModalCard(true)
  }
  function abrirEditarCardapio(c:Cardapio) {
    setEditCard(c); setFormCard({ refeicao_tipo_id:c.refeicao_tipo_id??'', titulo:c.titulo??'', itens:c.itens??'', data_servir:(c as any).data_servir??'' }); setModalCard(true)
  }
  async function salvarCardapio() {
    if (!evento) return
    const tipo = tipos.find(t=>t.id===formCard.refeicao_tipo_id)
    const payload = {
      event_id:evento.id, refeicao_tipo_id:formCard.refeicao_tipo_id||null,
      tipo_refeicao_nome:tipo?.nome ?? null, titulo:formCard.titulo||null, itens:formCard.itens||null,
      data_servir: formCard.data_servir || null,
    }
    if (editCard) {
      await supabase.from('cozinha_cardapios').update(payload).eq('id',editCard.id)
      setCardapios(prev=>prev.map(c=>c.id===editCard.id?{...c,...payload}:c))
    } else {
      const { data } = await supabase.from('cozinha_cardapios').insert(payload).select().single()
      if (data) setCardapios(prev=>[data,...prev])
    }
    setModalCard(false)
  }
  async function excluirCardapio(id:string) {
    if (!confirm('Excluir cardápio?')) return
    await supabase.from('cozinha_cardapios').delete().eq('id',id)
    setCardapios(prev=>prev.filter(c=>c.id!==id))
  }

  // (sem engrenagem: a impressão fica num botão inline na aba Cardápio)

  if (evLoading||loading) return <div className="page">{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:10,borderRadius:14}}/>)}</div>
  if (!evento) return <div className="page"><div className="empty"><p className="empty-title">Nenhum evento ativo</p></div></div>

  return (
    <div className="page slide-up">
      {/* Abas horizontais (padrão do Correio) — sem engrenagem */}
      <div className="tabs mb-4" style={{flexWrap:'wrap'}}>
        <button className={`tab ${aba==='restricao'?'active':''}`} onClick={()=>setAba('restricao')}>Restrições</button>
        <button className={`tab ${aba==='cardapio'?'active':''}`} onClick={()=>setAba('cardapio')}>Cardápio</button>
        <button className={`tab ${aba==='progresso'?'active':''}`} onClick={()=>setAba('progresso')}>Progresso</button>
        <button className={`tab ${aba==='tipo'?'active':''}`} onClick={()=>setAba('tipo')}>Tipo</button>
      </div>

      {/* PROGRESSO — líder vê quem concluiu e marca pelos liderados */}
      {aba==='progresso' && (
        cozLoad ? <div className="skeleton" style={{height:120,borderRadius:14}}/> :
        cardapios.length===0 ? (
          <div className="empty"><p className="empty-title">Sem cardápios</p><p className="empty-desc">Crie os cardápios na aba Cardápio primeiro.</p></div>
        ) : cozMembros.length===0 ? (
          <div className="empty"><p className="empty-title">Sem liderados</p><p className="empty-desc">Só o líder da equipe da cozinha (ou admin) vê o progresso, e a equipe precisa ter membros.</p></div>
        ) : (() => {
          const totalCel = cozMembros.length * cardapios.length
          const feitosTotal = cozMembros.reduce((s,m)=> s + cardapios.filter(c=>cozFeitos.has(m.id+'|'+c.id)).length, 0)
          const pctGeral = totalCel>0 ? Math.round(feitosTotal/totalCel*100) : 0
          return (
            <>
              <div style={{background:'white',borderRadius:14,padding:'14px 16px',marginBottom:14,boxShadow:'var(--shadow-sm)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:14,fontWeight:700}}>Equipe da cozinha · {cozMembros.length} × {cardapios.length}</span>
                  <span style={{fontSize:14,fontWeight:800,color:pctGeral===100?'#2F855A':'var(--primary)'}}>{feitosTotal}/{totalCel} · {pctGeral}%</span>
                </div>
                <div style={{height:9,background:'var(--bg)',borderRadius:99,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pctGeral}%`,background:pctGeral===100?'#2F855A':'var(--primary)',borderRadius:99,transition:'width .3s'}}/>
                </div>
              </div>

              {cozMembros.map(m => {
                const feitos = cardapios.filter(c=>cozFeitos.has(m.id+'|'+c.id)).length
                const pct = Math.round(feitos/cardapios.length*100)
                const aberto = expandido===m.id
                return (
                  <div key={m.id}>
                    <CardItem cor={pct===100?'#2F855A':'#E8821A'} ehPessoa fotoUrl={m.photo_url} iniciais={getInitials(m.name)}
                      titulo={formatName(m.name)} progresso={pct} progressoLabel={`${feitos}/${cardapios.length}`}
                      onVer={()=>setExpandido(aberto?null:m.id)} />
                    {aberto && (
                      <div style={{background:'var(--bg)',borderRadius:12,padding:'10px 12px',margin:'-4px 0 10px'}}>
                        <p style={{fontSize:11,color:'var(--muted)',fontWeight:700,marginBottom:8}}>Toque pra marcar/desmarcar por {formatName(m.name).split(' ')[0]}:</p>
                        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                          {cardapios.map(c => {
                            const f = cozFeitos.has(m.id+'|'+c.id)
                            return (
                              <button key={c.id} onClick={()=>togglePorMembro(m.id, c.id)}
                                style={{display:'inline-flex',alignItems:'center',gap:4,padding:'6px 12px',borderRadius:99,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700,
                                  border: f?'1px solid #2F855A':'1px solid var(--border)', background: f?'#2F855A18':'white', color: f?'#2F855A':'var(--text2)'}}>
                                {f && <span className="icon" style={{fontSize:14}}>check</span>}
                                {c.tipo_refeicao_nome ?? 'Refeição'}{c.titulo?` · ${c.titulo}`:''}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )
        })()
      )}

      {/* Imprimir (inline, na aba Cardápio) */}
      {aba==='cardapio' && cardapios.length>0 && (
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setImprimir(true)}>
            <span className="icon icon-sm">print</span> Imprimir cardápios
          </button>
        </div>
      )}


      {/* ABA CARDÁPIO */}
      {aba==='cardapio' && (
        cardapios.length===0
          ? <div className="empty"><p className="empty-title">Nenhum cardápio</p><p className="empty-sub">Toque no + para criar.</p></div>
          : cardapios.map(c=>{
            const tipo = tipos.find(t=>t.id===c.refeicao_tipo_id)
            const cor  = tipo?.cor ?? 'var(--primary)'
            return (
              <CardItem
                key={c.id}
                cor={cor}
                emoji={tipo?.emoji || '🍽️'}
                titulo={c.titulo || 'Cardápio'}
                subtitulo={tipo?.nome}
                extra={c.itens ? <p style={{fontSize:13,color:'var(--muted)',whiteSpace:'pre-wrap'}}>{c.itens}</p> : undefined}
                onVer={canEdit ? ()=>abrirEditarCardapio(c) : undefined}
                onEditar={canEdit ? ()=>abrirEditarCardapio(c) : undefined}
              />
            )
          })
      )}

      {/* ABA TIPO */}
      {aba==='tipo' && (
        tipos.length===0
          ? <div className="empty"><p className="empty-title">Nenhum tipo</p><p className="empty-sub">Toque no + para criar (Café, Almoço, Janta...).</p></div>
          : tipos.map(t=>(
            <CardItem
              key={t.id}
              cor={t.cor}
              emoji={t.emoji || '🍽️'}
              titulo={t.nome}
              onVer={canEdit ? ()=>abrirEditarTipo(t) : undefined}
              onEditar={canEdit ? ()=>abrirEditarTipo(t) : undefined}
            />
          ))
      )}

      {/* ABA RESTRIÇÃO ALIMENTAR — vem da Ficha Médica */}
      {aba==='restricao' && (
        restricoes.length===0
          ? <div className="empty"><p className="empty-title">Nenhuma restrição</p><p className="empty-sub">Ninguém marcou restrição alimentar na ficha médica.</p></div>
          : <>
              <p style={{fontSize:12,color:'var(--muted)',marginBottom:10,lineHeight:1.5}}>{restricoes.length} pessoa(s) com restrição alimentar — dados vindos da <b>Ficha Médica</b>.</p>
              {restricoes.map(r=>(
                <CardItem
                  key={r.person_id}
                  ehPessoa
                  fotoUrl={r.photo_url}
                  iniciais={getInitials(r.name)}
                  cor="#E53E3E"
                  titulo={r.name}
                  subtitulo={r.texto || 'Restrição não especificada'}
                />
              ))}
            </>
      )}

      {/* FAB - botão redondo de + conforme a aba (não aparece em Restrições) */}
      {canEdit && aba!=='restricao' && <button className="fab" onClick={()=> aba==='cardapio' ? abrirNovoCardapio() : abrirNovoTipo()}>
        <span className="icon">add</span>
      </button>}

      {/* Modal novo tipo */}
      {modalTipo && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModalTipo(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 22px 28px',width:'100%',maxWidth:480,margin:'0 auto',maxHeight:'88vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 16px'}}/>
            <p style={{fontSize:16,fontWeight:800,marginBottom:14}}>{editTipo?'Editar tipo de refeição':'Novo tipo de refeição'}</p>
            <div className="form-group"><label className="form-label">Nome</label>
              <input className="form-input" placeholder="Ex: Café da manhã, Almoço..." value={novoTipo.nome} onChange={e=>setNovoTipo(f=>({...f,nome:e.target.value}))}/>
            </div>
            <div className="form-group"><label className="form-label">Emoji</label>
              <EmojiGrid value={novoTipo.emoji} onChange={em=>setNovoTipo(f=>({...f,emoji:em}))}/>
            </div>
            <div className="form-group"><label className="form-label">Cor</label>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {CORES.map(c=><button key={c} type="button" onClick={()=>setNovoTipo(f=>({...f,cor:c}))} style={{width:32,height:32,borderRadius:8,background:c,border:novoTipo.cor===c?'3px solid var(--text)':'none',cursor:'pointer'}}/>)}
              </div>
            </div>
            <button className="btn btn-primary btn-full" onClick={salvarTipo} style={{marginBottom:8}}>{editTipo?'Salvar':'Criar'}</button>
            {editTipo && <button className="btn btn-ghost btn-full" style={{color:'var(--danger)',marginBottom:8}} onClick={()=>{const id=editTipo.id;setModalTipo(false);excluirTipo(id)}}><span className="icon icon-sm">delete</span> Excluir tipo</button>}
            <button className="btn btn-ghost btn-full" onClick={()=>setModalTipo(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Modal cardápio */}
      {modalCard && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={e=>e.target===e.currentTarget&&setModalCard(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 22px 22px',width:'100%',maxWidth:480,maxHeight:'88vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 16px'}}/>
            <p style={{fontSize:17,fontWeight:800,marginBottom:14}}>{editCard?'Editar cardápio':'Novo cardápio'}</p>
            <label className="form-label">Tipo de refeição</label>
            <div style={{marginBottom:12}}>
              <Seletor titulo="Tipo de refeição" placeholder="Selecione..." value={formCard.refeicao_tipo_id} onChange={v=>setFormCard(f=>({...f,refeicao_tipo_id:v}))}
                opcoes={tipos.map(t=>({value:t.id,label:t.nome}))}/>
            </div>
            {diasEvento.length>0 && (<>
              <label className="form-label">Dia</label>
              <div style={{marginBottom:12}}>
                <Seletor titulo="Dia" placeholder="Selecione o dia" value={formCard.data_servir} onChange={v=>setFormCard(f=>({...f,data_servir:v}))}
                  opcoes={[{value:'',label:'Sem dia'}, ...diasEvento]}/>
              </div>
            </>)}
            <label className="form-label">Título (opcional)</label>
            <input className="form-input" placeholder="Ex: Almoço de domingo" value={formCard.titulo} onChange={e=>setFormCard(f=>({...f,titulo:e.target.value}))} style={{marginBottom:12}}/>
            <label className="form-label">Itens do cardápio</label>
            <textarea className="form-input" placeholder="Arroz, feijão, salada..." rows={6} value={formCard.itens} onChange={e=>setFormCard(f=>({...f,itens:e.target.value}))} style={{resize:'vertical',marginBottom:16}}/>
            <button className="btn btn-primary btn-full" onClick={salvarCardapio} style={{marginBottom:8}}>Salvar</button>
            {editCard && <button className="btn btn-ghost btn-full" style={{color:'var(--danger)',marginBottom:8}} onClick={()=>{const id=editCard.id;setModalCard(false);excluirCardapio(id)}}><span className="icon icon-sm">delete</span> Excluir cardápio</button>}
            <button className="btn btn-ghost btn-full" onClick={()=>setModalCard(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {imprimir && (
        <PrintOverlay titulo="Cardápios" onClose={()=>setImprimir(false)}>
          {cardapios.map(c => {
            const tipo = tipos.find(t=>t.id===c.refeicao_tipo_id)
            const cor  = tipo?.cor ?? '#00A99D'
            return (
              <div key={c.id} style={{display:'flex',border:'1px solid #e5e7eb',borderRadius:12,overflow:'hidden',marginBottom:10,breakInside:'avoid'}}>
                <div style={{width:6,background:cor,flexShrink:0,WebkitPrintColorAdjust:'exact',printColorAdjust:'exact'} as any}/>
                <div style={{flex:1,minWidth:0,padding:'14px 15px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:14}}>
                    <div style={{width:52,height:52,borderRadius:'50%',background:cor+'24',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:24,lineHeight:1,WebkitPrintColorAdjust:'exact',printColorAdjust:'exact'} as any}>{tipo?.emoji || '🍽️'}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontWeight:700,fontSize:15}}>{c.titulo || 'Cardápio'}</p>
                      {tipo && <p style={{fontSize:12,color:'#6b7280'}}>{tipo.nome}</p>}
                    </div>
                  </div>
                  {c.itens && <p style={{fontSize:13,color:'#374151',whiteSpace:'pre-wrap',marginTop:10}}>{c.itens}</p>}
                </div>
              </div>
            )
          })}
        </PrintOverlay>
      )}
    </div>
  )
}
