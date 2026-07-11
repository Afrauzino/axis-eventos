import { getInitials } from '../utils'
import type { DiaPoster, LinhaPoster } from './CronogramaPoster'

// Modelo "cartão" do cronograma (o 2º modelo que o Anderson mandou):
// faixa lateral vinho com o dia + data, cada linha com pílula de horário (com a
// duração), foto/ícone em círculo, badge do ministrante, título + subtítulo e,
// nas ministrações, o bloco do teatro à direita.
const VINHO = '#5B1A2E'
const OURO = '#E3A857'

// Ícone Material Symbols que imprime (via font-family inline)
function MS({ name, size, color }: { name: string; size: number; color: string }) {
  return <span style={{ fontFamily: "'Material Symbols Outlined'", fontWeight: 'normal', fontStyle: 'normal', fontSize: size, lineHeight: 1, letterSpacing: 'normal', textTransform: 'none', display: 'inline-block', whiteSpace: 'nowrap', color, fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24", userSelect: 'none' }}>{name}</span>
}

function ehClara(hex: string): boolean {
  const c = (hex || '').replace('#', '')
  if (c.length < 6) return false
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150
}

export default function CronogramaPosterModerno({ titulo, dias, escala = 1, separarDias = false, mostrarElenco = false }: { titulo: string; dias: DiaPoster[]; escala?: number; separarDias?: boolean; mostrarElenco?: boolean }) {
  const s = (n: number) => Math.max(1, Math.round(n * escala * 10) / 10)

  function Linha({ l, ultima }: { l: LinhaPoster; ultima: boolean }) {
    const txtPill = ehClara(l.cor) ? '#3a1520' : 'white'
    const hora = l.horario.replace('H', 'h')
    const dur = l.duracao.replace('H', 'h')
    const min = l.kind === 'min'

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: s(12), padding: `${s(10)}px ${s(14)}px`, borderBottom: ultima ? 'none' : '1px solid #eef0f2' }}>
        {/* Pílula de horário + duração */}
        <div style={{ background: l.cor, color: txtPill, borderRadius: s(12), padding: `${s(7)}px ${s(12)}px`, textAlign: 'center', minWidth: s(76), flexShrink: 0 }}>
          <div style={{ fontSize: s(18), fontWeight: 800, lineHeight: 1 }}>{hora}</div>
          {dur !== '—' && <div style={{ fontSize: s(10), fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: s(3), opacity: 0.92 }}><MS name="schedule" size={s(11)} color={txtPill} /> {dur}</div>}
        </div>

        {/* Círculo: foto (ministração) ou ícone (demais) */}
        <div style={{ width: s(48), height: s(48), borderRadius: '50%', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: min && (l.fotoUrl || l.fotoPng) ? '#e5e7eb' : l.cor + '2e' }}>
          {min && (l.fotoPng || l.fotoUrl)
            ? <img src={(l.fotoPng || l.fotoUrl) as string} alt="" style={{ width: '100%', height: '100%', objectFit: l.fotoPng ? 'contain' : 'cover' }} />
            : min
              ? <span style={{ fontWeight: 800, fontSize: s(15), color: l.cor }}>{getInitials(l.ministrante || '?')}</span>
              : <MS name={l.icone || 'event'} size={s(24)} color={l.cor} />}
        </div>

        {/* Texto: badge do ministrante + título + subtítulo */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {min && l.ministrante && (
            <span style={{ display: 'inline-block', background: l.cor, color: txtPill, fontSize: s(10), fontWeight: 800, padding: `${s(2)}px ${s(8)}px`, borderRadius: s(6), marginBottom: s(4), letterSpacing: '0.02em' }}>{l.ministrante}</span>
          )}
          <p style={{ fontSize: s(16), fontWeight: 800, lineHeight: 1.12, margin: 0, color: '#1f2937' }}>{l.titulo}</p>
          {l.sub && <p style={{ fontSize: s(11), color: '#8a929c', margin: `${s(2)}px 0 0`, lineHeight: 1.2 }}>{l.sub}</p>}
        </div>

        {/* Teatro (só ministração) */}
        {min && (
          <>
            <div style={{ width: 1, alignSelf: 'stretch', background: '#eef0f2', margin: `${s(4)}px ${s(6)}px` }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: s(8), width: '31%', minWidth: 0, flexShrink: 0 }}>
              <MS name="theater_comedy" size={s(26)} color={VINHO} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: s(9.5), fontWeight: 800, color: '#9aa1ab', letterSpacing: '0.08em', margin: 0 }}>TEATRO</p>
                {mostrarElenco && l.elenco && l.elenco.length ? (
                  <div style={{ display: 'flex', gap: s(3), marginTop: s(2) }}>
                    {l.elenco.slice(0, 5).map((a, i) => (
                      <div key={i} style={{ width: s(22), height: s(22), borderRadius: '50%', overflow: 'hidden', background: '#e5e7eb', flexShrink: 0 }}>
                        {a.foto ? <img src={a.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: s(8), fontWeight: 800, color: '#6b7280', display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>{getInitials(a.nome || '?')}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: s(13), fontWeight: 800, color: '#1f2937', margin: 0, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.teatro || '—'}</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#1f2937' }}>
      <h1 style={{ fontSize: s(26), fontWeight: 900, letterSpacing: '-0.02em', margin: `0 0 ${s(14)}px` }}>{titulo}</h1>

      {dias.map((d, di) => (
        <div key={di} className={separarDias ? 'print-break' : undefined} style={{ display: 'flex', borderRadius: s(16), overflow: 'hidden', marginBottom: s(16), boxShadow: '0 1px 4px rgba(0,0,0,0.14)', border: '1px solid #eef0f2', breakInside: 'avoid' }}>
          {/* Faixa do dia */}
          <div style={{ background: VINHO, width: s(64), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: s(6) }}>
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 900, fontSize: s(24), letterSpacing: '0.06em', color: 'white' }}>{d.dia}</span>
            {d.dataLabel && <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 800, fontSize: s(12), letterSpacing: '0.04em', color: OURO }}>{d.dataLabel}</span>}
          </div>
          {/* Linhas */}
          <div style={{ flex: 1, minWidth: 0, background: 'white' }}>
            {d.linhas.map((l, li) => <Linha key={li} l={l} ultima={li === d.linhas.length - 1} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
