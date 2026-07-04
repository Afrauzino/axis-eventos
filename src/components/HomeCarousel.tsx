import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import YouTubePlayer from './YouTubePlayer'
import { toast } from './Toast'

type Item = { id:string; tipo:string; url:string; ordem:number; duracao?:number }

const ehYoutube = (u:string) => /youtube\.com|youtu\.be/.test(u)
const ytId = (u:string) => { const m = u.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/); return m ? m[1] : '' }
const detectarTipo = (u:string) => (ehYoutube(u) || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(u)) ? 'video' : 'imagem'

export default function HomeCarousel({ admin }: { admin: boolean }) {
  const [itens, setItens] = useState<Item[]>([])
  const [idx, setIdx] = useState(0)
  const [carregado, setCarregado] = useState(false)
  const [erro, setErro] = useState(false)
  const [modal, setModal] = useState(false)
  const [link, setLink] = useState('')
  const [dur, setDur] = useState(5)
  const [subindo, setSubindo] = useState(false)
  const timer = useRef<any>(null)

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
    setItens(data ?? []); setCarregado(true)
    setIdx(i => (data && i >= data.length ? 0 : i))
  }

  async function enviarImagem(file: File) {
    setSubindo(true)
    const ext = file.name.split('.').pop()
    const path = `home/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('arquivos').upload(path, file, { upsert:true })
    if (!error) {
      const { data:u } = supabase.storage.from('arquivos').getPublicUrl(path)
      const tipo = file.type.startsWith('video') ? 'video' : 'imagem'
      await supabase.from('home_midias').insert({ tipo, url:u.publicUrl, ordem:itens.length, duracao:dur })
      await carregar()
    } else toast.falha('Não foi possível enviar. Tente de novo.', error)
    setSubindo(false); setModal(false)
  }
  async function adicionarLink() {
    const u = link.trim(); if (!u) return
    await supabase.from('home_midias').insert({ tipo:detectarTipo(u), url:u, ordem:itens.length, duracao:dur })
    setLink(''); setModal(false); await carregar()
  }
  async function remover(id: string) {
    if (!confirm('Remover esta mídia do carrossel?')) return
    await supabase.from('home_midias').delete().eq('id', id)
    await carregar()
  }

  if (!carregado) return null
  if (itens.length === 0) {
    if (!admin) return null
    return (
      <>
        {erro && (
          <div className="alert-box alert-warning mb-2" style={{fontSize:12}}>
            A tabela do carrossel não existe ainda. Rode <b>sql/18_home_carousel.sql</b> (e o <b>sql/20_home_duracao.sql</b>) no Supabase.
          </div>
        )}
        <button onClick={()=>setModal(true)} style={{width:'100%',border:'2px dashed var(--border)',background:'var(--bg)',borderRadius:14,padding:'18px',cursor:'pointer',fontFamily:'inherit',color:'var(--muted)',fontSize:13,fontWeight:600,marginBottom:16,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <span className="icon icon-sm">add_photo_alternate</span> Adicionar banner na Início
        </button>
        {modal && <ModalAdd {...{link,setLink,dur,setDur,subindo,enviarImagem,adicionarLink,fechar:()=>setModal(false)}}/>}
      </>
    )
  }

  const atual = itens[idx]
  return (
    <div style={{marginBottom:16}}>
      <div style={{position:'relative',width:'100%',aspectRatio:'16 / 7',borderRadius:14,overflow:'hidden',background:'#000',boxShadow:'var(--shadow-sm)'}}>
        {atual.tipo === 'video'
          ? (ehYoutube(atual.url)
              ? <YouTubePlayer key={atual.id} videoId={ytId(atual.url)} onEnded={proximo} loop={itens.length<=1}/>
              : <video key={atual.id} src={atual.url} autoPlay muted playsInline loop={itens.length<=1} onEnded={proximo} style={{width:'100%',height:'100%',objectFit:'cover'}}/>)
          : <img src={atual.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>}

        {admin && (
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
        {admin && (
          <button onClick={()=>setModal(true)} title="Adicionar" style={{marginLeft:6,width:22,height:22,borderRadius:'50%',border:'1px solid var(--border)',background:'white',cursor:'pointer',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span className="icon" style={{fontSize:15}}>add</span>
          </button>
        )}
      </div>

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
