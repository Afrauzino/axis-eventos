import { useEffect, useRef, useState } from 'react'
import Confete from './Confete'

// Cerimônia de abertura — tela cheia que BLOQUEIA tudo.
// Fluxo: mensagem personalizada + botão "Iniciar" → contagem 5s → corneta +
// confete ("É HOJE!") → volta ao normal depois de 4s.
// Usada tanto no TESTE quanto no dia real (mesma coisa).

const BUZINA = '/buzina-evento.mp3'

export default function AberturaCerimonia({ mensagem, onFechar }: { mensagem: string; onFechar: () => void }) {
  const [fase, setFase] = useState<'inicio' | 'contagem' | 'festa'>('inicio')
  const [contagem, setContagem] = useState(5)
  const [confete, setConfete] = useState(0)
  const ctxRef = useRef<AudioContext | null>(null)
  const bufRef = useRef<AudioBuffer | null>(null)

  async function tocarBuzina() {
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext)
      if (AC && !ctxRef.current) ctxRef.current = new AC()
      const ctx = ctxRef.current!
      await ctx.resume()
      if (!bufRef.current) {
        const r = await fetch(BUZINA)
        bufRef.current = await ctx.decodeAudioData(await r.arrayBuffer())
      }
      const src = ctx.createBufferSource(); src.buffer = bufRef.current
      const gain = ctx.createGain(); gain.gain.value = 3.0
      src.connect(gain); gain.connect(ctx.destination)
      src.start()
      return
    } catch {}
    try { const a = new Audio(BUZINA); a.volume = 1; await a.play() } catch {}
  }

  function iniciar() {
    // Desbloqueia o áudio no gesto do usuário
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext)
      if (AC && !ctxRef.current) ctxRef.current = new AC()
      ctxRef.current?.resume()
    } catch {}
    setContagem(5)
    setFase('contagem')
  }

  // Contagem 5 → 0
  useEffect(() => {
    if (fase !== 'contagem') return
    if (contagem <= 0) { setFase('festa'); return }
    const t = setTimeout(() => setContagem(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [fase, contagem])

  // Festa: corneta + confete, volta depois de 4s
  useEffect(() => {
    if (fase !== 'festa') return
    tocarBuzina()
    setConfete(c => c + 1)
    const t = setTimeout(onFechar, 4000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'linear-gradient(160deg, var(--primary-dark), #10151f)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', textAlign: 'center', padding: 24 }}>
      {fase === 'inicio' && (
        <>
          <div style={{ fontSize: 52, marginBottom: 18 }}>🎉</div>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 21, fontWeight: 700, lineHeight: 1.5, maxWidth: 540, marginBottom: 34 }}>{mensagem}</p>
          <button onClick={iniciar}
            style={{ background: 'white', color: 'var(--primary-dark)', border: 'none', borderRadius: 99, padding: '16px 54px', cursor: 'pointer', fontSize: 20, fontWeight: 800, fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
            Iniciar
          </button>
        </>
      )}

      {fase === 'contagem' && (
        <>
          <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', opacity: 0.8, marginBottom: 18 }}>PREPARE-SE...</p>
          <div key={contagem} style={{ fontSize: 150, fontWeight: 800, lineHeight: 1, animation: 'pulse 1s ease' }}>{contagem > 0 ? contagem : ''}</div>
        </>
      )}

      {fase === 'festa' && (
        <div style={{ fontSize: 64, fontWeight: 800 }}>É HOJE! 🎉</div>
      )}

      <Confete disparo={confete} />
    </div>
  )
}
