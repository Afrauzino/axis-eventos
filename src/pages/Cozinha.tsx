import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import EmojiGrid from '../components/EmojiGrid'
import PrintOverlay from '../components/PrintOverlay'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type RefTipo = { id:string; nome:string; cor:string; ordem:number; emoji?:string|null }
type Cardapio = { id:string; refeicao_tipo_id:string|null; tipo_refeicao_nome:string|null; titulo:string|null; itens:string|null }

const CORES = ['#00A99D','#6B46C1','#2F855A','#D69E2E','#E53E3E','#3182CE','#DD6B20','#805AD5']

export default function Cozinha({ profile }: { profile?: Profile }) {
  const { evento, loading:evLoading } = useEvento()
  const [aba, setAba] = useState<'cardapio'|'tipo'>('cardapio')
  const [tipos, setTipos] = useState<RefTipo[]>([])
  const [cardapios, setCardapios] = useState<Cardapio[]>([])
  const [loading, setLoading] = useState(true)
  const [imprimir, setImprimir] = useState(false)

  // modal tipo
  const [modalTipo, setModalTipo] = useState(false)
  const [editTipo, setEditTipo] = useState<RefTipo|null>(null)
  const [novoTipo, setNovoTipo] = useState({ nome:'', cor:CORES[0], emoji:'🍽️' })

  // modal cardapio
  const [modalCard, setModalCard] = useState(false)
  const [editCard, setEditCard] = useState<Cardapio|null>(null)
  const [formCard, setFormCard] = useState({ refeicao_tipo_id:'', titulo:'', itens:'' })

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

  function abrirNovoCardapio() {
    setEditCard(null); setFormCard({ refeicao_tipo_id: tipos[0]?.id ?? '', titulo:'', itens:'' }); setModalCard(true)
  }
  function abrirEditarCardapio(c:Cardapio) {
    setEditCard(c); setFormCard({ refeicao_tipo_id:c.refeicao_tipo_id??'', titulo:c.titulo??'', itens:c.itens??'' }); setModalCard(true)
  }
  async function salvarCardapio() {
    if (!evento) return
    const tipo = tipos.find(t=>t.id===formCard.refeicao_tipo_id)
    const payload = {
      event_id:evento.id, refeicao_tipo_id:formCard.refeicao_tipo_id||null,
      tipo_refeicao_nome:tipo?.nome ?? null, titulo:formCard.titulo||null, itens:formCard.itens||null,
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

  if (evLoading||loading) return <div className="page">{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:10,borderRadius:14}}/>)}</div>
  if (!evento) return <div className="page"><div className="empty"><p className="empty-title">Nenhum evento ativo</p></div></div>

  return (
    <div className="page slide-up">
      {/* Abas no topo (padrão Admin) */}
      <div className="tabs mb-4">
        <button className={`tab ${aba==='cardapio'?'active':''}`} onClick={()=>setAba('cardapio')}>Cardápio</button>
        <button className={`tab ${aba==='tipo'?'active':''}`} onClick={()=>setAba('tipo')}>Tipo</button>
      </div>

      {cardapios.length>0 && (
        <button className="btn btn-outline btn-full btn-sm mb-3" onClick={()=>setImprimir(true)}>
          <span className="icon icon-sm">print</span> Imprimir cardápios (com detalhes)
        </button>
      )}

      {/* ABA CARDÁPIO */}
      {aba==='cardapio' && (
        cardapios.length===0
          ? <div className="empty"><p className="empty-title">Nenhum cardápio</p><p className="empty-sub">Toque no + para criar.</p></div>
          : cardapios.map(c=>{
            const tipo = tipos.find(t=>t.id===c.refeicao_tipo_id)
            const cor  = tipo?.cor ?? 'var(--primary)'
            return (
              <div key={c.id} style={{background:'white',borderRadius:12,boxShadow:'0 1px 5px rgba(0,0,0,0.12)',marginBottom:10,overflow:'hidden',display:'flex'}}>
                <div style={{width:6,alignSelf:'stretch',background:cor,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0,padding:'14px 15px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:14}}>
                    <div style={{width:52,height:52,borderRadius:'50%',background:tipo?tipo.cor+'24':'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:24,lineHeight:1}}>{tipo?.emoji || '🍽️'}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontWeight:700,fontSize:15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.titulo || 'Cardápio'}</p>
                      {tipo && <p style={{fontSize:12,color:'var(--muted)'}}>{tipo.nome}</p>}
                    </div>
                    <div style={{display:'flex',gap:8,flexShrink:0}}>
                      <button onClick={()=>abrirEditarCardapio(c)} aria-label="Editar" style={{width:34,height:34,borderRadius:8,background:'var(--bg)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)',fontFamily:'inherit'}}><span className="icon icon-sm">edit</span></button>
                      <button onClick={()=>excluirCardapio(c.id)} aria-label="Excluir" style={{width:34,height:34,borderRadius:8,background:'var(--danger-bg)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm" style={{color:'var(--danger)'}}>delete</span></button>
                    </div>
                  </div>
                  {c.itens && <p style={{fontSize:13,color:'var(--muted)',whiteSpace:'pre-wrap',marginTop:10}}>{c.itens}</p>}
                </div>
              </div>
            )
          })
      )}

      {/* ABA TIPO */}
      {aba==='tipo' && (
        tipos.length===0
          ? <div className="empty"><p className="empty-title">Nenhum tipo</p><p className="empty-sub">Toque no + para criar (Café, Almoço, Janta...).</p></div>
          : tipos.map(t=>(
            <div key={t.id} style={{background:'white',borderRadius:12,boxShadow:'0 1px 5px rgba(0,0,0,0.12)',marginBottom:10,overflow:'hidden',display:'flex'}}>
              <div style={{width:6,alignSelf:'stretch',background:t.cor,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:14,padding:'16px 15px'}}>
                <div style={{width:58,height:58,borderRadius:'50%',background:t.cor+'24',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:27,lineHeight:1}}>{t.emoji || '🍽️'}</div>
                <p style={{flex:1,minWidth:0,fontWeight:700,fontSize:15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t.nome}</p>
                <div style={{display:'flex',gap:8,flexShrink:0}}>
                  <button onClick={()=>abrirEditarTipo(t)} aria-label="Editar" style={{width:34,height:34,borderRadius:8,background:'var(--bg)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)',fontFamily:'inherit'}}><span className="icon icon-sm">edit</span></button>
                  <button onClick={()=>excluirTipo(t.id)} aria-label="Excluir" style={{width:34,height:34,borderRadius:8,background:'var(--danger-bg)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm" style={{color:'var(--danger)'}}>delete</span></button>
                </div>
              </div>
            </div>
          ))
      )}

      {/* FAB - botão redondo de + conforme a aba */}
      <button className="fab" onClick={()=> aba==='cardapio' ? abrirNovoCardapio() : abrirNovoTipo()}>
        <span className="icon">add</span>
      </button>

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
            <select className="form-input" value={formCard.refeicao_tipo_id} onChange={e=>setFormCard(f=>({...f,refeicao_tipo_id:e.target.value}))} style={{marginBottom:12}}>
              <option value="">Selecione...</option>
              {tipos.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <label className="form-label">Título (opcional)</label>
            <input className="form-input" placeholder="Ex: Almoço de domingo" value={formCard.titulo} onChange={e=>setFormCard(f=>({...f,titulo:e.target.value}))} style={{marginBottom:12}}/>
            <label className="form-label">Itens do cardápio</label>
            <textarea className="form-input" placeholder="Arroz, feijão, salada..." rows={6} value={formCard.itens} onChange={e=>setFormCard(f=>({...f,itens:e.target.value}))} style={{resize:'vertical',marginBottom:16}}/>
            <button className="btn btn-primary btn-full" onClick={salvarCardapio} style={{marginBottom:8}}>Salvar</button>
            <button className="btn btn-ghost btn-full" onClick={()=>setModalCard(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {imprimir && (
        <PrintOverlay titulo="Cardápios da cozinha" onClose={()=>setImprimir(false)}>
          {(() => {
            const grupos = tipos.map(t => ({ tipo:t, cards:cardapios.filter(c=>c.refeicao_tipo_id===t.id) }))
            const semTipo = cardapios.filter(c=>!c.refeicao_tipo_id || !tipos.some(t=>t.id===c.refeicao_tipo_id))
            if (semTipo.length) grupos.push({ tipo:{ id:'_', nome:'Sem tipo', cor:'#6b7280', ordem:99, emoji:'🍽️' }, cards:semTipo })
            return grupos.filter(g=>g.cards.length).map(g => (
              <div key={g.tipo.id} style={{marginBottom:22}}>
                <h2 style={{fontSize:17,fontWeight:800,marginBottom:10,borderBottom:`2px solid ${g.tipo.cor}`,paddingBottom:4}}>{g.tipo.emoji||'🍽️'} {g.tipo.nome}</h2>
                {g.cards.map(c => (
                  <div key={c.id} style={{border:'1px solid #e5e7eb',borderRadius:8,padding:'10px 12px',marginBottom:8,breakInside:'avoid'}}>
                    <p style={{fontWeight:700,fontSize:14}}>{c.titulo || 'Cardápio'}</p>
                    {c.itens && <p style={{fontSize:13,color:'#374151',whiteSpace:'pre-wrap',marginTop:4}}>{c.itens}</p>}
                  </div>
                ))}
              </div>
            ))
          })()}
        </PrintOverlay>
      )}
    </div>
  )
}
