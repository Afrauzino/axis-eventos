import { createPortal } from 'react-dom'

// Ampliar foto (clicar na foto de uma pessoa → tela cheia). Padrão do card (item 4).
export default function FotoAmpliada({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null
  return createPortal(
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20, cursor:'pointer' }}>
      <img src={url} alt="" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:12 }} />
      <button onClick={onClose} aria-label="Fechar"
        style={{ position:'absolute', top:20, right:20, background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:40, height:40, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontFamily:'inherit' }}>
        <span className="icon">close</span>
      </button>
    </div>,
    document.body,
  )
}
