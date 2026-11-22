import { useFundoEscuro } from '../../lib/palco'

// Peças comuns das telas públicas do Palco ↔ Mesa (/ped, /mesa, /cel).

export function Aviso({ texto }: { texto: string }) {
  return <div style={{ position: 'fixed', left: 16, right: 16, bottom: 20, zIndex: 60, background: '#7f1d1d', color: 'white', borderRadius: 14, padding: '12px 16px', fontWeight: 700, fontSize: 16, textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>{texto}</div>
}

export function LinkInvalido({ titulo }: { titulo: string }) {
  return (
    <div style={{ textAlign: 'center', color: '#e2e8f0', padding: 24, maxWidth: 440 }}>
      <div style={{ fontSize: 54 }}>🔒</div>
      <p style={{ fontSize: 22, fontWeight: 800, margin: '10px 0 6px' }}>{titulo}</p>
      <p style={{ color: '#94a3b8', fontSize: 15 }}>Este link é inválido, foi trocado ou o palco está desativado. Peça um novo link a quem configura o Palco ↔ Mesa.</p>
    </div>
  )
}

export function Tela({ children }: { children: React.ReactNode }) {
  useFundoEscuro('#0b0f17')
  return <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0f17' }}>{children}</div>
}
