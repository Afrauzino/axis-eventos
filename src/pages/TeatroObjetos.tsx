import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import SubTabs from '../components/SubTabs'
import { isAdmin } from '../utils'
import UploadFoto from '../components/UploadFoto'
import EmojiGrid from '../components/EmojiGrid'
import type { Profile } from '../App'

function MatIcon({ name, size=22, color='var(--accent)' }: {name:string;size?:number;color?:string}) {
  return <span style={{fontFamily:"'Material Symbols Outlined'",fontWeight:'normal',fontStyle:'normal',fontSize:size,lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',direction:'ltr',WebkitFontSmoothing:'antialiased',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",color,userSelect:'none'}}>{name}</span>
}

type Objeto = { id:string; nome:string; descricao:string|null; icone:string|null; imagem_url:string|null }

export default function TeatroObjetos({ profile }: { profile?: Profile }) {
  const [lista, setLista]       = useState<Objeto[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState<Objeto|null>(null)
  const [salvando, setSalvando] = useState(false)
  const [buscar, setBuscar]     = useState('')
  const [form, setForm]         = useState({ nome:'', descricao:'', icone:'' })
  const [fotoUrl, setFotoUrl]   = useState<string|null>(null)
  const [abaMedia, setAbaMedia] = useState<'emoji'|'foto'>('emoji')

  const canEdit = profile && isAdmin(profile.user_role)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('objetos_globais').select('*').order('nome')
    setLista(data ?? [])
    setLoading(false)
  }

  function abrirNovo() {
    setEditando(null); setForm({nome:'',descricao:'',icone:''}); setFotoUrl(null); setAbaMedia('emoji'); setModal(true)
  }

  function abrirEdicao(o: Objeto) {
    setEditando(o)
    const icone = o.icone && !o.icone.startsWith('http') ? o.icone : ''
    const foto  = o.imagem_url ?? (o.icone?.startsWith('http') ? o.icone : null)
    setForm({nome:o.nome,descricao:o.descricao??'',icone})
    setFotoUrl(foto)
    setAbaMedia(foto ? 'foto' : 'emoji')
    setModal(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true)
    const mediaFinal = fotoUrl || (form.icone.startsWith('http') ? form.icone : null)
    const payload = { nome:form.nome, descricao:form.descricao||null, icone:!fotoUrl&&form.icone?form.icone:null, imagem_url:fotoUrl||null }
    if (editando) await supabase.from('objetos_globais').update(payload).eq('id',editando.id)
    else await supabase.from('objetos_globais').insert(payload)
    setModal(false); setSalvando(false); setEditando(null); carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir objeto?')) return
    await supabase.from('objetos_globais').delete().eq('id',id)
    carregar()
  }

  const filtrados = lista.filter(o=>!buscar||o.nome.toLowerCase().includes(buscar.toLowerCase()))

  function renderMedia(o: Objeto) {
    const foto = o.imagem_url ?? (o.icone?.startsWith('http') ? o.icone : null)
    if (foto) return <img src={foto} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
    // emoji colorido; nome de ícone antigo (ex: "inventory_2") vira o emoji padrão
    if (o.icone && !/^[a-z0-9_]+$/.test(o.icone)) return <span style={{fontSize:27,lineHeight:1}}>{o.icone}</span>
    return <span style={{fontSize:27,lineHeight:1}}>📦</span>
  }

  return (
    <div className="page">
      <SubTabs group="teatro"/>
      <div className="alert-box alert-info mb-3">Biblioteca global — disponiveis para todos os teatros.</div>
      <div className="search-bar mb-3">
        <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
        <input placeholder="Buscar objeto..." value={buscar} onChange={e=>setBuscar(e.target.value)}/>
      </div>
      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:60,marginBottom:8,borderRadius:14}}/>) :
      filtrados.map(o => {
        return (
        <div key={o.id} style={{background:'white',borderRadius:12,boxShadow:'0 1px 5px rgba(0,0,0,0.12)',marginBottom:10,overflow:'hidden',display:'flex'}}>
          <div style={{width:6,alignSelf:'stretch',background:'var(--primary)',flexShrink:0}}/>
          <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:14,padding:'16px 15px'}}>
            <div style={{width:58,height:58,borderRadius:'50%',background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
              {renderMedia(o)}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontWeight:700,fontSize:15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{o.nome}</p>
              {o.descricao && <p style={{fontSize:12,color:'var(--muted)'}}>{o.descricao}</p>}
            </div>
            {canEdit && (
              <div style={{display:'flex',gap:8,flexShrink:0}}>
                <button onClick={()=>abrirEdicao(o)} aria-label="Editar" style={{width:34,height:34,borderRadius:8,background:'var(--bg)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)',fontFamily:'inherit'}}><MatIcon name="edit" size={18}/></button>
                <button onClick={()=>excluir(o.id)} aria-label="Excluir" style={{width:34,height:34,borderRadius:8,background:'var(--danger-bg)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="delete" size={18} color="var(--danger)"/></button>
              </div>
            )}
          </div>
        </div>
        )
      })}

      {canEdit && <button className="fab" onClick={abrirNovo}><span className="icon">add</span></button>}

      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0 16px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?'Editar objeto':'Novo objeto'}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Nome <span className="req">*</span></label>
                <input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} required/>
              </div>
              <div className="form-group"><label className="form-label">Descricao</label>
                <textarea className="form-textarea" value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} style={{minHeight:60}}/>
              </div>
              <div className="tabs mb-3">
                <button type="button" className={`tab ${abaMedia==='emoji'?'active':''}`} onClick={()=>setAbaMedia('emoji')}>Emoji / Icone</button>
                <button type="button" className={`tab ${abaMedia==='foto'?'active':''}`} onClick={()=>setAbaMedia('foto')}>Foto</button>
              </div>
              {abaMedia==='emoji' ? (
                <div className="form-group">
                  <label className="form-label">Escolher emoji</label>
                  <EmojiGrid value={form.icone} onChange={em=>{setForm(f=>({...f,icone:em}));setFotoUrl('')}}/>
                </div>
              ) : (
                <div style={{display:'flex',justifyContent:'center',marginBottom:14}}>
                  <UploadFoto bucket="objetos" path={`objeto-${Date.now()}`} currentUrl={fotoUrl} onUpload={url=>{setFotoUrl(url);setForm(f=>({...f,icone:''}))}} label="Enviar foto" size={90} shape="square"/>
                </div>
              )}
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
