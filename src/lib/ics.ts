// #7 — Gera um arquivo .ics (calendário) com alarmes.
// Ao abrir no celular, o Android/iPhone adiciona os eventos com lembrete (alarme).

export type EventoICS = {
  uid: string
  inicio: Date
  duracaoMin?: number      // padrão 15 min
  titulo: string
  descricao?: string
  local?: string
  alarmeAntesMin?: number  // minutos antes p/ tocar o alarme (padrão 8)
}

function fmt(d: Date): string {
  // formato UTC básico: 20260703T120000Z
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}
function esc(s: string): string {
  return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function gerarICS(eventos: EventoICS[]): string {
  const agora = new Date()
  const linhas: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AXIS Eventos//Medicamentos//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  for (const ev of eventos) {
    const fim = new Date(ev.inicio.getTime() + (ev.duracaoMin ?? 15) * 60000)
    const alarme = ev.alarmeAntesMin ?? 8
    linhas.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}`,
      `DTSTAMP:${fmt(agora)}`,
      `DTSTART:${fmt(ev.inicio)}`,
      `DTEND:${fmt(fim)}`,
      `SUMMARY:${esc(ev.titulo)}`,
      ...(ev.descricao ? [`DESCRIPTION:${esc(ev.descricao)}`] : []),
      ...(ev.local ? [`LOCATION:${esc(ev.local)}`] : []),
      'BEGIN:VALARM',
      `TRIGGER:-PT${alarme}M`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(ev.titulo)}`,
      'END:VALARM',
      'END:VEVENT',
    )
  }
  linhas.push('END:VCALENDAR')
  return linhas.join('\r\n')
}

export function baixarICS(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo.endsWith('.ics') ? nomeArquivo : nomeArquivo + '.ics'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
