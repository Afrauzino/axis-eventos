import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useVoltarFecha } from '../hooks/useVoltarFecha'

// Ajustar/reposicionar imagem: arrastar para posicionar + zoom.
// aspecto = largura/altura do recorte (1 = quadrado/círculo, ex.: 16/9 = banner).
// Devolve um Blob (JPEG) já enquadrado.
type Props = {
  src: string
  crossOrigin?: boolean
  onCancel: () => void
  // (recorte exibido, foto original inteira). A original pode vir null p/ quem não a usa.
  onConfirm: (blob: Blob, original: Blob | null) => void
  saida?: number              // LARGURA de saída em px (altura = saida/aspecto)
  aspecto?: number            // largura/altura do recorte (padrão 1 = quadrado)
  titulo?: string
}

const LARG = 288 // largura do visor (px)

export default function RecortarFoto({ src, crossOrigin, onCancel, onConfirm, saida = 400, aspecto = 1, titulo }: Props) {
  useVoltarFecha(true, onCancel)  // voltar do celular fecha o recorte
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [carregada, setCarregada] = useState(false)
  const [erro, setErro] = useState('')
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [base, setBase] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const Vw = LARG
  const Vh = Math.round(LARG / aspecto)

  useEffect(() => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      const b = Math.max(Vw / img.naturalWidth, Vh / img.naturalHeight) // cover
      setNat({ w: img.naturalWidth, h: img.naturalHeight })
      setBase(b)
      setOff({ x: (Vw - img.naturalWidth * b) / 2, y: (Vh - img.naturalHeight * b) / 2 })
      setZoom(1); setCarregada(true)
    }
    img.onerror = () => setErro('Não foi possível carregar a imagem para ajustar.')
    img.src = src
  }, [src, crossOrigin, aspecto])

  const es = base * zoom
  function clamp(o: { x: number; y: number }) {
    const w = nat.w * es, h = nat.h * es
    return { x: Math.min(0, Math.max(Vw - w, o.x)), y: Math.min(0, Math.max(Vh - h, o.y)) }
  }
  useEffect(() => { if (carregada) setOff(o => clamp(o)) }, [zoom, carregada]) // eslint-disable-line

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
      const cw = Math.round(saida), ch = Math.round(saida / aspecto)
      const c = document.createElement('canvas'); c.width = cw; c.height = ch
      const ctx = c.getContext('2d'); if (!ctx) return
      const sw = Vw / es, sh = Vh / es, sx = -off.x / es, sy = -off.y / es
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch)
      // Gera também a ORIGINAL inteira (sem corte), reduzida a no máx 2000px de lado.
      const maxLado = 2000
      const fo = Math.min(1, maxLado / Math.max(nat.w, nat.h))
      const ow = Math.max(1, Math.round(nat.w * fo)), oh = Math.max(1, Math.round(nat.h * fo))
      const co = document.createElement('canvas'); co.width = ow; co.height = oh
      const octx = co.getContext('2d')
      if (octx) octx.drawImage(img, 0, 0, ow, oh)
      c.toBlob(b => {
        if (!b) { setErro('Não foi possível recortar a imagem.'); return }
        if (octx) co.toBlob(orig => onConfirm(b, orig), 'image/jpeg', 0.92)
        else onConfirm(b, null)
      }, 'image/jpeg', 0.9)
    } catch {
      setErro('Esta imagem não pôde ser ajustada aqui. Envie outra.')
    }
  }

  const redondo = aspecto === 1

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1500, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 20px 24px', maxWidth: 420, width: '100%', margin: '0 auto' }}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 14px' }} />
        <p style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, textAlign: 'center' }}>{titulo ?? (redondo ? 'Ajustar foto' : 'Enquadrar imagem')}</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginBottom: 14 }}>Arraste para posicionar · use o controle para aproximar</p>

        <div style={{ width: Vw, height: Vh, margin: '0 auto', position: 'relative', overflow: 'hidden', borderRadius: redondo ? '50%' : 14, background: '#000', touchAction: 'none', cursor: 'grab', border: '3px solid var(--primary)' }}
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

        <button className="btn btn-primary btn-full" onClick={confirmar} style={{ marginBottom: 8 }} disabled={!carregada}>Usar esta imagem</button>
        <button className="btn btn-ghost btn-full" onClick={onCancel}>Cancelar</button>
      </div>
    </div>,
    document.body,
  )
}
