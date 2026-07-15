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
  fotoPng?: string | null   // PNG recortado (fundo transparente) só do pôster
  teatro?: string | null
  elenco?: { nome: string; foto: string | null }[]
  icone?: string | null     // ícone do tipo (Material Symbols) — modelo cartão
  sub?: string | null       // descrição/subtítulo — modelo cartão
}
export type DiaPoster = { dia: string; dataLabel?: string; linhas: LinhaPoster[] }

const HDR = { background: '#111827', color: 'white' }
const PEACH = '#F6D5A6'  // bege do pill do ministrante (igual ao modelo)

export default function CronogramaPoster({ titulo, dias, slim = false, escala = 1, separarDias = false, mostrarElenco = false }: { titulo: string; dias: DiaPoster[]; slim?: boolean; escala?: number; separarDias?: boolean; mostrarElenco?: boolean }) {
  const s = (n: number) => Math.max(1, Math.round(n * escala * 10) / 10)  // aplica a escala de fonte
  // Tokens de tamanho — sem `slim` fica IDÊNTICO ao modelo original. `escala` multiplica os tamanhos.
  const t = {
    borda:     slim ? '1.5px solid #111827' : '2px solid #111827',
    bordaHdr:  slim ? '1.5px solid #374151' : '2px solid #374151',
    h1:        s(slim ? 23 : 30),
    h1mb:      s(slim ? 10 : 18),
    band:      s(slim ? 38 : 46),
    bandFonte: s(slim ? 17 : 22),
    hdrFonte:  s(slim ? 11 : 14),
    hdrPad:    slim ? '5px 0' : '8px 0',
    horaW:     s(slim ? 74 : 96),
    durW:      s(slim ? 84 : 110),
    hdColFonte: s(slim ? 12 : 15),
    foto:      s(slim ? 62 : 54),   // FOTO grande no slim (reduzida um pouco p/ o título respirar)
    gap:       s(slim ? 6 : 8),
    rowPad:    slim ? '4px 6px 4px 7px' : '8px 8px 8px 10px',
    pillPad:   slim ? '4px 10px' : '6px 12px',
    pillRad:   slim ? 10 : 12,
    nome:      s(slim ? 10 : 11),
    tituloFonte: s(slim ? 15 : 16),
    teatroLabel: s(slim ? 9 : 11),
    teatroNome:  s(slim ? 13 : 16),
    teatroPad:   slim ? '4px 8px' : '6px 10px',
    dash:        s(slim ? 16 : 20),
    simplesPad:  slim ? '6px 8px' : '12px 10px',
    simplesFonte: s(slim ? 14 : 18),
    diaMb:       s(slim ? 12 : 22),
    diaRad:      slim ? 10 : 14,
  }
  const cel: React.CSSProperties = { display: 'flex', alignItems: 'stretch', borderTop: t.borda }
  const colHora: React.CSSProperties = { width: t.horaW, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: t.hdColFonte, borderLeft: t.borda }
  const colDur: React.CSSProperties = { width: t.durW, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: t.hdColFonte, borderLeft: t.borda }

  const corpo = (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#111827' }}>
      {titulo ? <h1 style={{ fontSize: t.h1, fontWeight: 900, letterSpacing: '-0.02em', margin: `0 0 ${t.h1mb}px` }}>{titulo}</h1> : null}

      {dias.map((d, di) => (
        <div key={di} className={separarDias ? 'print-break' : undefined} style={{ display: 'flex', border: t.borda, borderRadius: t.diaRad, overflow: 'hidden', marginBottom: t.diaMb, breakInside: 'avoid' }}>
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
                    {/* Ministrante: foto recortada (vaza pra cima) + pill BEGE, NOME em cima / título embaixo */}
                    <div style={{ flex: mostrarElenco ? 1 : 1.5, display: 'flex', alignItems: 'flex-end', gap: s(6), padding: t.rowPad, minWidth: 0, background: PEACH, borderRadius: t.pillRad, position: 'relative' }}>
                      {l.fotoPng ? (
                        // PNG recortado (fundo transparente, vem da ministração). NÃO cortar (sem denegrir):
                        // fica ancorado no FUNDO da tarja bege e a cabeça/pescoço VAZA PRA CIMA da tarja.
                        // position:absolute → não estica a altura da linha; z-index deixa a cabeça por cima.
                        <div style={{ width: Math.round(t.foto * 1.25), alignSelf: 'stretch', position: 'relative', flexShrink: 0 }}>
                          <img src={l.fotoPng} alt="" style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: 'auto', display: 'block', zIndex: 2 }} />
                        </div>
                      ) : l.fotoUrl ? (
                        <img src={l.fotoUrl} alt="" style={{ width: t.foto, height: t.foto, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: t.borda, alignSelf: 'center' }} />
                      ) : (
                        <div style={{ width: t.foto, height: t.foto, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: t.borda, alignSelf: 'center' }}><span style={{ fontWeight: 800, color: '#6b7280', fontSize: 16 }}>{getInitials(l.ministrante ?? '?')}</span></div>
                      )}
                      <div style={{ flex: 1, color: '#1b1206', minWidth: 0, alignSelf: 'center', padding: `0 ${s(4)}px` }}>
                        <p style={{ fontSize: t.nome, fontWeight: 800, lineHeight: 1.1, margin: 0 }}>{l.ministrante}</p>
                        <p style={{ fontSize: t.tituloFonte, fontWeight: 900, lineHeight: 1.05, margin: '1px 0 0' }}>{l.titulo}</p>
                      </div>
                    </div>
                    {/* Teatro (bloco escuro) — por nome OU com fotos do elenco */}
                    <div style={{ flex: 1, ...HDR, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: t.teatroPad, minWidth: 0 }}>
                      {mostrarElenco && l.elenco && l.elenco.length ? (
                        <>
                          {l.teatro && <p style={{ fontSize: t.teatroLabel, fontWeight: 800, letterSpacing: '0.08em', opacity: 0.85, margin: `0 0 ${s(4)}px`, textAlign: 'center' }}>{l.teatro}</p>}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: s(6), justifyContent: 'center' }}>
                            {l.elenco.map((a, ai) => (
                              <div key={ai} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: s(48) }}>
                                <div style={{ width: s(38), height: s(38), borderRadius: '50%', overflow: 'hidden', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid white', flexShrink: 0 }}>
                                  {a.foto ? <img src={a.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: s(11), fontWeight: 800, color: 'white' }}>{getInitials(a.nome || '?')}</span>}
                                </div>
                                <span style={{ fontSize: s(8), marginTop: 2, lineHeight: 1.05, textAlign: 'center', color: 'white', maxWidth: s(48), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(a.nome || '').split(' ')[0]}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : l.teatro ? (
                        <>
                          <p style={{ fontSize: t.teatroLabel, fontWeight: 800, letterSpacing: '0.08em', opacity: 0.85, margin: 0 }}>TEATRO</p>
                          <p style={{ fontSize: t.teatroNome, fontWeight: 900, textAlign: 'center', lineHeight: 1.05, margin: '2px 0 0' }}>{l.teatro}</p>
                        </>
                      ) : <p style={{ fontSize: t.dash, fontWeight: 900, opacity: 0.6, margin: 0 }}>—</p>}
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
  return corpo
}
