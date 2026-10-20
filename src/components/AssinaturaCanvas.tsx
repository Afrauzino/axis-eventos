import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

// Assinatura feita com o dedo (ou mouse) na tela. Exporta PNG com fundo branco.
export type AssinaturaRef = { vazia: () => boolean; limpar: () => void; png: () => Promise<Blob | null> }

const AssinaturaCanvas = forwardRef<AssinaturaRef, { altura?: number; onMudar?: (temTraco: boolean) => void }>(
  function AssinaturaCanvas({ altura = 180, onMudar }, ref) {
    const cv = useRef<HTMLCanvasElement>(null)
    const desenhando = useRef(false)
    const ultimo = useRef<{ x: number; y: number } | null>(null)
    const [temTraco, setTemTraco] = useState(false)

    // Ajusta a resolução ao tamanho real (nítido em celular com tela densa)
    useEffect(() => {
      const c = cv.current; if (!c) return
      const ajustar = () => {
        const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1
        const img = temTraco ? c.toDataURL() : null
        c.width = Math.round(r.width * dpr); c.height = Math.round(altura * dpr)
        const ctx = c.getContext('2d')!; ctx.scale(dpr, dpr)
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, r.width, altura)
        ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'
        if (img) { const i = new Image(); i.onload = () => ctx.drawImage(i, 0, 0, r.width, altura); i.src = img }
      }
      ajustar()
      window.addEventListener('resize', ajustar)
      return () => window.removeEventListener('resize', ajustar)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [altura])

    function pos(e: React.PointerEvent) {
      const r = cv.current!.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    function inicio(e: React.PointerEvent) {
      e.preventDefault(); cv.current!.setPointerCapture(e.pointerId)
      desenhando.current = true; ultimo.current = pos(e)
      const ctx = cv.current!.getContext('2d')!, p = ultimo.current
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill()
    }
    function mover(e: React.PointerEvent) {
      if (!desenhando.current || !ultimo.current) return
      e.preventDefault()
      const ctx = cv.current!.getContext('2d')!, p = pos(e)
      ctx.beginPath(); ctx.moveTo(ultimo.current.x, ultimo.current.y); ctx.lineTo(p.x, p.y); ctx.stroke()
      ultimo.current = p
      if (!temTraco) { setTemTraco(true); onMudar?.(true) }
    }
    function fim() { desenhando.current = false; ultimo.current = null }

    function limpar() {
      const c = cv.current; if (!c) return
      const r = c.getBoundingClientRect(), ctx = c.getContext('2d')!
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, r.width, altura)
      setTemTraco(false); onMudar?.(false)
    }

    useImperativeHandle(ref, () => ({
      vazia: () => !temTraco,
      limpar,
      png: () => new Promise(res => cv.current ? cv.current.toBlob(b => res(b), 'image/png') : res(null)),
    }))

    return (
      <div>
        <div style={{ position: 'relative', border: '1.5px dashed var(--border)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
          <canvas ref={cv} style={{ width: '100%', height: altura, display: 'block', touchAction: 'none', cursor: 'crosshair' }}
            onPointerDown={inicio} onPointerMove={mover} onPointerUp={fim} onPointerCancel={fim} onPointerLeave={fim} />
          {!temTraco && (
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', fontSize: 13, pointerEvents: 'none' }}>
              ✍️ Assine aqui com o dedo
            </span>
          )}
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 34, borderBottom: '1px solid #cbd5e0', pointerEvents: 'none' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={limpar} disabled={!temTraco}>Limpar</button>
        </div>
      </div>
    )
  })

export default AssinaturaCanvas
