import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import YouTubePlayer from './YouTubePlayer'
import { toast } from './Toast'
import { useEvento } from '../hooks/useEvento'
import { notificarRegra } from '../lib/notifRegras'
import type { Profile } from '../App'

type Item = { id:string; tipo:string; url:string; ordem:number; duracao?:number; autor_user_id?:string|null }
type Curtida = { midia_id:string; user_id:string }
type Coment  = { id:string; midia_id:string; autor_nome:string|null; autor_foto:string|null; texto:string; created_at:string }

const ehYoutube = (u:string) => /youtube\.com|youtu\.be/.test(u)
const ytId = (u:string) => { const m = u.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/); return m ? m[1] : '' }
const detectarTipo = (u:string) => (ehYoutube(u) || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(u)) ? 'video' : 'imagem'

export default function HomeCarousel({ admin, grupo='principal', podeEditar, titulo, instagram=false, profile }: { admin: boolean; grupo?: string; podeEditar?: boolean; titulo?: string; instagram?: boolean; profile?: Profile }) {
  // Quem pode postar/remover: por padrão o admin; no carrossel de fotos, quem tem a liberação.
  const podeMexer = podeEditar ?? admin
  const { evento } = useEvento()
  const [itens, setItens] = useState<Item[]>([])
  const [idx, setIdx] = useState(0)
  const [carregado, setCarregado] = useState(false)
  const [erro, setErro] = useState(false)
  const [modal, setModal] = useState(false)
  const [link, setLink] = useState('')
  const [dur, setDur] = useState(5)
  const [subindo, setSubindo] = useState(false)
  const timer = useRef<any>(null)
  // Instagram: curtidas + comentários por foto
  const [curtidas, setCurtidas] = useState<Curtida[]>([])
  const [coments, setComents] = useState<Coment[]>([])
  const [novoComent, setNovoComent] = useState('')
  const [verComents, setVerComents] = useState(false)

  const proximo = () => setIdx(i => (itens.length ? (i + 1) % itens.length : 0))

  useEffect(() => { carregar() }, [])

  // #17 — Auto-avanço: IMAGEM por tempo (duração); VÍDEO (arquivo ou YouTube) avança quando termina.
  useEffect(() => {
    clearTimeout(timer.current)
    const it = itens[idx]
    if (!it || itens.length <= 1) return
    if (it.tipo === 'video') return // vídeos avançam no fim (onEnded / YouTubePlayer)
    const ms = Math.max(2, it.duracao || 5) * 1000
    timer.current = setTimeout(proximo, ms)
    return () => clearTimeout(timer.current)
  }, [itens, idx])

  async function carregar() {
    const { data, error } = await supabase.from('home_midias').select('*').order('ordem')
    setErro(!!error)
    // Separa os carrosséis por grupo (linhas antigas sem grupo = 'principal')
    const arr = (data ?? []).filter((d:any)=> (d.grupo ?? 'principal') === grupo)
    setItens(arr); setCarregado(true)
    setIdx(i => (i >= arr.length ? 0 : i))
    // Instagram: carrega curtidas e comentários das fotos
    if (instagram && arr.length) {
      const ids = arr.map(a => a.id)
      const [cu, co] = await Promise.all([
        supabase.from('home_midias_curtidas').select('midia_id,user_id').in('midia_id', ids),
        supabase.from('home_midias_comentarios').select('*').in('midia_id', ids).order('created_at'),
      ])
      setCurtidas((cu.data as Curtida[]) ?? [])
      setComents((co.data as Coment[]) ?? [])
    }
  }

  async function toggleCurtir(midiaId: string) {
    if (!profile) return
    const ja = curtidas.some(c => c.midia_id === midiaId && c.user_id === profile.user_id)
    if (ja) {
      setCurtidas(prev => prev.filter(c => !(c.midia_id === midiaId && c.user_id === profile.user_id)))
      await supabase.from('home_midias_curtidas').delete().eq('midia_id', midiaId).eq('user_id', profile.user_id)
    } else {
      setCurtidas(prev => [...prev, { midia_id: midiaId, user_id: profile.user_id }])
      const { error } = await supabase.from('home_midias_curtidas').insert({ midia_id: midiaId, user_id: profile.user_id })
      if (error) toast.falha('Não foi possível curtir. Rode o SQL 47_carrossel_interacoes.sql.', error)
      else { const dono = itens.find(i => i.id === midiaId)?.autor_user_id; if (dono) notificarRegra('foto_curtida', { user_ids: [dono], title: `${profile.full_name ?? 'Alguém'} curtiu sua foto`, body: '', url: '/' }) }
    }
  }
  async function enviarComentario(midiaId: string) {
    const t = novoComent.trim(); if (!t || !profile) return
    const { error } = await supabase.from('home_midias_comentarios').insert({
      midia_id: midiaId, user_id: profile.user_id,
      autor_nome: profile.full_name, autor_foto: profile.avatar_url, texto: t.slice(0, 300),
    })
    if (error) { toast.falha('Não foi possível comentar. Rode o SQL 47_carrossel_interacoes.sql.', error); return }
    { const dono = itens.find(i => i.id === midiaId)?.autor_user_id; if (dono) notificarRegra('foto_comentario', { user_ids: [dono], title: `${profile.full_name ?? 'Alguém'} comentou sua foto`, body: t.slice(0, 80), url: '/' }) }
    setNovoComent(''); carregar()
  }

  async function enviarImagem(file: File) {
    setSubindo(true)
    const ext = file.name.split('.').pop()
    const path = `home/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('arquivos').upload(path, file, { upsert:true })
    if (!error) {
      const { data:u } = supabase.storage.from('arquivos').getPublicUrl(path)
      const tipo = file.type.startsWith('video') ? 'video' : 'imagem'
      await supabase.from('home_midias').insert({ tipo, url:u.publicUrl, ordem:itens.length, duracao:dur, grupo, autor_user_id: profile?.user_id ?? null })
      if (evento?.id && grupo === 'fotos') notificarRegra('foto_nova', { alerta: { event_id: evento.id, target_type: 'all' }, title: 'Foto nova no mural', body: 'Tem foto nova no carrossel. Dá uma olhada!', url: '/' })
      await carregar()
    } else toast.falha('Não foi possível enviar. Tente de novo.', error)
    setSubindo(false); setModal(false)
  }
  async function adicionarLink() {
    const u = link.trim(); if (!u) return
    await supabase.from('home_midias').insert({ tipo:detectarTipo(u), url:u, ordem:itens.length, duracao:dur, grupo, autor_user_id: profile?.user_id ?? null })
    setLink(''); setModal(false); await carregar()
  }
  async function remover(id: string) {
    if (!confirm('Remover esta mídia do carrossel?')) return
    await supabase.from('home_midias').delete().eq('id', id)
    await carregar()
  }

  if (!carregado) return null
  if (itens.length === 0) {
    if (!podeMexer) return null
    return (
      <>
        {erro && (
          <div className="alert-box alert-warning mb-2" style={{fontSize:12}}>
            A tabela do carrossel não existe ainda. Rode <b>sql/18_home_carousel.sql</b>, <b>sql/20_home_duracao.sql</b> e <b>sql/46_carrossel_fotos.sql</b> no Supabase.
          </div>
        )}
        {titulo && <p style={{fontSize:12,fontWeight:800,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>{titulo}</p>}
        <button onClick={()=>setModal(true)} style={{width:'100%',border:'2px dashed var(--border)',background:'var(--bg)',borderRadius:14,padding:'18px',cursor:'pointer',fontFamily:'inherit',color:'var(--muted)',fontSize:13,fontWeight:600,marginBottom:16,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <span className="icon icon-sm">add_photo_alternate</span> {titulo ? `Adicionar em ${titulo}` : 'Adicionar banner na Início'}
        </button>
        {modal && <ModalAdd {...{link,setLink,dur,setDur,subindo,enviarImagem,adicionarLink,fechar:()=>setModal(false)}}/>}
      </>
    )
  }

  const atual = itens[idx]
  return (
    <div style={{marginBottom:16}}>
      {titulo && <p style={{fontSize:12,fontWeight:800,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>{titulo}</p>}
      <div style={{position:'relative',width:'100%',aspectRatio: instagram ? '1 / 1' : '16 / 7',borderRadius:14,overflow:'hidden',background:'#000',boxShadow:'var(--shadow-sm)'}}>
        {atual.tipo === 'video'
          ? (ehYoutube(atual.url)
              ? <YouTubePlayer key={atual.id} videoId={ytId(atual.url)} onEnded={proximo} loop={itens.length<=1}/>
              : <video key={atual.id} src={atual.url} autoPlay muted playsInline loop={itens.length<=1} onEnded={proximo} style={{width:'100%',height:'100%',objectFit:'cover'}}/>)
          : <img src={atual.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>}

        {podeMexer && (
          <button onClick={()=>remover(atual.id)} title="Remover" style={{position:'absolute',top:8,right:8,width:30,height:30,borderRadius:'50%',background:'rgba(0,0,0,0.55)',border:'none',cursor:'pointer',color:'white',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span className="icon icon-sm">close</span>
          </button>
        )}
      </div>

      {/* Bolinhas + botão adicionar (admin) */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:8}}>
        {itens.map((it,i)=>(
          <button key={it.id} onClick={()=>setIdx(i)} aria-label={`slide ${i+1}`}
            style={{width:i===idx?18:7,height:7,borderRadius:99,border:'none',cursor:'pointer',background:i===idx?'var(--primary)':'var(--border)',transition:'all 0.2s',padding:0}}/>
        ))}
        {podeMexer && (
          <button onClick={()=>setModal(true)} title="Adicionar" style={{marginLeft:6,width:22,height:22,borderRadius:'50%',border:'1px solid var(--border)',background:'white',cursor:'pointer',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span className="icon" style={{fontSize:15}}>add</span>
          </button>
        )}
      </div>

      {/* Instagram: curtir + comentar na foto atual */}
      {instagram && (() => {
        const euCurti = !!profile && curtidas.some(c => c.midia_id===atual.id && c.user_id===profile.user_id)
        const totalCurt = curtidas.filter(c => c.midia_id===atual.id).length
        const comentsFoto = coments.filter(c => c.midia_id===atual.id)
        return (
          <div style={{marginTop:4}}>
            {/* Ações (estilo Instagram) */}
            <div style={{display:'flex',alignItems:'center',gap:14,padding:'6px 4px 2px'}}>
              <button onClick={()=>toggleCurtir(atual.id)} disabled={!profile} title="Curtir" aria-label="Curtir"
                style={{background:'none',border:'none',cursor:profile?'pointer':'default',display:'flex',alignItems:'center',fontFamily:'inherit',padding:2}}>
                <span className="icon" style={{fontSize:28,lineHeight:1,color:euCurti?'#ED4956':'var(--text)',transition:'transform .18s ease, color .18s ease',transform:euCurti?'scale(1.12)':'scale(1)'}}>{euCurti?'favorite':'favorite_border'}</span>
              </button>
              <button onClick={()=>setVerComents(v=>!v)} title="Comentários" aria-label="Comentários"
                style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',fontFamily:'inherit',padding:2,color:'var(--text)'}}>
                <span className="icon" style={{fontSize:25,lineHeight:1}}>chat_bubble_outline</span>
              </button>
            </div>

            {/* Curtidas */}
            {totalCurt>0 && <p style={{fontSize:13,fontWeight:700,padding:'0 6px 2px'}}>{totalCurt} curtida{totalCurt>1?'s':''}</p>}

            {/* Teaser: quantos comentários (fecha) */}
            {!verComents && comentsFoto.length>0 && (
              <button onClick={()=>setVerComents(true)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',fontSize:13,fontFamily:'inherit',padding:'0 6px 4px'}}>
                Ver {comentsFoto.length===1?'o comentário':`os ${comentsFoto.length} comentários`}
              </button>
            )}

            {verComents && (
              <div style={{padding:'2px 6px 0'}}>
                {comentsFoto.length===0
                  ? <p style={{fontSize:13,color:'var(--muted)',marginBottom:profile?10:0}}>Sem comentários ainda. Seja o primeiro!</p>
                  : comentsFoto.map(c => (
                      <div key={c.id} style={{display:'flex',gap:9,alignItems:'flex-start',marginBottom:10}}>
                        {c.autor_foto
                          ? <img src={c.autor_foto} alt="" style={{width:30,height:30,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
                          : <div style={{width:30,height:30,borderRadius:'50%',background:'var(--primary-light)',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,flexShrink:0}}>{(c.autor_nome||'?').charAt(0)}</div>}
                        <div style={{flex:1,minWidth:0,lineHeight:1.4}}>
                          <span style={{fontSize:13,fontWeight:700}}>{(c.autor_nome||'Alguém').split(' ')[0]}</span>{' '}
                          <span style={{fontSize:13,color:'var(--text)'}}>{c.texto}</span>
                        </div>
                      </div>
                    ))}
                {profile && (
                  <div style={{display:'flex',gap:8,alignItems:'center',marginTop:4,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                    {profile.avatar_url
                      ? <img src={profile.avatar_url} alt="" style={{width:30,height:30,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
                      : <div style={{width:30,height:30,borderRadius:'50%',background:'var(--primary-light)',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,flexShrink:0}}>{(profile.full_name||'?').charAt(0)}</div>}
                    <input value={novoComent} onChange={e=>setNovoComent(e.target.value.slice(0,300))} placeholder="Adicione um comentário..."
                      onKeyDown={e=>{ if(e.key==='Enter') enviarComentario(atual.id) }}
                      style={{flex:1,border:'none',background:'none',padding:'7px 4px',fontFamily:'inherit',fontSize:13.5,outline:'none'}}/>
                    <button onClick={()=>enviarComentario(atual.id)} disabled={!novoComent.trim()}
                      style={{background:'none',border:'none',cursor:novoComent.trim()?'pointer':'default',color:novoComent.trim()?'var(--primary)':'var(--muted-light)',fontFamily:'inherit',fontWeight:700,fontSize:14,padding:'0 4px'}}>Publicar</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {modal && <ModalAdd {...{link,setLink,dur,setDur,subindo,enviarImagem,adicionarLink,fechar:()=>setModal(false)}}/>}
    </div>
  )
}

function ModalAdd({ link, setLink, dur, setDur, subindo, enviarImagem, adicionarLink, fechar }:{
  link:string; setLink:(v:string)=>void; dur:number; setDur:(v:number)=>void; subindo:boolean;
  enviarImagem:(f:File)=>void; adicionarLink:()=>void; fechar:()=>void
}) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&fechar()}>
      <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 22px 28px',width:'100%',maxWidth:480,margin:'0 auto'}}>
        <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 16px'}}/>
        <p style={{fontSize:16,fontWeight:800,marginBottom:14}}>Adicionar ao carrossel</p>

        <div className="form-group">
          <label className="form-label">Segundos na tela (só imagens)</label>
          <input className="form-input" type="number" min={2} max={120} value={dur} onChange={e=>setDur(Math.max(2, Number(e.target.value)||5))}/>
          <p className="form-hint mt-1">Vídeos (arquivo ou YouTube) avançam sozinhos quando terminam.</p>
        </div>

        <label className="btn btn-outline btn-full mb-3" style={{cursor:'pointer'}}>
          <span className="icon icon-sm">upload</span> {subindo?'Enviando...':'Enviar imagem ou vídeo (arquivo)'}
          <input type="file" accept="image/*,video/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0]; if(f) enviarImagem(f); e.target.value=''}}/>
        </label>
        <p style={{fontSize:12,color:'var(--muted)',margin:'6px 0 8px'}}>Ou cole um link de imagem ou vídeo (YouTube também):</p>
        <input className="form-input" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://..." style={{marginBottom:12}}/>
        <button className="btn btn-primary btn-full" onClick={adicionarLink} disabled={!link.trim()}>Adicionar link</button>
        <button className="btn btn-ghost btn-full" onClick={fechar} style={{marginTop:8}}>Cancelar</button>
      </div>
    </div>
  )
}
