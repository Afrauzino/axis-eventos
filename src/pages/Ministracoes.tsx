import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getInitials, fmtHora, fmtData, isAdmin, hasRole } from '../utils'
import { useEvento } from '../hooks/useEvento'
import PersonSelect from '../components/PersonSelect'
import RichEditor from '../components/RichEditor'
import ArquivosModulo from '../components/ArquivosModulo'
import EmojiPicker from '../components/EmojiPicker'
import type { Profile } from '../App'

type Ministracao = {
  id:string; titulo:string; ministrante_id:string|null
  hora_inicio:string; hora_fim:string
  local:string|null; tema:string|null; status:string
  conteudo_sermao:string|null        // texto do sermão (admin + líderes)
  conteudo_teatro:string|null        // texto do teatro vinculado
  continuacao_sermao:string|null     // continuação do sermão
  anotacoes_pessoais:string|null     // só o ministrante vê
}
type Pessoa = { id:string; name:string; photo_url:string|null }

const STATUS_BADGE: Record<string,string> = { planejado:'badge-neutral', em_andamento:'badge-warning', concluido:'badge-success', cancelado:'badge-danger' }
const FORM_VAZIO = { titulo:'', ministrante_id:'', hora_inicio:'', hora_fim:'', local:'', conteudo_sermao:'', continuacao_sermao:'', anotacoes_pessoais:'', teatro_id:'', emoji:'', cor:'#6B46C1' }
const TIPOS_BLOCO = ['Esboço','Teatro','Continuação','Anotação pastoral','Oração','Referência bíblica','Outro']

