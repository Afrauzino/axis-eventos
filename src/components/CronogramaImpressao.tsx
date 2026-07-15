import { useState, useRef, useLayoutEffect } from 'react'
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
  const [paisagem, setPaisagem] = useState(false)   // A4 deitada (cartaz maior)
  const pct = Math.round(escala * 100)

  // Paginação AUTOMÁTICA: mede a altura de cada DIA (numa cópia escondida, mesma
  // escala) e ENFIA quantos dias inteiros couberem em cada folha A4. Um dia NUNCA
  // é cortado; só ganha folha própria quando sozinho não cabe (aí a impressão
  // quebra ele — sem opção). Fallback: 1 dia por folha até medir.
  const [paginas, setPaginas] = useState<DiaPoster[][]>(() => dias.map(d => [d]))
  const medRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const cont = medRef.current
    if (!cont) { setPaginas(dias.map(d => [d])); return }
    const MMPX = 3.7795275591          // px por mm (medimos em zoom 1, igual à impressão)
    const usavel = (paisagem ? 163 : 250) * MMPX  // altura útil: A4 retrato ~253mm / paisagem (deitada) ~166mm
    const tituloPx = titulo ? 64 : 0   // reserva pro título só na 1ª folha
    const blocos = Array.from(cont.children) as HTMLElement[]
    const alturas = dias.map((_, i) => blocos[i]?.getBoundingClientRect().height ?? usavel)
    const pags: DiaPoster[][] = []
    let atual: DiaPoster[] = []; let h = 0
    dias.forEach((_d, i) => {
      const budget = usavel - (pags.length === 0 ? tituloPx : 0)
      if (atual.length && h + alturas[i] > budget) { pags.push(atual); atual = []; h = 0 }
      atual.push(dias[i]); h += alturas[i]
    })
    if (atual.length) pags.push(atual)
    setPaginas(pags.length ? pags : dias.map(d => [d]))
  }, [dias, escala, elenco, titulo, paisagem])

  return (
    <>
      <style>{`
        @media screen {
          .crono-fundo { background:#e9edf1; padding:18px 8px; border-radius:12px; overflow-x:auto; }
          /* Cada DIA vira uma FOLHA A4 separada (é onde a impressão quebra de verdade).
             190mm de conteúdo + margem; min-height A4 pra parecer uma página real. */
          .crono-folha { position:relative; background:white; width:190mm; min-height:277mm; margin:0 auto 22px; padding:12mm 10mm; box-shadow:0 4px 18px rgba(0,0,0,0.22); border-radius:2px; overflow:hidden; }
          .paisagem .crono-folha { width:277mm; min-height:190mm; }
          .crono-folha:last-child { margin-bottom:0; }
          .folha-tag { position:absolute; top:7px; right:12px; font-size:10px; font-weight:800; color:#9aa3ad; letter-spacing:.05em; }
        }
        /* Celular/tablet: encolhe a FOLHA A4 inteira pra caber na tela mantendo o
           layout idêntico ao PDF. */
        @media screen and (max-width: 820px){ .crono-folha{ zoom:0.62 } .paisagem .crono-folha{ zoom:0.43 } }
        @media screen and (max-width: 640px){ .crono-folha{ zoom:0.52 } .paisagem .crono-folha{ zoom:0.36 } }
        @media screen and (max-width: 480px){ .crono-folha{ zoom:0.46 } .paisagem .crono-folha{ zoom:0.31 } }
        @media screen and (max-width: 412px){ .crono-folha{ zoom:0.42 } .paisagem .crono-folha{ zoom:0.29 } }
        @media screen and (max-width: 360px){ .crono-folha{ zoom:0.38 } .paisagem .crono-folha{ zoom:0.26 } }
        @media print {
          @page { size: ${paisagem ? 'A4 landscape' : 'A4 portrait'}; margin: 8mm; }
          .crono-toolbar { display:none !important; }
          .crono-fundo { background:none !important; padding:0 !important; overflow:visible !important; }
          .crono-folha { box-shadow:none !important; padding:0 !important; width:auto !important; min-height:0 !important; margin:0 !important; zoom:1 !important; page-break-after:always; break-after:page; }
          .crono-folha:last-child { page-break-after:auto; break-after:auto; }
          .folha-tag { display:none !important; }
        }
      `}</style>

      <div className="crono-toolbar no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', padding: '4px 4px 16px' }}>
        <Segmento label="Teatro" value={elenco} onChange={setElenco} opcoes={[{ v: false, l: 'Nome' }, { v: true, l: 'Fotos do elenco' }]} />
        <Segmento label="Folha" value={paisagem} onChange={setPaisagem} opcoes={[{ v: false, l: 'Retrato' }, { v: true, l: 'Paisagem' }]} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Fonte</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEscala(e => Math.max(0.7, Math.round((e - 0.05) * 100) / 100))}>A−</button>
          <span style={{ fontSize: 12.5, fontWeight: 800, minWidth: 46, textAlign: 'center' }}>{pct}%</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEscala(e => Math.min(1.7, Math.round((e + 0.05) * 100) / 100))}>A+</button>
        </div>
      </div>

      {/* Cópia ESCONDIDA só pra medir a altura de cada dia (visibility:hidden mantém o
          tamanho no layout; NÃO usar display:none, senão a altura vira 0). */}
      <div ref={medRef} aria-hidden style={{ position: 'absolute', left: -99999, top: 0, width: paisagem ? '277mm' : '190mm', visibility: 'hidden', pointerEvents: 'none' }}>
        {dias.map((d, i) => (
          <div key={i} style={{ padding: '0 10mm' }}>
            <CronogramaPoster titulo="" dias={[d]} slim escala={escala} mostrarElenco={elenco} />
          </div>
        ))}
      </div>

      <div className={'crono-fundo' + (paisagem ? ' paisagem' : '')}>
        {paginas.map((grupo, i) => (
          <div className="crono-folha" key={i}>
            <span className="folha-tag">Folha {i + 1} de {paginas.length}</span>
            <CronogramaPoster titulo={i === 0 ? titulo : ''} dias={grupo} slim escala={escala} mostrarElenco={elenco} />
          </div>
        ))}
      </div>
    </>
  )
}
