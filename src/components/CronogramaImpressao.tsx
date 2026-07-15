import { useState } from 'react'
import CronogramaPoster, { type DiaPoster } from './CronogramaPoster'

// Painel de impressão do cronograma resumido: controles simples (fonte, dias,
// teatro) + prévia dentro de uma "folha" A4. Modular e com visual limpo.
// Os controles somem na impressão (.no-print).

function Segmento({ label, value, opcoes, onChange }: {
  label: string; value: boolean; opcoes: { v: boolean; l: string }[]; onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>{label}</span>
      <div style={{ display: 'flex', background: '#eef1f4', borderRadius: 10, padding: 3 }}>
        {opcoes.map((o, i) => {
          const at = o.v === value
          return (
            <button key={i} type="button" onClick={() => onChange(o.v)}
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '6px 12px', borderRadius: 8, background: at ? 'white' : 'transparent', color: at ? '#111827' : '#6b7280', boxShadow: at ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>
              {o.l}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function CronogramaImpressao({ titulo, dias }: { titulo: string; dias: DiaPoster[] }) {
  const [escala, setEscala] = useState(1)
  const [elenco, setElenco] = useState(false)
  const pct = Math.round(escala * 100)

  return (
    <>
      <style>{`
        @media screen {
          .crono-fundo { background:#e9edf1; padding:18px 8px; border-radius:12px; overflow-x:auto; }
          /* Cada DIA vira uma FOLHA A4 separada (é onde a impressão quebra de verdade).
             190mm de conteúdo + margem; min-height A4 pra parecer uma página real. */
          .crono-folha { position:relative; background:white; width:190mm; min-height:277mm; margin:0 auto 22px; padding:12mm 10mm; box-shadow:0 4px 18px rgba(0,0,0,0.22); border-radius:2px; overflow:hidden; }
          .crono-folha:last-child { margin-bottom:0; }
          .folha-tag { position:absolute; top:7px; right:12px; font-size:10px; font-weight:800; color:#9aa3ad; letter-spacing:.05em; }
        }
        /* Celular/tablet: encolhe a FOLHA A4 inteira pra caber na tela mantendo o
           layout idêntico ao PDF. */
        @media screen and (max-width: 820px){ .crono-folha{ zoom:0.62 } }
        @media screen and (max-width: 640px){ .crono-folha{ zoom:0.52 } }
        @media screen and (max-width: 480px){ .crono-folha{ zoom:0.46 } }
        @media screen and (max-width: 412px){ .crono-folha{ zoom:0.42 } }
        @media screen and (max-width: 360px){ .crono-folha{ zoom:0.38 } }
        @media print {
          .crono-toolbar { display:none !important; }
          .crono-fundo { background:none !important; padding:0 !important; overflow:visible !important; }
          .crono-folha { box-shadow:none !important; padding:0 !important; width:auto !important; min-height:0 !important; margin:0 !important; zoom:1 !important; page-break-after:always; break-after:page; }
          .crono-folha:last-child { page-break-after:auto; break-after:auto; }
          .folha-tag { display:none !important; }
        }
      `}</style>

      <div className="crono-toolbar no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', padding: '4px 4px 16px' }}>
        <Segmento label="Teatro" value={elenco} onChange={setElenco} opcoes={[{ v: false, l: 'Nome' }, { v: true, l: 'Fotos do elenco' }]} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Fonte</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEscala(e => Math.max(0.7, Math.round((e - 0.05) * 100) / 100))}>A−</button>
          <span style={{ fontSize: 12.5, fontWeight: 800, minWidth: 46, textAlign: 'center' }}>{pct}%</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEscala(e => Math.min(1.7, Math.round((e + 0.05) * 100) / 100))}>A+</button>
        </div>
      </div>

      <div className="crono-fundo">
        {dias.map((d, i) => (
          <div className="crono-folha" key={i}>
            <span className="folha-tag">Folha {i + 1} de {dias.length}</span>
            <CronogramaPoster titulo={i === 0 ? titulo : ''} dias={[d]} slim escala={escala} mostrarElenco={elenco} />
          </div>
        ))}
      </div>
    </>
  )
}
