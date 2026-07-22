import { useEffect, useRef, useState } from 'react'

// Câmera pra TIRAR foto (getUserMedia) — funciona no PC (webcam) e no celular.
// Captura um quadro e devolve um File (que segue pro recorte/upload de sempre).

export default function CameraFoto({ onCapturar, onCancel }: { onCapturar: (file: File) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [erro, setErro] = useState('')
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [pronto, setPronto] = useState(false)

  function parar() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    let cancelado = false
    async function abrir() {
      parar(); setErro(''); setPronto(false)
      try {
        if (!navigator.mediaDevices?.getUserMedia) { setErro('Este aparelho/navegador não dá acesso à câmera aqui.'); return }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false })
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
        setPronto(true)
      } catch (e: any) {
        setErro(e?.name === 'NotAllowedError'
          ? 'Permissão da câmera negada. Libere a câmera pro app no navegador e tente de novo.'
          : 'Não foi possível abrir a câmera. Tente "Escolher foto".')
      }
    }
    abrir()
    return () => { cancelado = true; parar() }
  }, [facing])

  function capturar() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth; canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d'); if (!ctx) return
    if (facing === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1) } // frontal: espelha (fica natural)
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(b => {
      if (!b) return
      parar()
      onCapturar(new File([b], 'foto.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  }

  function fechar() { parar(); onCancel() }

  const btnCirc: React.CSSProperties = {
    width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: 'none',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'inherit',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {erro ? (
        <div style={{ background: 'white', borderRadius: 14, padding: 22, maxWidth: 340, textAlign: 'center' }}>
          <span className="icon" style={{ fontSize: 38, color: 'var(--danger)' }}>videocam_off</span>
          <p style={{ fontSize: 14, margin: '10px 0 16px', lineHeight: 1.4 }}>{erro}</p>
          <button type="button" className="btn btn-ghost btn-full" onClick={fechar}>Fechar</button>
        </div>
      ) : (
        <>
          <div style={{ position: 'relative', width: '100%', maxWidth: 420, aspectRatio: '3 / 4', background: '#000', borderRadius: 16, overflow: 'hidden' }}>
            <video ref={videoRef} playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: facing === 'user' ? 'scaleX(-1)' : 'none' }} />
            {!pronto && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 22 }}>
            <button type="button" onClick={fechar} style={btnCirc} aria-label="Cancelar"><span className="icon">close</span></button>
            <button type="button" onClick={capturar} disabled={!pronto} aria-label="Tirar foto"
              style={{ width: 72, height: 72, borderRadius: '50%', background: 'white', border: '4px solid rgba(255,255,255,0.5)', cursor: pronto ? 'pointer' : 'default', opacity: pronto ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="icon" style={{ fontSize: 30, color: '#111' }}>photo_camera</span>
            </button>
            <button type="button" onClick={() => setFacing(f => f === 'user' ? 'environment' : 'user')} style={btnCirc} aria-label="Trocar câmera"><span className="icon">cameraswitch</span></button>
          </div>
        </>
      )}
    </div>
  )
}
