import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { urlOriginal, imagemCarrega, baixarImagem } from '../lib/foto'

// Ampliar foto (clicar na foto de uma pessoa → tela cheia). Padrão do card (item 4).
// Mostra a foto ORIGINAL inteira (não o recorte) quando ela existir, e deixa baixá-la.
export default function FotoAmpliada({ url, onClose }: { url: string | null; onClose: () => void }) {
  useVoltarFecha(!!url, onClose)  // voltar do celular fecha a foto ampliada
  const [mostrar, setMostrar] = useState<string | null>(url)
  const [temOriginal, setTemOriginal] = useState(false)
  const [baixando, setBaixando] = useState(false)

  useEffect(() => {
    let ativo = true
    setMostrar(url); setTemOriginal(false)
    if (url) {
      const orig = urlOriginal(url)
      if (orig !== url) imagemCarrega(orig).then(ok => { if (ativo && ok) { setMostrar(orig); setTemOriginal(true) } })
    }
    return () => { ativo = false }
  }, [url])

  if (!url) return null

  async function baixar(e: React.MouseEvent) {
    e.stopPropagation()
    setBaixando(true)
    await baixarImagem(mostrar || url!, 'foto-original.jpg')
    setBaixando(false)
  }

  return createPortal(
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20, cursor:'pointer' }}>
      <img src={mostrar || url} alt="" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:12 }} />
      <button onClick={onClose} aria-label="Fechar"
        style={{ position:'absolute', top:20, right:20, background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:40, height:40, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontFamily:'inherit' }}>
        <span className="icon">close</span>
      </button>
      <button onClick={baixar} disabled={baixando}
        style={{ position:'absolute', bottom:24, left:'50%', transform:'translateX(-50%)', background:'rgba(255,255,255,0.16)', border:'1px solid rgba(255,255,255,0.4)', borderRadius:99, padding:'10px 18px', cursor:'pointer', display:'flex', alignItems:'center', gap:8, color:'white', fontFamily:'inherit', fontSize:14, fontWeight:700 }}>
        <span className="icon icon-sm" style={{ color:'white' }}>download</span>
        {baixando ? 'Baixando...' : (temOriginal ? 'Baixar original' : 'Baixar foto')}
      </button>
    </div>,
    document.body,
  )
}
