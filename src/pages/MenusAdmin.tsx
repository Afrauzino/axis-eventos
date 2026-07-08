import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { useRegistrarChromeNav } from '../lib/chrome'
import EmojiGrid from '../components/EmojiGrid'
import type { Profile } from '../App'

type MenuItem = { id:string; key:string; label:string; icon:string; emoji?:string|null; rota:string|null; parent_id:string|null; ordem:number; visivel:boolean; roles:string[] }

function MatIcon({ name, size=20, color='var(--text2)' }: {name:string;size?:number;color?:string}) {
  return <span style={{fontFamily:"'Material Symbols Outlined'",fontWeight:'normal',fontStyle:'normal',fontSize:size,lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',direction:'ltr',WebkitFontSmoothing:'antialiased',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",color,userSelect:'none'}}>{name}</span>
}

export default function MenusAdmin({ profile }: { profile?: Profile }) {
  useRegistrarChromeNav('admin')
  const [menus, setMenus]       = useState<MenuItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [editando, setEditando] = useState<MenuItem|null>(null)
  useVoltarFecha(!!editando, () => setEditando(null))
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ label:'', emoji:'📋', icon:'circle', rota:'', visivel:true, roles:[] as string[] })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('menu_config').select('*').order('ordem')
    setMenus(data ?? [])
    setLoading(false)
  }

  function abrirEdicao(m: MenuItem) {
    setEditando(m)
    setForm({ label:m.label, emoji:m.emoji||'📋', icon:m.icon, rota:m.rota??'', visivel:m.visivel, roles:m.roles??[] })
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true)
    if (!editando) { setSalvando(false); return }
    await supabase.from('menu_config').update({
      label: form.label, emoji: form.emoji, icon: form.icon,
      rota: form.rota||null, visivel: form.visivel, roles: form.roles
    }).eq('id', editando.id)
    setSalvando(false); setEditando(null); carregar()
  }

  async function toggleVisivel(id: string, atual: boolean) {
    await supabase.from('menu_config').update({ visivel: !atual }).eq('id', id)
    carregar()
  }

  async function moverOrdem(id: string, dir: 'up'|'down') {
    const item = menus.find(m=>m.id===id)
    if (!item) return
    const siblings = menus.filter(m=>m.parent_id===item.parent_id).sort((a,b)=>a.ordem-b.ordem)
    const idx = siblings.findIndex(m=>m.id===id)
    const outro = dir==='up' ? siblings[idx-1] : siblings[idx+1]
    if (!outro) return
    await Promise.all([
      supabase.from('menu_config').update({ordem:outro.ordem}).eq('id',item.id),
      supabase.from('menu_config').update({ordem:item.ordem}).eq('id',outro.id),
    ])
    carregar()
  }

  const principais = menus.filter(m=>!m.parent_id).sort((a,b)=>a.ordem-b.ordem)
  function getFilhos(parentId: string) { return menus.filter(m=>m.parent_id===parentId).sort((a,b)=>a.ordem-b.ordem) }

  return (
    <div className="page">
      <div className="alert-box alert-info mb-3">
        Configure os menus do sistema. Alterações refletem imediatamente para todos os usuários. As rotas internas não podem ser alteradas.
      </div>

      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:60,marginBottom:8,borderRadius:14}}/>) :
      principais.map((item, pi) => (
        <div key={item.id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,overflow:'hidden'}}>
          {/* Item principal */}
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:item.visivel?'white':'var(--bg)'}}>
            <div style={{width:36,height:36,borderRadius:8,background:item.visivel?'var(--primary-light)':'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:20,lineHeight:1,opacity:item.visivel?1:0.5}}>
              {item.emoji || '📋'}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontWeight:700,fontSize:14,color:item.visivel?'var(--text)':'var(--muted)'}}>{item.label}</p>
              {item.rota && <p style={{fontSize:11,color:'var(--muted)'}}>{item.rota}</p>}
            </div>
            <div style={{display:'flex',gap:4,flexShrink:0}}>
              {pi>0 && <button onClick={()=>moverOrdem(item.id,'up')} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,width:26,height:26,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="arrow_upward" size={13}/></button>}
              {pi<principais.length-1 && <button onClick={()=>moverOrdem(item.id,'down')} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,width:26,height:26,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="arrow_downward" size={13}/></button>}
              <button onClick={()=>toggleVisivel(item.id,item.visivel)} style={{background:item.visivel?'var(--success-bg)':'var(--bg)',color:item.visivel?'var(--success)':'var(--muted)',border:'1px solid var(--border)',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'inherit'}}>
                {item.visivel?'Visível':'Oculto'}
              </button>
              <button onClick={()=>abrirEdicao(item)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'inherit'}}>Editar</button>
            </div>
          </div>
          {/* Filhos */}
          {getFilhos(item.id).map((filho, fi) => (
            <div key={filho.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px 8px 56px',borderTop:'1px solid var(--border)',background:filho.visivel?'var(--bg)':'#f9f9f9'}}>
              <span style={{fontSize:16,lineHeight:1,opacity:filho.visivel?1:0.5}}>{filho.emoji || '📋'}</span>
              <p style={{flex:1,fontSize:13,color:filho.visivel?'var(--text2)':'var(--muted-light)',fontWeight:filho.visivel?500:400}}>{filho.label}</p>
              {filho.rota && <p style={{fontSize:10,color:'var(--muted)'}}>{filho.rota}</p>}
              <div style={{display:'flex',gap:4}}>
                {fi>0 && <button onClick={()=>moverOrdem(filho.id,'up')} style={{background:'none',border:'1px solid var(--border)',borderRadius:5,width:22,height:22,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="arrow_upward" size={11}/></button>}
                {fi<getFilhos(item.id).length-1 && <button onClick={()=>moverOrdem(filho.id,'down')} style={{background:'none',border:'1px solid var(--border)',borderRadius:5,width:22,height:22,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="arrow_downward" size={11}/></button>}
                <button onClick={()=>toggleVisivel(filho.id,filho.visivel)} style={{background:filho.visivel?'var(--success-bg)':'var(--bg)',color:filho.visivel?'var(--success)':'var(--muted)',border:'1px solid var(--border)',borderRadius:5,padding:'2px 6px',cursor:'pointer',fontSize:10,fontWeight:600,fontFamily:'inherit'}}>
                  {filho.visivel?'Vis':'Oct'}
                </button>
                <button onClick={()=>abrirEdicao(filho)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:5,padding:'2px 6px',cursor:'pointer',fontSize:10,fontWeight:600,fontFamily:'inherit'}}>Edit</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Modal edição */}
      {editando && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setEditando(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>Editar: {editando.label}</span>
              <button onClick={()=>setEditando(null)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Nome exibido</label>
                <input className="form-input" value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))} required/>
              </div>
              <div className="form-group"><label className="form-label">Emoji do menu</label>
                <EmojiGrid value={form.emoji} onChange={em=>setForm(f=>({...f,emoji:em}))}/>
              </div>
              <p className="form-hint mb-3">As permissões (quem vê) são definidas em <b>Usuários</b> e <b>Equipes</b>. Aqui é só o visual: emoji, nome, ordem e visibilidade geral.</p>
              <div className="form-group">
                <label className="form-label">Visível</label>
                <button type="button" onClick={()=>setForm(f=>({...f,visivel:!f.visivel}))} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',width:'100%',border:`2px solid ${form.visivel?'var(--success)':'var(--border)'}`,background:form.visivel?'var(--success-bg)':'white'}}>
                  <div style={{width:22,height:22,borderRadius:5,background:form.visivel?'var(--success)':'var(--bg)',border:`2px solid ${form.visivel?'var(--success)':'var(--border)'}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {form.visivel && <MatIcon name="check" size={14} color="white"/>}
                  </div>
                  <span style={{fontWeight:600,fontSize:14,color:form.visivel?'var(--success)':'var(--text2)'}}>{form.visivel?'Menu visível':'Menu oculto'}</span>
                </button>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Salvando...':'Salvar alterações'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
