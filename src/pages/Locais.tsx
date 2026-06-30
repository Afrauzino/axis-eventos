import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isAdmin } from '../utils'
import UploadFoto from '../components/UploadFoto'
import EmojiPicker from '../components/EmojiPicker'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

function MatIcon({ name, size=22, color='var(--primary)' }: { name:string; size?:number; color?:string }) {
  return <span style={{fontFamily:"'Material Symbols Outlined'",fontWeight:'normal',fontStyle:'normal',fontSize:size,lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',direction:'ltr',WebkitFontSmoothing:'antialiased',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",color,userSelect:'none'}}>{name}</span>
}

type Local  = { id:string; nome:string; tipo:string; capacidade:number|null; observacoes:string|null; equipe_responsavel_id:string|null; icone:string|null; foto_url:string|null }
type Equipe = { id:string; name:string; color:string }

const TIPOS = [['trabalho','Trabalho'],['alojamento','Alojamento'],['sanitario','Sanitario'],['refeicao','Refeicao'],['outro','Outro']]
const TIPO_COR: Record<string,string> = { trabalho:'var(--primary)', alojamento:'#2B6CB0', sanitario:'#718096', refeicao:'var(--success)', outro:'var(--muted)' }
const TIPO_ICONE_PADRAO: Record<string,string> = { trabalho:'meeting_room', alojamento:'bed', sanitario:'wc', refeicao:'restaurant', outro:'location_on' }

export default function Locais({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [lista, setLista]     = useState<Local[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [editando, setEditando] = useState<Local|null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]       = useState('')
  const [filtro, setFiltro]   = useState('todos')
  const [abaMedia, setAbaMedia] = useState<'emoji'|'foto'>('emoji')
  const [fotoUrl, setFotoUrl] = useState<string|null>(null)
  const [form, setForm] = useState({ nome:'', tipo:'trabalho', capacidade:'', observacoes:'', equipe_responsavel_id:'', icone:'', cor:'#00A99D' })

  const canEdit = profile && isAdmin(profile.user_role)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [lo, eq] = await Promise.all([
      supabase.from('locais').select('*').eq('event_id',evento.id).order('nome'),
      supabase.from('teams').select('id,name,color').eq('event_id',evento.id).order('name'),
    ])
    setLista(lo.data??[])
    setEquipes(eq.data??[])
    setLoading(false)
  }

  function abrirNovo() {
    setEditando(null); setForm({nome:'',tipo:'trabalho',capacidade:'',observacoes:'',equipe_responsavel_id:'',icone:'',cor:'#00A99D'}); setFotoUrl(null); setAbaMedia('emoji'); setErro(''); setModal(true)
  }

  function abrirEdicao(l: Local) {
    setEditando(l)
    setForm({nome:l.nome,tipo:l.tipo,capacidade:l.capacidade?String(l.capacidade):'',observacoes:l.observacoes??'',equipe_responsavel_id:l.equipe_responsavel_id??'',icone:l.icone??'',cor:(l as any).cor??'#00A99D'})
    setFotoUrl(l.foto_url??null)
    setAbaMedia(l.foto_url?'foto':'emoji')
    setErro(''); setModal(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true)
    if (!evento||!form.nome.trim()) { setErro('Nome obrigatorio.'); setSalvando(false); return }
    const payload = { nome:form.nome, tipo:form.tipo, capacidade:form.capacidade?parseInt(form.capacidade):null, observacoes:form.observacoes||null, equipe_responsavel_id:form.equipe_responsavel_id||null, icone:form.icone||null, foto_url:fotoUrl||null, cor:form.cor||'#00A99D' }
    let err
    if (editando) { const r=await supabase.from('locais').update(payload).eq('id',editando.id); err=r.error }
    else { const r=await supabase.from('locais').insert({...payload,event_id:evento.id}); err=r.error }
    if (err) { setErro('Erro: '+err.message); setSalvando(false); return }
    setModal(false); setSalvando(false); setEditando(null); carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este local?')) return
    await supabase.from('locais').delete().eq('id',id)
    setModal(false); carregar()
  }

  function renderMedia(l: Local) {
    if (l.foto_url) return <img src={l.foto_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
    const cor = TIPO_COR[l.tipo]??'var(--primary)'
    const iconeName = l.icone || TIPO_ICONE_PADRAO[l.tipo] || 'location_on'
    return <MatIcon name={iconeName} size={22} color={cor}/>
  }

  const filtrados = filtro==='todos' ? lista : lista.filter(l=>l.tipo===filtro)

  return (
    <div className="page">
      <div className="filter-bar">
        {[['todos','Todos'],...TIPOS].map(([v,l])=>(
          <button key={v} className={`chip ${filtro===v?'active':''}`} onClick={()=>setFiltro(v)}>{l}</button>
        ))}
      </div>

      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:72,marginBottom:8,borderRadius:14}}/>) :
      filtrados.length===0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>location_on</span></div>
          <p className="empty-title">Nenhum local</p>
          <p className="empty-desc">Cadastre os espacos fisicos do evento.</p>
        </div>
      ) : filtrados.map(l => {
        const eq  = equipes.find(e=>e.id===l.equipe_responsavel_id)
        const cor = (l as any).cor ?? TIPO_COR[l.tipo] ?? 'var(--primary)'
        return (
          <button key={l.id} className="list-card" onClick={()=>canEdit?abrirEdicao(l):undefined}>
            <div className="list-card-bar" style={{background:cor}}/>
            <div className="list-card-media" style={{background:cor+'22',overflow:'hidden'}}>
              {renderMedia(l)}
            </div>
            <div className="list-card-body">
              <div className="list-card-title">{l.nome}</div>
              <div className="list-card-desc">
                {TIPOS.find(t=>t[0]===l.tipo)?.[1]??l.tipo}
                {l.capacidade ? ` · Cap: ${l.capacidade}` : ''}
                {eq ? ` · ${eq.name}` : ''}
              </div>
            </div>
            {canEdit && <div className="list-card-chevron"><span className="icon icon-sm">chevron_right</span></div>}
          </button>
        )
      })}

      {canEdit && <button className="fab" onClick={abrirNovo}><span className="icon">add</span></button>}

      {modal && canEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0 16px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?'Editar local':'Novo local'}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Nome <span className="req">*</span></label>
                <input className="form-input" placeholder="Ex: Sala Principal..." value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} required/>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Tipo</label>
                  <select className="form-select" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>
                    {TIPOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Capacidade</label>
                  <input className="form-input" type="number" placeholder="Ex: 50" value={form.capacidade} onChange={e=>setForm(f=>({...f,capacidade:e.target.value}))}/>
                </div>
                {/* Cor de identificação */}
                <div className="form-group">
                  <label className="form-label">Cor de identificação</label>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
                    {['#00A99D','#6B46C1','#E8821A','#2F855A','#C53030','#2B6CB0','#D53F8C','#1A202C','#718096','#D69E2E'].map(cor=>(
                      <button key={cor} type="button" onClick={()=>setForm(f=>({...f,cor}))} style={{width:32,height:32,borderRadius:8,background:cor,border:'none',cursor:'pointer',boxShadow:form.cor===cor?`0 0 0 3px white, 0 0 0 5px ${cor}`:'none',transition:'box-shadow 0.15s'}}/>
                    ))}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <input type="color" value={form.cor} onChange={e=>setForm(f=>({...f,cor:e.target.value}))} style={{width:40,height:36,borderRadius:8,border:'1px solid var(--border)',cursor:'pointer',padding:2}}/>
                    <div style={{height:36,flex:1,borderRadius:8,background:form.cor,display:'flex',alignItems:'center',paddingLeft:12}}>
                      <span style={{color:'white',fontWeight:600,fontSize:13}}>{form.nome||'Prévia'}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Equipe responsavel</label>
                <select className="form-select" value={form.equipe_responsavel_id} onChange={e=>setForm(f=>({...f,equipe_responsavel_id:e.target.value}))}>
                  <option value="">Nenhuma</option>
                  {equipes.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Observacoes</label>
                <textarea className="form-textarea" value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} style={{minHeight:60}}/>
              </div>

              {/* Icone ou foto */}
              <div className="tabs mb-3">
                <button type="button" className={`tab ${abaMedia==='emoji'?'active':''}`} onClick={()=>setAbaMedia('emoji')}>Emoji / Icone</button>
                <button type="button" className={`tab ${abaMedia==='foto'?'active':''}`} onClick={()=>setAbaMedia('foto')}>Foto do local</button>
              </div>
              {abaMedia==='emoji' ? (
                <EmojiPicker value={form.icone} onChange={v=>setForm(f=>({...f,icone:v}))} label="Escolher icone"/>
              ) : (
                <div style={{display:'flex',justifyContent:'center',marginBottom:14}}>
                  <UploadFoto bucket="locais" path={`local-${editando?.id??Date.now()}`} currentUrl={fotoUrl} onUpload={url=>setFotoUrl(url)} label="Enviar foto" size={120} shape="square"/>
                </div>
              )}

              {editando && (
                <button type="button" onClick={()=>excluir(editando.id)} style={{background:'var(--danger-bg)',color:'var(--danger)',border:'none',borderRadius:8,padding:'8px 14px',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',marginBottom:8,width:'100%'}}>
                  Excluir este local
                </button>
              )}
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Salvando...':editando?'Salvar':'Criar local'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
