// Impressão "resumida" do cronograma no layout de pôster (o que o Anderson mandou):
// por dia (SEXTA/SÁBADO/DOMINGO), cada linha com foto do ministrante + PR. NOME +
// título da ministração + TEATRO + horário + duração. Linhas simples (refeições,
// despertar, recolher) ocupam a largura toda, tingidas pela cor do tipo.
//
// `slim`: modelo mais compacto (espaçamento fino, fonte menor, FOTO MAIOR,
// ministração em destaque com o NOME embaixo) — pensado pra caber em uma A4.
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

export default function CronogramaPoster({ titulo, dias, slim = false }: { titulo: string; dias: DiaPoster[]; slim?: boolean }) {
  // Tokens de tamanho — sem `slim` fica IDÊNTICO ao modelo original.
  const t = {
    borda:     slim ? '1.5px solid #111827' : '2px solid #111827',
    bordaHdr:  slim ? '1.5px solid #374151' : '2px solid #374151',
    h1:        slim ? 23 : 30,
    h1mb:      slim ? 10 : 18,
    band:      slim ? 38 : 46,
    bandFonte: slim ? 17 : 22,
    hdrFonte:  slim ? 11 : 14,
    hdrPad:    slim ? '5px 0' : '8px 0',
    horaW:     slim ? 74 : 96,
    durW:      slim ? 84 : 110,
    hdColFonte: slim ? 12 : 15,
    foto:      slim ? 72 : 54,   // FOTO MAIOR no slim
    gap:       slim ? 6 : 8,
    rowPad:    slim ? '4px 6px 4px 7px' : '8px 8px 8px 10px',
    pillPad:   slim ? '4px 10px' : '6px 12px',
    pillRad:   slim ? 10 : 12,
    nome:      slim ? 10 : 11,
    tituloFonte: slim ? 15 : 16,
    teatroLabel: slim ? 9 : 11,
    teatroNome:  slim ? 13 : 16,
    teatroPad:   slim ? '4px 8px' : '6px 10px',
    dash:        slim ? 16 : 20,
    simplesPad:  slim ? '6px 8px' : '12px 10px',
    simplesFonte: slim ? 14 : 18,
    diaMb:       slim ? 12 : 22,
    diaRad:      slim ? 10 : 14,
  }
  const cel: React.CSSProperties = { display: 'flex', alignItems: 'stretch', borderTop: t.borda }
  const colHora: React.CSSProperties = { width: t.horaW, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: t.hdColFonte, borderLeft: t.borda }
  const colDur: React.CSSProperties = { width: t.durW, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: t.hdColFonte, borderLeft: t.borda }

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#111827' }}>
      <h1 style={{ fontSize: t.h1, fontWeight: 900, letterSpacing: '-0.02em', margin: `0 0 ${t.h1mb}px` }}>{titulo}</h1>

      {dias.map((d, di) => (
        <div key={di} className="print-break" style={{ display: 'flex', border: t.borda, borderRadius: t.diaRad, overflow: 'hidden', marginBottom: t.diaMb, breakInside: 'avoid' }}>
          {/* Faixa vertical do dia */}
          <div style={{ ...HDR, width: t.band, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 900, fontSize: t.bandFonte, letterSpacing: '0.08em' }}>{d.dia}</span>
          </div>

          {/* Tabela do dia */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Cabeçalho */}
            <div style={{ display: 'flex' }}>
              <div style={{ ...HDR, flex: 1, textAlign: 'center', fontWeight: 800, fontSize: t.hdrFonte, padding: t.hdrPad }}>DESCRIÇÃO</div>
              <div style={{ ...HDR, ...colHora, borderLeft: t.bordaHdr, padding: t.hdrPad }}>HORÁRIO</div>
              <div style={{ ...HDR, ...colDur, borderLeft: t.bordaHdr, padding: t.hdrPad }}>DURAÇÃO</div>
            </div>

            {/* Linhas */}
            {d.linhas.map((l, li) => (
              <div key={li} style={cel}>
                {/* DESCRIÇÃO */}
                {l.kind === 'min' ? (
                  <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
                    {/* Ministrante (foto + pill colorido) */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: t.gap, padding: t.rowPad, minWidth: 0 }}>
                      <div style={{ width: t.foto, height: t.foto, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', border: t.borda }}>
                        {l.fotoUrl ? <img src={l.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontWeight: 800, color: '#6b7280', fontSize: 16 }}>{getInitials(l.ministrante ?? '?')}</span>}
                      </div>
                      <div style={{ flex: 1, background: l.cor, color: 'white', borderRadius: t.pillRad, padding: t.pillPad, minWidth: 0 }}>
                        {slim ? (
                          <>
                            {/* Ministração em DESTAQUE, nome embaixo */}
                            <p style={{ fontSize: t.tituloFonte, fontWeight: 900, lineHeight: 1.05, margin: 0 }}>{l.titulo}</p>
                            <p style={{ fontSize: t.nome, fontWeight: 800, opacity: 0.95, lineHeight: 1.1, margin: '2px 0 0' }}>{l.ministrante}</p>
                          </>
                        ) : (
                          <>
                            <p style={{ fontSize: t.nome, fontWeight: 800, opacity: 0.95, lineHeight: 1.1, margin: 0 }}>{l.ministrante}</p>
                            <p style={{ fontSize: t.tituloFonte, fontWeight: 900, lineHeight: 1.05, margin: '2px 0 0' }}>{l.titulo}</p>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Teatro (bloco escuro) */}
                    <div style={{ flex: 1, ...HDR, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: t.teatroPad, minWidth: 0 }}>
                      {l.teatro ? <>
                        <p style={{ fontSize: t.teatroLabel, fontWeight: 800, letterSpacing: '0.08em', opacity: 0.85, margin: 0 }}>TEATRO</p>
                        <p style={{ fontSize: t.teatroNome, fontWeight: 900, textAlign: 'center', lineHeight: 1.05, margin: '2px 0 0' }}>{l.teatro}</p>
                      </> : <p style={{ fontSize: t.dash, fontWeight: 900, opacity: 0.6, margin: 0 }}>—</p>}
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: t.simplesPad, background: l.cor + '2e', textAlign: 'center' }}>
                    <span style={{ fontSize: t.simplesFonte, fontWeight: 900, letterSpacing: '0.02em' }}>{l.titulo}</span>
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
