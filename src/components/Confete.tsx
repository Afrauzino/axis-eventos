import { useEffect, useRef } from 'react'

// Confete em tela cheia (canvas). Dispara quando `disparo` muda de valor.
// Não é clicável (pointer-events none) e limpa sozinho após a animação.
const CORES = ['#00A99D', '#F6AD55', '#FC8181', '#6B46C1', '#48BB78', '#4299E1', '#ECC94B', '#ED64A6']

export default function Confete({ disparo }: { disparo: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!disparo) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W = window.innerWidth
    const H = window.innerHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const N = 180
    const parts = Array.from({ length: N }, () => ({
      x: Math.random() * W,
      y: -20 - Math.random() * H * 0.6,
      vx: (Math.random() - 0.5) * 3.5,
      vy: 2 + Math.random() * 4.5,
      size: 6 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.35,
      cor: CORES[Math.floor(Math.random() * CORES.length)],
    }))

    const DUR = 4800
    let raf = 0
    let inicio = 0
    const tick = (t: number) => {
      if (!inicio) inicio = t
      const passado = t - inicio
      ctx.clearRect(0, 0, W, H)
      for (const p of parts) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.035
        p.rot += p.vrot
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = passado > DUR - 900 ? Math.max(0, (DUR - passado) / 900) : 1
        ctx.fillStyle = p.cor
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }
      if (passado < DUR) raf = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, W, H)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [disparo])

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9998 }} />
}
