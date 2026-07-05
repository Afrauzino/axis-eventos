import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Ajustar/reposicionar foto: arrastar para posicionar + controle de zoom.
// Recorta num quadrado e devolve um Blob (JPEG) pronto pra enviar.
type Props = {
  src: string                 // URL da imagem (objeto local ou remota)
  crossOrigin?: boolean       // true quando carrega uma foto já enviada (remota)
  onCancel: () => void
  onConfirm: (blob: Blob) => void
  saida?: number              // tamanho de saída em px (padrão 400)
}

const V = 280 // tamanho do visor (px)

export default function RecortarFoto({ src, crossOrigin, onCancel, onConfirm, saida = 400 }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [carregada, setCarregada] = useState(false)
  const [erro, setErro] = useState('')
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [base, setBase] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      const b = V / Math.min(img.naturalWidth, img.naturalHeight) // cover
      setNat({ w: img.naturalWidth, h: img.naturalHeight })
      setBase(b)
      setOff({ x: (V - img.naturalWidth * b) / 2, y: (V - img.naturalHeight * b) / 2 })
      setZoom(1); setCarregada(true)
    }
    img.onerror = () => setErro('Não foi possível carregar a foto para ajustar.')
    img.src = src
  }, [src, crossOrigin])

  const es = base * zoom
  function clamp(o: { x: number; y: number }) {
    const w = nat.w * es, h = nat.h * es
    return { x: Math.min(0, Math.max(V - w, o.x)), y: Math.min(0, Math.max(V - h, o.y)) }
  }
  useEffect(() => { if (carregada) setOff(o => clamp(o)) /* re-limita ao mudar o zoom */ }, [zoom, carregada]) // eslint-disable-line

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch {}
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    setOff(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }))
  }
  function onPointerUp() { drag.current = null }

  function confirmar() {
    const img = imgRef.current; if (!img) return
    try {
      const c = document.createElement('canvas'); c.width = saida; c.height = saida
      const ctx = c.getContext('2d'); if (!ctx) return
      const sSize = V / es, sx = -off.x / es, sy = -off.y / es
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, saida, saida)
      c.toBlob(b => { if (b) onConfirm(b); else setErro('Não foi possível recortar a foto.') }, 'image/jpeg', 0.9)
    } catch {
      setErro('Esta foto não pôde ser ajustada aqui. Envie uma nova imagem.')
    }
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1500, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 20px 24px', maxWidth: 420, width: '100%', margin: '0 auto' }}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 14px' }} />
        <p style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, textAlign: 'center' }}>Ajustar foto</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginBottom: 14 }}>Arraste para posicionar · use o controle para aproximar</p>

        <div style={{ width: V, height: V, margin: '0 auto', position: 'relative', overflow: 'hidden', borderRadius: '50%', background: '#000', touchAction: 'none', cursor: 'grab', border: '3px solid var(--primary)' }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
          {carregada && <img src={src} draggable={false} crossOrigin={crossOrigin ? 'anonymous' : undefined}
            style={{ position: 'absolute', left: off.x, top: off.y, width: nat.w * es, height: nat.h * es, maxWidth: 'none', userSelect: 'none' }} />}
        </div>

        {erro && <p style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center', marginTop: 12 }}>{erro}</p>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
          <span className="icon icon-sm" style={{ color: 'var(--muted)' }}>zoom_out</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
          <span className="icon icon-sm" style={{ color: 'var(--muted)' }}>zoom_in</span>
        </div>

        <button className="btn btn-primary btn-full" onClick={confirmar} style={{ marginBottom: 8 }} disabled={!carregada}>Usar esta foto</button>
        <button className="btn btn-ghost btn-full" onClick={onCancel}>Cancelar</button>
      </div>
    </div>,
    document.body,
  )
}
