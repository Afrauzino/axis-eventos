import { useState } from 'react'

// ⚙️ Menu de impressão: um botão de engrenagem que abre de baixo as opções de
// imprimir/PDF. Junta todos os botões de impressão num lugar só, por tela.
export type ItemImpressao = { label: string; onClick: () => void; icon?: string; disabled?: boolean }

export default function MenuImprimir({ itens, titulo = 'Imprimir', full = false }: { itens: ItemImpressao[]; titulo?: string; full?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const ativos = itens.filter(i => !i.disabled)
  if (!itens.length) return null

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button type="button" onClick={() => setAberto(true)} aria-label="Imprimir"
          className={full ? 'btn btn-outline btn-sm' : undefined}
          style={full
            ? { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }
            : { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>
          <span className="icon icon-sm">settings</span>
          <span className="icon icon-sm">print</span>
          Imprimir
        </button>
      </div>

      {aberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setAberto(false)}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 16px 24px', maxWidth: 480, width: '100%', margin: '0 auto', maxHeight: '75vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 14px' }} />
            <p style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, padding: '0 4px' }}>{titulo}</p>
            {ativos.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', padding: '8px 4px' }}>Nada para imprimir agora.</p>}
            {itens.map((it, i) => (
              <button key={i} type="button" disabled={it.disabled}
                onClick={() => { setAberto(false); it.onClick() }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px', borderRadius: 10, marginBottom: 6, cursor: it.disabled ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', border: '1px solid var(--border)', background: 'white', opacity: it.disabled ? 0.5 : 1 }}>
                <span className="icon" style={{ color: 'var(--primary)' }}>{it.icon ?? 'print'}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{it.label}</span>
              </button>
            ))}
            <button type="button" className="btn btn-ghost btn-full" style={{ marginTop: 6 }} onClick={() => setAberto(false)}>Fechar</button>
          </div>
        </div>
      )}
    </>
  )
}
