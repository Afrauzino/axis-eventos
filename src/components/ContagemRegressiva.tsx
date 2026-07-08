import { useEffect, useState } from 'react'

// Relógio digital de contagem regressiva para o 1º dia do evento.
// Mostra dias / horas / minutos / segundos. Some quando o evento já começou.

function alvoDoEvento(dataInicio?: string | null): number | null {
  if (!dataInicio) return null
  // 'YYYY-MM-DD' (ou com hora) -> começo do primeiro dia, hora local
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataInicio)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0).getTime()
}

export default function ContagemRegressiva({ dataInicio }: { dataInicio?: string | null }) {
  const alvo = alvoDoEvento(dataInicio)
  const [agora, setAgora] = useState(Date.now())

  useEffect(() => {
    if (alvo == null) return
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [alvo])

  if (alvo == null) return null
  const restante = alvo - agora
  if (restante <= 0) return null // já começou

  const totalSeg = Math.floor(restante / 1000)
  const dias = Math.floor(totalSeg / 86400)
  const horas = Math.floor((totalSeg % 86400) / 3600)
  const min = Math.floor((totalSeg % 3600) / 60)
  const seg = totalSeg % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  const blocos: { v: string; l: string }[] = [
    { v: String(dias), l: dias === 1 ? 'DIA' : 'DIAS' },
    { v: pad(horas), l: 'HORAS' },
    { v: pad(min), l: 'MIN' },
    { v: pad(seg), l: 'SEG' },
  ]

  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
      borderRadius: 14, padding: '16px 16px 18px', marginBottom: 16,
      boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>⏳</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Contagem regressiva para o encontro
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        {blocos.map((b, i) => (
          <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 12, padding: '12px 4px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: 'white', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>{b.v}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginTop: 6, letterSpacing: '0.08em' }}>{b.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
