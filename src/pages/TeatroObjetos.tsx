import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isAdmin } from '../utils'
import UploadFoto from '../components/UploadFoto'
import EmojiGrid from '../components/EmojiGrid'
import CardItem from '../components/CardItem'
import { useRegistrarChromeNav } from '../lib/chrome'
import { usePermissao } from '../hooks/usePermissao'
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

  const { pode } = usePermissao(profile ?? null)
  const canEdit = (!!profile && isAdmin(profile.user_role)) || pode('teatro','editar')

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

  useRegistrarChromeNav('teatro', {
    busca: { value: buscar, onChange: setBuscar, placeholder: 'Buscar objeto...' },
  }, [buscar])

  return (
    <div className="page">
      <div className="alert-box alert-info mb-3">Biblioteca global — disponiveis para todos os teatros.</div>
      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:60,marginBottom:8,borderRadius:14}}/>) :
      filtrados.map(o => {
        const foto = o.imagem_url ?? (o.icone?.startsWith('http') ? o.icone : null)
        const emoji = (!foto && o.icone && !/^[a-z0-9_]+$/.test(o.icone)) ? o.icone : (foto ? undefined : '📦')
        return (
          <CardItem
            key={o.id}
            cor="var(--primary)"
            emoji={emoji}
            fotoUrl={foto}
            titulo={o.nome}
            subtitulo={o.descricao || undefined}
            onVer={canEdit ? ()=>abrirEdicao(o) : undefined}
            onEditar={canEdit ? ()=>abrirEdicao(o) : undefined}
          />
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
              {editando && (
                <button type="button" className="btn btn-ghost btn-full" style={{marginTop:8,color:'var(--danger)'}}
                  onClick={()=>{const id=editando.id;setModal(false);excluir(id)}}>
                  <span className="icon icon-sm">delete</span> Excluir objeto
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
