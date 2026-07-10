// Impressão "resumida" do cronograma no layout de pôster (o que o Anderson mandou):
// por dia (SEXTA/SÁBADO/DOMINGO), cada linha com foto do ministrante + PR. NOME +
// título da ministração + TEATRO + horário + duração. Linhas simples (refeições,
// despertar, recolher) ocupam a largura toda, tingidas pela cor do tipo.
import { getInitials } from '../utils'

export type LinhaPoster = {
  kind: 'min' | 'simples'
  horario: string
  duracao: string
  cor: string
  titulo: string
  ministrante?: string
  fotoUrl?: string | null
  teatro?: string | null
}
export type DiaPoster = { dia: string; linhas: LinhaPoster[] }

const HDR = { background: '#111827', color: 'white' }
const cel: React.CSSProperties = { display: 'flex', alignItems: 'stretch', borderTop: '2px solid #111827' }
const colHora: React.CSSProperties = { width: 96, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, borderLeft: '2px solid #111827' }
const colDur: React.CSSProperties = { width: 110, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, borderLeft: '2px solid #111827' }

export default function CronogramaPoster({ titulo, dias }: { titulo: string; dias: DiaPoster[] }) {
  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#111827' }}>
      <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', margin: '0 0 18px' }}>{titulo}</h1>

      {dias.map((d, di) => (
        <div key={di} className="print-break" style={{ display: 'flex', border: '2px solid #111827', borderRadius: 14, overflow: 'hidden', marginBottom: 22, breakInside: 'avoid' }}>
          {/* Faixa vertical do dia */}
          <div style={{ ...HDR, width: 46, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 900, fontSize: 22, letterSpacing: '0.08em' }}>{d.dia}</span>
          </div>

          {/* Tabela do dia */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Cabeçalho */}
            <div style={{ display: 'flex' }}>
              <div style={{ ...HDR, flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 14, padding: '8px 0' }}>DESCRIÇÃO</div>
              <div style={{ ...HDR, ...colHora, borderLeft: '2px solid #374151', padding: '8px 0' }}>HORÁRIO</div>
              <div style={{ ...HDR, ...colDur, borderLeft: '2px solid #374151', padding: '8px 0' }}>DURAÇÃO</div>
            </div>

            {/* Linhas */}
            {d.linhas.map((l, li) => (
              <div key={li} style={cel}>
                {/* DESCRIÇÃO */}
                {l.kind === 'min' ? (
                  <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
                    {/* Ministrante (pill colorido) */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 10px', minWidth: 0 }}>
                      <div style={{ width: 54, height: 54, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #111827' }}>
                        {l.fotoUrl ? <img src={l.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontWeight: 800, color: '#6b7280', fontSize: 16 }}>{getInitials(l.ministrante ?? '?')}</span>}
                      </div>
                      <div style={{ flex: 1, background: l.cor, color: 'white', borderRadius: 12, padding: '6px 12px', minWidth: 0 }}>
                        <p style={{ fontSize: 11, fontWeight: 800, opacity: 0.95, lineHeight: 1.1, margin: 0 }}>{l.ministrante}</p>
                        <p style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.05, margin: '2px 0 0' }}>{l.titulo}</p>
                      </div>
                    </div>
                    {/* Teatro (bloco escuro) */}
                    <div style={{ flex: 1, ...HDR, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px 10px', minWidth: 0 }}>
                      {l.teatro ? <>
                        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', opacity: 0.85, margin: 0 }}>TEATRO</p>
                        <p style={{ fontSize: 16, fontWeight: 900, textAlign: 'center', lineHeight: 1.05, margin: '2px 0 0' }}>{l.teatro}</p>
                      </> : <p style={{ fontSize: 20, fontWeight: 900, opacity: 0.6, margin: 0 }}>—</p>}
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 10px', background: l.cor + '2e', textAlign: 'center' }}>
                    <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '0.02em' }}>{l.titulo}</span>
                  </div>
                )}

                {/* HORÁRIO / DURAÇÃO */}
                <div style={colHora}>{l.horario}</div>
                <div style={colDur}>{l.duracao}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
