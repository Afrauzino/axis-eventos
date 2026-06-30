import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type RefTipo = { id:string; nome:string; cor:string; ordem:number }
type Cardapio = { id:string; refeicao_tipo_id:string|null; tipo_refeicao_nome:string|null; titulo:string|null; itens:string|null }

const CORES = ['#00A99D','#6B46C1','#2F855A','#D69E2E','#E53E3E','#3182CE','#DD6B20','#805AD5']

export default function Cozinha({ profile }: { profile?: Profile }) {
  const { evento, loading:evLoading } = useEvento()
  const [tipos, setTipos] = useState<RefTipo[]>([])
  const [cardapios, setCardapios] = useState<Cardapio[]>([])
  const [tipoSel, setTipoSel] = useState<string>('') // filtro horizontal
  const [loading, setLoading] = useState(true)

  // modal tipo
  const [modalTipo, setModalTipo] = useState(false)
  const [novoTipo, setNovoTipo] = useState({ nome:'', cor:CORES[0] })

  // modal cardapio
  const [modalCard, setModalCard] = useState(false)
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
    if (!tipoSel && (t.data ?? []).length) setTipoSel('todos')
    setLoading(false)
  }

  async function criarTipo() {
    if (!novoTipo.nome.trim() || !evento) return
    const { data } = await supabase.from('refeicao_tipos').insert({
      event_id:evento.id, nome:novoTipo.nome.trim(), cor:novoTipo.cor, ordem:tipos.length,
    }).select().single()
    if (data) setTipos(prev=>[...prev,data])
    setNovoTipo({ nome:'', cor:CORES[0] }); setModalTipo(false)
  }
  async function excluirTipo(id:string) {
    if (!confirm('Excluir este tipo de refeição?')) return
    await supabase.from('refeicao_tipos').delete().eq('id',id)
    setTipos(prev=>prev.filter(t=>t.id!==id))
  }

  function abrirNovoCardapio() {
    setEditCard(null); setFormCard({ refeicao_tipo_id: tipos[0]?.id ?? '', titulo:'', itens:'', data_servir:'' }); setModalCard(true)
  }
  function abrirEditarCardapio(c:Cardapio) {
    setEditCard(c); setFormCard({ refeicao_tipo_id:c.refeicao_tipo_id??'', titulo:c.titulo??'', itens:c.itens??'', data_servir:(c as any).data_servir??'' }); setModalCard(true)
  }
  async function salvarCardapio() {
    if (!evento) return
    const tipo = tipos.find(t=>t.id===formCard.refeicao_tipo_id)
    const payload = {
      event_id:evento.id, refeicao_tipo_id:formCard.refeicao_tipo_id||null,
      tipo_refeicao_nome:tipo?.nome ?? null, titulo:formCard.titulo||null, itens:formCard.itens||null, data_servir:formCard.data_servir||null,
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

  const cardapiosFiltrados = tipoSel==='todos'||!tipoSel ? cardapios : cardapios.filter(c=>c.refeicao_tipo_id===tipoSel)

  return (
    <div className="page slide-up">
      {/* Menu horizontal de tipos de refeição */}
      <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:8,marginBottom:14}}>
        <button onClick={()=>setTipoSel('todos')} className={`chip ${tipoSel==='todos'?'active':''}`}>Todos</button>
        {tipos.map(t=>(
          <button key={t.id} onClick={()=>setTipoSel(t.id)} style={{padding:'7px 14px',borderRadius:99,border:tipoSel===t.id?`2px solid ${t.cor}`:'1px solid var(--border)',background:tipoSel===t.id?t.cor:'white',color:tipoSel===t.id?'white':'var(--text)',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700,whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}>
            {t.nome}
            <span onClick={(e)=>{e.stopPropagation();excluirTipo(t.id)}} style={{fontSize:14,opacity:0.7}}>×</span>
          </button>
        ))}
        <button onClick={()=>setModalTipo(true)} style={{padding:'7px 12px',borderRadius:99,border:'1px dashed var(--primary)',background:'none',color:'var(--primary)',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700,whiteSpace:'nowrap'}}>+ Tipo</button>
      </div>

      <button className="btn btn-primary btn-full" onClick={abrirNovoCardapio} style={{marginBottom:14}}><span className="icon icon-sm">add</span> Novo cardápio</button>

      {cardapiosFiltrados.length===0
        ? <div className="empty"><p className="empty-title">Nenhum cardápio</p><p className="empty-sub">Crie o primeiro cardápio.</p></div>
        : cardapiosFiltrados.map(c=>{
          const tipo = tipos.find(t=>t.id===c.refeicao_tipo_id)
          return (
            <div key={c.id} style={{background:'white',borderRadius:14,padding:'14px 16px',marginBottom:8,boxShadow:'var(--shadow-sm)',borderLeft:`4px solid ${tipo?.cor??'var(--primary)'}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div>
                  {tipo && <span style={{fontSize:10,fontWeight:700,color:'white',background:tipo.cor,padding:'2px 8px',borderRadius:99}}>{tipo.nome}</span>}
                  <p style={{fontSize:14,fontWeight:700,marginTop:4}}>{c.titulo || 'Cardápio'}</p>
                </div>
                <div style={{display:'flex',gap:4}}>
                  <button onClick={()=>abrirEditarCardapio(c)} style={{background:'none',border:'none',cursor:'pointer',padding:4}}><span className="icon icon-sm" style={{color:'var(--primary)'}}>edit</span></button>
                  <button onClick={()=>excluirCardapio(c.id)} style={{background:'none',border:'none',cursor:'pointer',padding:4}}><span className="icon icon-sm" style={{color:'var(--danger)'}}>delete</span></button>
                </div>
              </div>
              {c.itens && <p style={{fontSize:13,color:'var(--muted)',whiteSpace:'pre-wrap'}}>{c.itens}</p>}
            </div>
          )
        })
      }

      {/* Modal novo tipo */}
      {modalTipo && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center',padding:18}} onClick={e=>e.target===e.currentTarget&&setModalTipo(false)}>
          <div style={{background:'white',borderRadius:18,padding:'22px',width:'100%',maxWidth:380}}>
            <p style={{fontSize:16,fontWeight:800,marginBottom:14}}>Novo tipo de refeição</p>
            <input className="form-input" placeholder="Ex: Café da manhã, Almoço..." value={novoTipo.nome} onChange={e=>setNovoTipo(f=>({...f,nome:e.target.value}))} style={{marginBottom:12}}/>
            <p style={{fontSize:12,fontWeight:700,color:'var(--muted)',marginBottom:8}}>Cor</p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
              {CORES.map(c=><button key={c} onClick={()=>setNovoTipo(f=>({...f,cor:c}))} style={{width:32,height:32,borderRadius:8,background:c,border:novoTipo.cor===c?'3px solid var(--text)':'none',cursor:'pointer'}}/>)}
            </div>
            <button className="btn btn-primary btn-full" onClick={criarTipo} style={{marginBottom:8}}>Criar</button>
            <button className="btn btn-ghost btn-full" onClick={()=>setModalTipo(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Modal cardápio */}
      {modalCard && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={e=>e.target===e.currentTarget&&setModalCard(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'22px',width:'100%',maxWidth:480,maxHeight:'88vh',overflowY:'auto'}}>
            <p style={{fontSize:17,fontWeight:800,marginBottom:14}}>{editCard?'Editar cardápio':'Novo cardápio'}</p>
            <label className="form-label">Tipo de refeição</label>
            <select className="form-input" value={formCard.refeicao_tipo_id} onChange={e=>setFormCard(f=>({...f,refeicao_tipo_id:e.target.value}))} style={{marginBottom:12}}>
              <option value="">Selecione...</option>
              {tipos.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <label className="form-label">Título (opcional)</label>
            <input className="form-input" placeholder="Ex: Almoço de domingo" value={formCard.titulo} onChange={e=>setFormCard(f=>({...f,titulo:e.target.value}))} style={{marginBottom:12}}/>
            <label className="form-label">Dia em que será servido</label>
            <input className="form-input" type="date" value={formCard.data_servir} onChange={e=>setFormCard(f=>({...f,data_servir:e.target.value}))}
              min={(evento as any)?.start_date || undefined} max={(evento as any)?.end_date || undefined} style={{marginBottom:12}}/>
            <label className="form-label">Itens do cardápio</label>
            <textarea className="form-input" placeholder="Arroz, feijão, salada..." rows={6} value={formCard.itens} onChange={e=>setFormCard(f=>({...f,itens:e.target.value}))} style={{resize:'vertical',marginBottom:16}}/>
            <button className="btn btn-primary btn-full" onClick={salvarCardapio} style={{marginBottom:8}}>Salvar</button>
            <button className="btn btn-ghost btn-full" onClick={()=>setModalCard(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
