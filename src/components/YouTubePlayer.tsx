import { useEffect, useRef } from 'react'

// #17 — Player do YouTube LIMPO para a playlist da Início:
// autoplay, mudo, SEM controles/barra/play e sem interface do YouTube.
// Avança para o próximo item SÓ quando o vídeo termina (onEnded).
// Item único: dá loop no próprio vídeo.

let apiPromise: Promise<any> | null = null
function loadYT(): Promise<any> {
  const w = window as any
  if (w.YT?.Player) return Promise.resolve(w.YT)
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
      const prev = w.onYouTubeIframeAPIReady
      w.onYouTubeIframeAPIReady = () => { prev?.(); resolve(w.YT) }
    })
  }
  return apiPromise
}

export default function YouTubePlayer({ videoId, onEnded, loop = false }: { videoId: string; onEnded: () => void; loop?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  useEffect(() => {
    let cancelled = false
    loadYT().then((YT) => {
      if (cancelled || !hostRef.current) return
      playerRef.current = new YT.Player(hostRef.current, {
        videoId,
        playerVars: {
          autoplay: 1, mute: 1, controls: 0, disablekb: 1, fs: 0,
          modestbranding: 1, rel: 0, iv_load_policy: 3, playsinline: 1,
        },
        events: {
          onReady: (e: any) => { try { e.target.mute(); e.target.playVideo() } catch {} },
          onStateChange: (e: any) => {
            if (e.data === YT.PlayerState.ENDED) {
              if (loop) { try { e.target.seekTo(0); e.target.playVideo() } catch {} }
              else onEndedRef.current()
            }
          },
        },
      })
    })
    return () => { cancelled = true; try { playerRef.current?.destroy() } catch {} playerRef.current = null }
  }, [videoId, loop])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
      <div ref={hostRef} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
      {/* camada que bloqueia qualquer clique/UI do YouTube (sem play/pause) */}
      <div style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}
