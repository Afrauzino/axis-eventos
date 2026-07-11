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
  const [separar, setSeparar] = useState(false)
  const [elenco, setElenco] = useState(false)
  const pct = Math.round(escala * 100)

  return (
    <>
      <style>{`
        @media screen {
          .crono-fundo { background:#e9edf1; padding:18px 8px; border-radius:12px; }
          .crono-folha { background:white; width:190mm; max-width:100%; margin:0 auto; padding:12mm 10mm; box-shadow:0 3px 16px rgba(0,0,0,0.18); border-radius:2px; }
        }
        @media print {
          .crono-toolbar { display:none !important; }
          .crono-fundo { background:none !important; padding:0 !important; }
          .crono-folha { box-shadow:none !important; padding:0 !important; width:auto !important; }
        }
      `}</style>

      <div className="crono-toolbar no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', padding: '4px 4px 16px' }}>
        <Segmento label="Dias" value={separar} onChange={setSeparar} opcoes={[{ v: false, l: 'Juntos (o que couber)' }, { v: true, l: 'Um por página' }]} />
        <Segmento label="Teatro" value={elenco} onChange={setElenco} opcoes={[{ v: false, l: 'Nome' }, { v: true, l: 'Fotos do elenco' }]} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Fonte</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEscala(e => Math.max(0.7, Math.round((e - 0.05) * 100) / 100))}>A−</button>
          <span style={{ fontSize: 12.5, fontWeight: 800, minWidth: 46, textAlign: 'center' }}>{pct}%</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEscala(e => Math.min(1.7, Math.round((e + 0.05) * 100) / 100))}>A+</button>
        </div>
      </div>

      <div className="crono-fundo">
        <div className="crono-folha">
          <CronogramaPoster titulo={titulo} dias={dias} slim escala={escala} separarDias={separar} mostrarElenco={elenco} />
        </div>
      </div>
    </>
  )
}
