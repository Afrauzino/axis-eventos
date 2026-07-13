import { useEffect, useRef, useState } from 'react'

// Enquadrador do PNG do ministrante (pôster do cronograma).
// Mostra a imagem dentro de um quadro do MESMO formato do card (128x158) com
// linhas-guia (cabeça / centro / terços) pra padronizar todas as fotos.
// Ao aplicar, "assa" só o que está dentro do quadro num PNG transparente.

const FRAME_W = 128, FRAME_H = 158          // proporção do slot no card
const DISPLAY_W = 250                        // largura do quadro na tela
const DISPLAY_H = Math.round(DISPLAY_W * FRAME_H / FRAME_W)   // ~309
const OUT_W = 512, OUT_H = Math.round(OUT_W * FRAME_H / FRAME_W)  // saída em alta

export default function EnquadrarPoster({ src, onClose, onAplicar }: {
  src: string
  onClose: () => void
  onAplicar: (blob: Blob) => void | Promise<void>
}) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [carregada, setCarregada] = useState(false)
  const [nat, setNat] = useState({ w: 1, h: 1 })
  const [zoom, setZoom] = useState(1)          // multiplicador sobre o "contain"
  const [off, setOff] = useState({ x: 0, y: 0 })   // deslocamento em px (tela)
  const [salvando, setSalvando] = useState(false)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  // Carrega a imagem (crossOrigin p/ conseguir "assar" no canvas)
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img; setNat({ w: img.naturalWidth, h: img.naturalHeight }); setCarregada(true) }
    img.src = src
  }, [src])

  const base = Math.min(DISPLAY_W / nat.w, DISPLAY_H / nat.h)   // "contain"
  const eff = base * zoom
  const imgW = nat.w * eff, imgH = nat.h * eff
  const left = (DISPLAY_W - imgW) / 2 + off.x
  const top  = (DISPLAY_H - imgH) / 2 + off.y

  function onDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return
    setOff({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) })
  }
  function onUp() { drag.current = null }

  async function aplicar() {
    if (!imgRef.current) return
    setSalvando(true)
    try {
      const k = OUT_W / DISPLAY_W
      const cv = document.createElement('canvas')
      cv.width = OUT_W; cv.height = OUT_H
      const ctx = cv.getContext('2d')!
      ctx.clearRect(0, 0, OUT_W, OUT_H)     // fundo transparente
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(imgRef.current, left * k, top * k, imgW * k, imgH * k)
      const blob: Blob = await new Promise((res) => cv.toBlob(b => res(b!), 'image/png'))
      await onAplicar(blob)
    } catch {
      alert('Não consegui enquadrar essa imagem. Tente enviar de novo.')
      setSalvando(false)
    }
  }

  const linha: React.CSSProperties = { position: 'absolute', background: 'rgba(255,255,255,0.55)', pointerEvents: 'none' }
  const linhaForte: React.CSSProperties = { position: 'absolute', background: 'rgba(56,189,248,0.95)', pointerEvents: 'none', boxShadow: '0 0 0 1px rgba(0,0,0,0.25)' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 600, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 20px 24px', maxWidth: 460, width: '100%', margin: '0 auto', maxHeight: '94vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 14px' }} />
        <p style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Enquadrar foto</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
          Arraste a imagem e use o zoom. Deixe a <b style={{ color: '#0284c7' }}>linha azul</b> na altura dos olhos/queixo pra todas ficarem iguais.
        </p>

        {/* Quadro */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            style={{ position: 'relative', width: DISPLAY_W, height: DISPLAY_H, borderRadius: 12, overflow: 'hidden', touchAction: 'none', cursor: 'grab',
              background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%) 50% / 20px 20px', border: '2px solid var(--primary)' }}>
            {carregada && (
              <img src={src} alt="" draggable={false}
                style={{ position: 'absolute', left, top, width: imgW, height: imgH, userSelect: 'none', pointerEvents: 'none' }} />
            )}
            {/* Guias — terços */}
            <div style={{ ...linha, left: '33.33%', top: 0, bottom: 0, width: 1 }} />
            <div style={{ ...linha, left: '66.66%', top: 0, bottom: 0, width: 1 }} />
            <div style={{ ...linha, top: '33.33%', left: 0, right: 0, height: 1 }} />
            <div style={{ ...linha, top: '66.66%', left: 0, right: 0, height: 1 }} />
            {/* Centro vertical (forte) */}
            <div style={{ ...linhaForte, left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(56,189,248,0.5)' }} />
            {/* Linha da cabeça (topo) e dos olhos/queixo (forte) */}
            <div style={{ ...linha, top: '12%', left: 0, right: 0, height: 1 }} />
            <div style={{ ...linhaForte, top: '34%', left: 0, right: 0, height: 2 }} />
          </div>
        </div>

        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <span className="icon icon-sm" style={{ color: 'var(--muted)' }}>zoom_out</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} style={{ flex: 1 }} />
          <span className="icon icon-sm" style={{ color: 'var(--muted)' }}>zoom_in</span>
          <button type="button" onClick={() => { setZoom(1); setOff({ x: 0, y: 0 }) }}
            style={{ border: '1px solid var(--border)', background: 'white', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--muted)' }}>
            Resetar
          </button>
        </div>

        <button type="button" className="btn btn-primary btn-full" disabled={!carregada || salvando} onClick={aplicar}>
          <span className="icon icon-sm">check</span> {salvando ? 'Aplicando...' : 'Aplicar enquadramento'}
        </button>
        <button type="button" className="btn btn-ghost btn-full" onClick={onClose} style={{ marginTop: 8 }}>Cancelar</button>
      </div>
    </div>
  )
}
