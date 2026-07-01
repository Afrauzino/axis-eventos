import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import SubTabs from '../components/SubTabs'
import { getInitials, isAdmin } from '../utils'
import UploadFoto from '../components/UploadFoto'
import EmojiGrid from '../components/EmojiGrid'
import type { Profile } from '../App'

type Personagem = { id:string; nome:string; descricao:string|null; icone:string|null; multiplo:boolean }
type Elenco     = { person_id:string; theater_id:string; pessoas:{name:string;photo_url:string|null} }

function MatIcon({ name, size=20, color='var(--text2)' }: { name:string; size?:number; color?:string }) {
  return <span style={{fontFamily:"'Material Symbols Outlined'",fontWeight:'normal',fontStyle:'normal',fontSize:size,lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',direction:'ltr',WebkitFontSmoothing:'antialiased',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",color,userSelect:'none'}}>{name}</span>
}

export default function TeatroPersonagens({ profile }: { profile?: Profile }) {
  const [lista, setLista]       = useState<Personagem[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState<Personagem|null>(null)
  const [salvando, setSalvando] = useState(false)
  const [buscar, setBuscar]     = useState('')
  const [form, setForm]         = useState({ nome:'', descricao:'', icone:'', multiplo:false })
  const [fotoUrl, setFotoUrl]   = useState<string|null>(null)
  const [abaMedia, setAbaMedia] = useState<'emoji'|'foto'>('emoji')

  const canEdit = profile && isAdmin(profile.user_role)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('personagens_globais').select('*').order('nome')
    setLista(data ?? [])
    setLoading(false)
  }

  function abrirNovo() {
    setEditando(null); setForm({nome:'',descricao:'',icone:'',multiplo:false}); setFotoUrl(null); setAbaMedia('emoji'); setModal(true)
  }

  function abrirEdicao(p: Personagem) {
    setEditando(p)
    setForm({nome:p.nome, descricao:p.descricao??'', icone:p.icone&&!p.icone.startsWith('http')?p.icone:'', multiplo:p.multiplo??false})
    setFotoUrl(p.icone?.startsWith('http')?p.icone:null)
    setAbaMedia(p.icone?.startsWith('http')?'foto':'emoji')
    setModal(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true)
    if (!form.nome.trim()) { setSalvando(false); return }
    const iconeFinal = fotoUrl ?? (form.icone || null)
    const payload = { nome:form.nome, descricao:form.descricao||null, icone:iconeFinal, multiplo:form.multiplo }
    if (editando) await supabase.from('personagens_globais').update(payload).eq('id',editando.id)
    else await supabase.from('personagens_globais').insert(payload)
    setModal(false); setSalvando(false); setEditando(null); carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir personagem? Será removido de todas as cenas e elencos de teatros.')) return
    // Remove from teatro_cenas
    await supabase.from('teatro_cenas').update({ personagem_id: null }).eq('personagem_id', id)
    // Remove from teatro_elenco
    await supabase.from('teatro_elenco').delete().eq('personagem_id', id)
    // Now delete the personagem
    await supabase.from('personagens_globais').delete().eq('id', id)
    carregar()
  }

  const filtrados = lista.filter(p=>!buscar||p.nome.toLowerCase().includes(buscar.toLowerCase()))
  const unicos    = filtrados.filter(p=>!p.multiplo)
  const multiplos = filtrados.filter(p=>p.multiplo)

  function renderIcone(p: Personagem) {
    if (p.icone?.startsWith('http')) return <img src={p.icone} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
    // emoji colorido; nome de ícone antigo (ex: "person") vira o emoji padrão
    if (p.icone && !/^[a-z0-9_]+$/.test(p.icone)) return <span style={{fontSize:27,lineHeight:1}}>{p.icone}</span>
    return <span style={{fontSize:27,lineHeight:1}}>🎭</span>
  }

  function PersonCard({ p }: { p: Personagem }) {
    const cor = '#6B46C1'
    return (
      <div style={{background:'white',borderRadius:12,boxShadow:'0 1px 5px rgba(0,0,0,0.12)',marginBottom:10,overflow:'hidden',display:'flex'}}>
        <div style={{width:6,alignSelf:'stretch',background:cor,flexShrink:0}}/>
        <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:14,padding:'16px 15px'}}>
          <div style={{width:58,height:58,borderRadius:'50%',background:cor+'24',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
            {renderIcone(p)}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <p style={{fontWeight:700,fontSize:15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nome}</p>
              {p.multiplo && <span className="badge badge-info" style={{fontSize:9}}>múltiplo</span>}
            </div>
            {p.descricao && <p style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{p.descricao}</p>}
          </div>
          {canEdit && (
            <div style={{display:'flex',gap:8,flexShrink:0}}>
              <button onClick={()=>abrirEdicao(p)} aria-label="Editar" style={{width:34,height:34,borderRadius:8,background:'var(--bg)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)',fontFamily:'inherit'}}><MatIcon name="edit" size={18}/></button>
              <button onClick={()=>excluir(p.id)} aria-label="Excluir" style={{width:34,height:34,borderRadius:8,background:'var(--danger-bg)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="delete" size={18} color="var(--danger)"/></button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <SubTabs group="teatro"/>
      <div className="alert-box alert-info mb-3">Biblioteca global — disponíveis para todos os teatros. Personagens múltiplos permitem vários atores simultâneos (ex: Demônios, Multidão).</div>

      <div className="search-bar mb-3">
        <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
        <input placeholder="Buscar personagem..." value={buscar} onChange={e=>setBuscar(e.target.value)}/>
      </div>

      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:60,marginBottom:8,borderRadius:14}}/>) : (
        <>
          {unicos.length > 0 && (
            <>
              <div className="section-label mb-2">Personagens únicos</div>
              {unicos.map(p=><PersonCard key={p.id} p={p}/>)}
            </>
          )}
          {multiplos.length > 0 && (
            <>
              <div className="section-label mb-2" style={{marginTop:12}}>Personagens múltiplos</div>
              {multiplos.map(p=><PersonCard key={p.id} p={p}/>)}
            </>
          )}
          {filtrados.length === 0 && (
            <div className="empty">
              <div className="empty-icon"><MatIcon name="theater_comedy" size={28} color="var(--muted-light)"/></div>
              <p className="empty-title">Nenhum personagem</p>
            </div>
          )}
        </>
      )}

      {canEdit && <button className="fab" onClick={abrirNovo}><span className="icon">add</span></button>}

      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?'Editar personagem':'Novo personagem'}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Nome <span className="req">*</span></label>
                <input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} required/>
              </div>
              <div className="form-group"><label className="form-label">Descrição</label>
                <textarea className="form-textarea" value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} style={{minHeight:60}}/>
              </div>

              {/* Tipo: único ou múltiplo */}
              <div className="form-group">
                <label className="form-label">Tipo de personagem</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:4}}>
                  <button type="button" onClick={()=>setForm(f=>({...f,multiplo:false}))} style={{padding:'10px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:600,border:`2px solid ${!form.multiplo?'var(--primary)':'var(--border)'}`,background:!form.multiplo?'var(--primary-light)':'white',color:!form.multiplo?'var(--primary-dark)':'var(--text2)'}}>
                    Único<br/><span style={{fontSize:11,fontWeight:400}}>Ex: Jesus, Maria</span>
                  </button>
                  <button type="button" onClick={()=>setForm(f=>({...f,multiplo:true}))} style={{padding:'10px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:600,border:`2px solid ${form.multiplo?'var(--info)':'var(--border)'}`,background:form.multiplo?'#EBF8FF':'white',color:form.multiplo?'#2B6CB0':'var(--text2)'}}>
                    Múltiplo<br/><span style={{fontSize:11,fontWeight:400}}>Ex: Demônios, Multidão</span>
                  </button>
                </div>
              </div>

              <div className="tabs mb-3">
                <button type="button" className={`tab ${abaMedia==='emoji'?'active':''}`} onClick={()=>setAbaMedia('emoji')}>Ícone</button>
                <button type="button" className={`tab ${abaMedia==='foto'?'active':''}`} onClick={()=>setAbaMedia('foto')}>Foto</button>
              </div>
              {abaMedia==='emoji'
                ? <div className="form-group">
                    <label className="form-label">Escolher emoji</label>
                    <EmojiGrid value={form.icone} onChange={em=>{setForm(f=>({...f,icone:em}));setFotoUrl('')}}/>
                  </div>
                : <div style={{display:'flex',justifyContent:'center',marginBottom:14}}><UploadFoto bucket="personagens" path={`personagem-${Date.now()}`} currentUrl={fotoUrl} onUpload={url=>{setFotoUrl(url);setForm(f=>({...f,icone:''}))}} label="Enviar foto" size={90} shape="square"/></div>
              }
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Salvando...':editando?'Salvar':'Criar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