export default function Ministracoes({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [mins, setMins]         = useState<Ministracao[]>([])
  const [pessoas, setPessoas]   = useState<Pessoa[]>([])
  const [loading, setLoading]   = useState(true)
  const [locais, setLocais]     = useState<{id:string;nome:string}[]>([])
  const [teatros, setTeatros]   = useState<{id:string;nome:string;ministracao_id:string|null;cor:string|null}[]>([])
  const [detalhe, setDetalhe]   = useState<Ministracao|null>(null)
  const [abaDetalhe, setAbaDetalhe] = useState<'info'|'sermao'|'anotacoes'>('info')
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState<Ministracao|null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')
  const [form, setForm]         = useState({ ...FORM_VAZIO })
  const [abaForm, setAbaForm]   = useState<'basico'|'conteudo'>('basico')
  const [blocos, setBlocos]     = useState<{tipo:string;conteudo:string}[]>([])
  const blocoImgRef = useRef<HTMLInputElement>(null)

  const canEdit    = profile && isAdmin(profile.user_role)
  const userId     = profile?.user_id
  const isLiderPlus = profile && hasRole(profile.user_role, 'lider')

  const { id: paramId } = useParams()
  const navigate = useNavigate()

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  // Auto-open ministração when navigating from cronograma
  useEffect(() => {
    if (paramId && mins.length > 0) {
      const m = mins.find(m => m.id === paramId)
      if (m) { setDetalhe(m); setAbaDetalhe('info') }
    }
  }, [paramId, mins])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [mi, pe, lo, te] = await Promise.all([
      supabase.from('ministrações').select('*').eq('event_id',evento.id).order('hora_inicio'),
      supabase.from('people').select('id,name,photo_url').eq('event_id',evento.id).order('name'),
      supabase.from('locais').select('id,nome').eq('event_id',evento.id).order('nome'),
      supabase.from('theaters').select('id,nome,ministracao_id,cor').eq('event_id',evento.id).order('nome'),
    ])
    setMins(mi.data ?? [])
    setPessoas(pe.data ?? [])
    setLocais(lo.data ?? [])
    setTeatros(te.data ?? [])
    setLoading(false)
  }

  async function mudarStatusMin(id: string, statusAtual: string) {
    const ordem = ['planejado','em_andamento','concluido','cancelado']
    const idx   = ordem.indexOf(statusAtual)
    const prox  = ordem[(idx + 1) % ordem.length]
    await supabase.from('ministrações').update({ status: prox }).eq('id', id)
    setMins(prev => prev.map(m => m.id===id ? {...m, status:prox} : m))
    setDetalhe(prev => prev?.id===id ? {...prev, status:prox} : prev)
  }

  function getPessoa(id:string|null) { return id ? pessoas.find(p=>p.id===id) : null }

  function abrirNovo() {
    setEditando(null); setForm({...FORM_VAZIO}); setErro(''); setAbaForm('basico'); setBlocos([]); setModal(true)
  }

  function abrirEdicao(m:Ministracao) {
    setEditando(m)
    const teatroVinc = teatros.find(t=>t.ministracao_id===m.id)
    setForm({ titulo:m.titulo, ministrante_id:m.ministrante_id??'', hora_inicio:new Date(m.hora_inicio).toISOString().slice(0,16), hora_fim:new Date(m.hora_fim).toISOString().slice(0,16), local:m.local??'', conteudo_sermao:m.conteudo_sermao??'', continuacao_sermao:m.continuacao_sermao??'', anotacoes_pessoais:m.anotacoes_pessoais??'', teatro_id:teatroVinc?.id??'', emoji:(m as any).emoji??'', cor:(m as any).cor??'#6B46C1' })
    setErro(''); setAbaForm('basico')
    // Rebuild blocos from saved JSON or legacy fields
    let bl: {tipo:string;conteudo:string}[] = []
    if (m.conteudo_sermao) {
      try { bl = JSON.parse(m.conteudo_sermao) }
      catch { bl = [{tipo:'Esboço',conteudo:m.conteudo_sermao}] }
    }
    if (bl.length===0 && m.conteudo_teatro) bl.push({tipo:'Teatro',conteudo:m.conteudo_teatro})
    if (bl.length===0 && m.continuacao_sermao) bl.push({tipo:'Continuação',conteudo:m.continuacao_sermao})
    setBlocos(bl)
    setModal(true)
  }

  async function salvar(e:React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true)
    if (!evento||!form.titulo.trim()) { setErro('Título obrigatório.'); setSalvando(false); return }
    const payload = {
      titulo:form.titulo, ministrante_id:form.ministrante_id||null,
      hora_inicio:new Date(form.hora_inicio).toISOString(),
      hora_fim:new Date(form.hora_fim).toISOString(),
      local:form.local||null, status:'planejado', emoji:form.emoji||null, cor:form.cor||'#6B46C1',
      conteudo_sermao: blocos.length > 0 ? JSON.stringify(blocos) : null,
      conteudo_teatro: blocos.find(b=>b.tipo==='Teatro')?.conteudo||null,
      continuacao_sermao: blocos.find(b=>b.tipo==='Continuação')?.conteudo||null,
    }
    let err
    if (editando) { const r=await supabase.from('ministrações').update(payload).eq('id',editando.id); err=r.error }
    else { const r=await supabase.from('ministrações').insert({...payload,event_id:evento.id}); err=r.error }
    if (err) { setErro('Erro: '+err.message); setSalvando(false); return }
    // Sync teatro link
    if (form.teatro_id) {
      const minId = editando?.id ?? (await supabase.from('ministrações').select('id').eq('event_id',evento.id).eq('titulo',form.titulo).order('created_at',{ascending:false}).limit(1).single()).data?.id
      if (minId) await supabase.from('theaters').update({ ministracao_id: minId }).eq('id', form.teatro_id)
    } else if (editando) {
      await supabase.from('theaters').update({ ministracao_id: null }).eq('ministracao_id', editando.id)
    }
    setModal(false); setSalvando(false); setEditando(null); carregar()
  }

  async function excluir(id:string) {
    if (!confirm('Excluir esta ministração?')) return
    await supabase.from('ministrações').delete().eq('id',id)
    setDetalhe(null); carregar()
  }

  async function salvarAnotacoes(id:string, val:string) {
    await supabase.from('ministrações').update({anotacoes_pessoais:val}).eq('id',id)
  }

  const STATUS_LABEL: Record<string,string> = { planejado:'Planejado', em_andamento:'Em andamento', concluido:'Concluído', cancelado:'Cancelado' }

  return (
    <div className="page">
      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:8,borderRadius:14}}/>) :
      mins.length===0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>church</span></div>
          <p className="empty-title">Nenhuma ministração</p>
          {canEdit && <button className="btn btn-primary btn-sm" onClick={abrirNovo}>Cadastrar</button>}
        </div>
      ) : mins.map(m => {
        const min = getPessoa(m.ministrante_id)
        return (
          <button key={m.id} className="list-card" onClick={()=>{setDetalhe(m);setAbaDetalhe('info')}}>
            <div className="list-card-bar" style={{background:(m as any).cor??'#6B46C1'}}/>
            <div className="list-card-media" style={{background:(m as any).cor??'#6B46C1'}}>
              {(m as any).emoji
                ? <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:22,color:'white',fontWeight:'normal',fontStyle:'normal',lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',userSelect:'none'}}>{(m as any).emoji}</span>
                : min?.photo_url?<img src={min.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span className="icon" style={{color:'#6B46C1'}}>church</span>}
            </div>
            <div className="list-card-body">
              <div className="list-card-time" style={{color:'#6B46C1'}}>{fmtData(m.hora_inicio)} · {fmtHora(m.hora_inicio)}</div>
              <div className="list-card-title">{m.titulo}</div>
              <div className="list-card-desc">{min?.name??'Sem ministrante'}{m.local?` · ${m.local}`:''}</div>
            </div>
            <button
              onClick={e=>{e.stopPropagation();mudarStatusMin(m.id,m.status)}}
              className={`badge ${STATUS_BADGE[m.status]??'badge-neutral'}`}
              style={{flexShrink:0,marginRight:4,fontSize:10,border:'none',cursor:'pointer',fontFamily:'inherit'}}
              title="Clique para avançar status"
            >{STATUS_LABEL[m.status]??m.status}</button>
            <div className="list-card-chevron"><span className="icon icon-sm">chevron_right</span></div>
          </button>
        )
      })}

      {canEdit && <button className="fab" onClick={abrirNovo}><span className="icon">add</span></button>}

      {/* ===== DETALHE ===== */}
      {detalhe && (() => {
        const min = getPessoa(detalhe.ministrante_id)
        const isEuMinistrant = min?.id && pessoas.find(p=>p.id===min.id)?.id === userId
        const canSeeConteudo = isLiderPlus

        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setDetalhe(null)}>
            <div style={{background:'white',borderRadius:'20px 20px 0 0',maxHeight:'90vh',overflowY:'auto'}}>
              <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>

              {/* Header roxo */}
              <div style={{background:(detalhe as any).cor??'#6B46C1',padding:'14px 20px',marginTop:8,color:'white'}}>
                <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',opacity:0.75,marginBottom:4}}>Ministração</p>
                <p style={{fontSize:17,fontWeight:800,marginBottom:2}}>{detalhe.titulo}</p>
                <p style={{fontSize:12,opacity:0.8}}>{fmtHora(detalhe.hora_inicio)} — {fmtHora(detalhe.hora_fim)}{detalhe.local?` · ${detalhe.local}`:''}</p>
              </div>

              {/* Abas do detalhe */}
              <div style={{display:'flex',borderBottom:'1px solid var(--border)',background:'white'}}>
                {[
                  {id:'info',    label:'Info'},
                  ...(canSeeConteudo?[{id:'sermao',  label:'Esboço'}]:[]),
                  ...(isEuMinistrant?[{id:'anotacoes',label:'Minhas notas'}]:[]),
                ].map(({id,label})=>(
                  <button key={id} type="button" onClick={()=>setAbaDetalhe(id as any)} style={{flex:1,padding:'10px 4px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:abaDetalhe===id?700:400,color:abaDetalhe===id?'#6B46C1':'var(--muted)',borderBottom:abaDetalhe===id?'2px solid #6B46C1':'2px solid transparent',transition:'all 0.15s'}}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{padding:'16px 20px 32px'}}>
                {abaDetalhe==='info' && (
                  <>
                    <div className="info-section mb-3">
                      {min && <div className="info-row"><span className="info-label">Ministrante</span>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:28,height:28,borderRadius:'50%',background:'#6B46C1',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                            {min.photo_url?<img src={min.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:11,fontWeight:700,color:'white'}}>{getInitials(min.name)}</span>}
                          </div>
                          <span className="info-value">{min.name}</span>
                        </div>
                      </div>}
                                            <div className="info-row">
                      <span className="info-label">Status</span>
                      <button
                        onClick={()=>mudarStatusMin(detalhe.id,detalhe.status)}
                        className={`badge ${STATUS_BADGE[detalhe.status]??'badge-neutral'}`}
                        style={{border:'none',cursor:'pointer',fontFamily:'inherit'}}
                        title="Clique para avançar status"
                      >{STATUS_LABEL[detalhe.status]??detalhe.status} ▶</button>
                    </div>
                    </div>
                    {/* Teatro vinculado */}
                    {(() => {
                      const teatroLink = teatros.find(t=>t.ministracao_id===detalhe.id)
                      return teatroLink ? (
                        <button onClick={()=>{ setDetalhe(null); navigate('/teatro/'+teatroLink.id) }} style={{width:'100%',background:teatroLink.cor?teatroLink.cor+'22':'#FFF3E0',border:`1px solid ${teatroLink.cor??'var(--accent)'}`,borderRadius:12,padding:'12px 14px',marginBottom:12,cursor:'pointer',fontFamily:'inherit',textAlign:'left',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <div>
                            <p style={{fontSize:10,fontWeight:700,color:teatroLink.cor??'var(--accent)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Teatro vinculado</p>
                            <p style={{fontWeight:700,fontSize:14}}>{teatroLink.nome}</p>
                          </div>
                          <span className="icon icon-sm" style={{color:teatroLink.cor??'var(--accent)'}}>chevron_right</span>
                        </button>
                      ) : null
                    })()}

                    {/* Teatro vinculado - clicável na aba info */}
                    {(() => {
                      const teatroLink = teatros.find(t=>t.ministracao_id===detalhe.id)
                      return teatroLink ? (
                        <button
                          onClick={()=>{ setDetalhe(null); navigate('/teatro/'+teatroLink.id) }}
                          style={{width:'100%',background:teatroLink.cor?teatroLink.cor+'22':'#FFF3E0',border:`1.5px solid ${teatroLink.cor??'var(--accent)'}`,borderRadius:12,padding:'12px 14px',marginBottom:12,cursor:'pointer',fontFamily:'inherit',textAlign:'left',display:'flex',alignItems:'center',justifyContent:'space-between'}}
                        >
                          <div>
                            <p style={{fontSize:10,fontWeight:700,color:teatroLink.cor??'var(--accent)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Teatro vinculado</p>
                            <p style={{fontWeight:700,fontSize:14}}>{teatroLink.nome}</p>
                          </div>
                          <span className="icon icon-sm" style={{color:teatroLink.cor??'var(--accent)'}}>chevron_right</span>
                        </button>
                      ) : null
                    })()}

                    {canEdit && (
                      <div style={{display:'flex',gap:8}}>
                        <button className="btn btn-ghost" style={{flex:1}} onClick={()=>{setDetalhe(null);abrirEdicao(detalhe)}}>Editar</button>
                        <button className="btn" style={{flex:1,background:'var(--danger-bg)',color:'var(--danger)',border:'none'}} onClick={()=>excluir(detalhe.id)}>Excluir</button>
                      </div>
                    )}
                  </>
                )}

                {abaDetalhe==='sermao' && canSeeConteudo && (
                  <div>
                    <p style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>Conteúdo visível para líderes e administradores.</p>
                    {(() => {
                      if (!detalhe.conteudo_sermao) return <p style={{fontSize:13,color:'var(--muted)',fontStyle:'italic'}}>Nenhum conteúdo cadastrado.</p>
                      let bls: {tipo:string;conteudo:string}[] = []
                      try { bls = JSON.parse(detalhe.conteudo_sermao) } catch { bls = [{tipo:'Esboço',conteudo:detalhe.conteudo_sermao}] }
                      return bls.map((bl,i)=>(
                        <div key={i} style={{marginBottom:16}}>
                          <p style={{fontSize:11,fontWeight:700,color:'var(--primary)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>{bl.tipo}</p>
                          {bl.tipo==='Imagem'
                            ? <img src={bl.conteudo} alt="" style={{width:'100%',borderRadius:8,display:'block'}}/>
                            : <div style={{fontSize:14,lineHeight:1.7,color:'var(--text)'}} dangerouslySetInnerHTML={{__html:bl.conteudo}}/>
                          }
                          {i<bls.length-1 && <div style={{height:1,background:'var(--border)',marginTop:16}}/>}
                        </div>
                      ))
                    })()}
                    {/* Arquivos só na edição/criação, não na visualização */}
                  </div>
                )}

                {abaDetalhe==='anotacoes' && isEuMinistrant && (
                  <div>
                    <p style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>Visíveis apenas para você.</p>
                    <RichEditor
                      value={detalhe.anotacoes_pessoais??''}
                      onChange={v=>salvarAnotacoes(detalhe.id,v)}
                      placeholder="Suas anotações privadas..."
                      minHeight={150}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ===== MODAL CRIAR/EDITAR ===== */}
      {modal && canEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',maxHeight:'95vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px 14px',borderBottom:'1px solid var(--border)'}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?'Editar ministração':'Nova ministração'}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>

            <div style={{display:'flex',borderBottom:'1px solid var(--border)'}}>
              <button type="button" onClick={()=>setAbaForm('basico')} style={{flex:1,padding:'10px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:abaForm==='basico'?700:400,color:abaForm==='basico'?'#6B46C1':'var(--muted)',borderBottom:abaForm==='basico'?'2px solid #6B46C1':'2px solid transparent'}}>Básico</button>
              <button type="button" onClick={()=>setAbaForm('conteudo')} style={{flex:1,padding:'10px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:abaForm==='conteudo'?700:400,color:abaForm==='conteudo'?'#6B46C1':'var(--muted)',borderBottom:abaForm==='conteudo'?'2px solid #6B46C1':'2px solid transparent'}}>Conteúdo</button>
            </div>

            {erro && <div className="alert-box alert-error" style={{margin:'12px 20px 0'}}>{erro}</div>}

            <form onSubmit={salvar}>
              <div style={{padding:'16px 20px 32px'}}>
                {abaForm==='basico' ? (
                  <>
                    <div className="form-group"><label className="form-label">Título <span className="req">*</span></label>
                      <input className="form-input" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} required/>
                    </div>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Cor de identificação</label>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:6}}>
                          {['#6B46C1','#00A99D','#E8821A','#2F855A','#C53030','#2B6CB0','#D53F8C','#1A202C'].map(cor=>(
                            <button key={cor} type="button" onClick={()=>setForm(f=>({...f,cor}))} style={{width:28,height:28,borderRadius:6,background:cor,border:'none',cursor:'pointer',boxShadow:form.cor===cor?`0 0 0 3px white, 0 0 0 5px ${cor}`:'none',transition:'box-shadow 0.15s'}}/>
                          ))}
                        </div>
                        <input type="color" value={form.cor} onChange={e=>setForm(f=>({...f,cor:e.target.value}))} style={{width:40,height:32,borderRadius:6,border:'1px solid var(--border)',cursor:'pointer',padding:2}}/>
                      </div>
                      <div className="form-group">
                        <EmojiPicker label="Emoji / Ícone" value={form.emoji} onChange={v=>setForm(f=>({...f,emoji:v}))}/>
                      </div>
                    </div>
                    <div className="form-group">
                      <PersonSelect label="Ministrante" pessoas={pessoas} value={form.ministrante_id} onChange={id=>setForm(f=>({...f,ministrante_id:id}))} placeholder="Buscar ministrante..."/>
                    </div>
                    <div className="form-grid-2">
                      <div className="form-group"><label className="form-label">Início <span className="req">*</span></label>
                        <input className="form-input" type="datetime-local" value={form.hora_inicio} onChange={e=>setForm(f=>({...f,hora_inicio:e.target.value}))} required min={(evento as any)?.start_date ? `${(evento as any).start_date}T00:00` : undefined} max={(evento as any)?.end_date ? `${(evento as any).end_date}T23:59` : undefined}/>
                      </div>
                      <div className="form-group"><label className="form-label">Fim <span className="req">*</span></label>
                        <input className="form-input" type="datetime-local" value={form.hora_fim} onChange={e=>setForm(f=>({...f,hora_fim:e.target.value}))} required min={(evento as any)?.start_date ? `${(evento as any).start_date}T00:00` : undefined} max={(evento as any)?.end_date ? `${(evento as any).end_date}T23:59` : undefined}/>
                      </div>
                    </div>
                    <div className="form-group"><label className="form-label">Local</label>
                      <select className="form-select" value={form.local} onChange={e=>setForm(f=>({...f,local:e.target.value}))}>
                        <option value="">Selecionar local...</option>
                        {locais.map(l=><option key={l.id} value={l.nome}>{l.nome}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Teatro vinculado</label>
                      <p className="form-hint mb-2">Ao vincular, teatro e ministração se abrem mutuamente. Cada teatro só pode ser vinculado a uma ministração.</p>
                      <select className="form-select" value={form.teatro_id} onChange={e=>setForm(f=>({...f,teatro_id:e.target.value}))}>
                        <option value="">Nenhum</option>
                        {teatros.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    {blocos.map((bloco,idx)=>(
                      <div key={idx} style={{marginBottom:16,border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'var(--bg)',borderBottom:'1px solid var(--border)'}}>
                          <span style={{flex:1,fontSize:13,fontWeight:700,color:'var(--primary)'}}>{bloco.tipo==='Imagem'?'🖼️ Imagem':bloco.tipo}</span>
                          {bloco.tipo!=='Imagem' && (
                            <select value={bloco.tipo} onChange={e=>setBlocos(prev=>prev.map((b,i)=>i===idx?{...b,tipo:e.target.value}:b))} style={{border:'none',background:'transparent',fontSize:12,fontWeight:600,color:'var(--muted)',fontFamily:'inherit',cursor:'pointer'}}>
                              {TIPOS_BLOCO.map(t=><option key={t} value={t}>{t}</option>)}
                            </select>
                          )}
                          {idx>0 && <button type="button" onClick={()=>setBlocos(prev=>{const n=[...prev];[n[idx-1],n[idx]]=[n[idx],n[idx-1]];return n})} style={{background:'none',border:'none',cursor:'pointer',padding:2}} title="Subir"><span className="icon icon-sm" style={{color:'var(--muted)'}}>arrow_upward</span></button>}
                          {idx<blocos.length-1 && <button type="button" onClick={()=>setBlocos(prev=>{const n=[...prev];[n[idx+1],n[idx]]=[n[idx],n[idx+1]];return n})} style={{background:'none',border:'none',cursor:'pointer',padding:2}} title="Descer"><span className="icon icon-sm" style={{color:'var(--muted)'}}>arrow_downward</span></button>}
                          <button type="button" onClick={()=>setBlocos(prev=>prev.filter((_,i)=>i!==idx))} style={{background:'var(--danger-bg)',color:'var(--danger)',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'inherit'}}>Remover</button>
                        </div>
                        {bloco.tipo==='Imagem'
                          ? (bloco.conteudo
                              ? <img src={bloco.conteudo} alt="" style={{width:'100%',display:'block'}}/>
                              : <div style={{padding:16,textAlign:'center',color:'var(--muted)',fontSize:12}}>Imagem não carregada</div>)
                          : <RichEditor value={bloco.conteudo} onChange={v=>setBlocos(prev=>prev.map((b,i)=>i===idx?{...b,conteudo:v}:b))} placeholder="Escreva o conteúdo aqui..." minHeight={100}/>
                        }
                      </div>
                    ))}
                    <div style={{display:'flex',gap:8}}>
                      <button type="button" onClick={()=>setBlocos(prev=>[...prev,{tipo:'Esboço',conteudo:''}])} style={{flex:1,padding:'12px',border:'2px dashed var(--border)',borderRadius:12,background:'none',cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--primary)',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                        <span className="icon icon-sm">add</span> Texto
                      </button>
                      <button type="button" onClick={()=>blocoImgRef.current?.click()} style={{flex:1,padding:'12px',border:'2px dashed var(--border)',borderRadius:12,background:'none',cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--primary)',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                        <span className="icon icon-sm">image</span> Foto
                      </button>
                    </div>
                    <input ref={blocoImgRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={async e=>{
                      const fs=Array.from(e.target.files??[])
                      for(const f of fs){
                        const ext=f.name.split('.').pop()
                        const path=`ministracao/blocos/${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`
                        const {error}=await supabase.storage.from('arquivos').upload(path,f,{upsert:true})
                        if(!error){const {data:u}=supabase.storage.from('arquivos').getPublicUrl(path); setBlocos(prev=>[...prev,{tipo:'Imagem',conteudo:u.publicUrl}])}
                        else alert('Erro ao enviar imagem: '+error.message)
                      }
                      e.target.value=''
                    }}/>
                  </>
                )}
                <button type="submit" className="btn btn-primary btn-full" disabled={salvando} style={{marginTop:8}}>
                  {salvando?'Salvando...':editando?'Salvar':'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
