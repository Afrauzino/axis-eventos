import { useState, useEffect } from 'react'
import { aplicarCor, salvarCor, carregarCorSalva, COR_PADRAO } from '../lib/tema'

const PALETA = [
  { nome: 'Turquesa', cor: '#00A99D' },
  { nome: 'Azul',     cor: '#3182CE' },
  { nome: 'Roxo',     cor: '#6B46C1' },
  { nome: 'Vermelho', cor: '#E53E3E' },
  { nome: 'Laranja',  cor: '#DD6B20' },
  { nome: 'Verde',    cor: '#2F855A' },
  { nome: 'Dourado',  cor: '#D69E2E' },
  { nome: 'Rosa',     cor: '#D53F8C' },
  { nome: 'Índigo',   cor: '#4C51BF' },
  { nome: 'Teal',     cor: '#319795' },
  { nome: 'Cinza',    cor: '#4A5568' },
  { nome: 'Preto',    cor: '#1A202C' },
]

export default function ConfigCor() {
  const [corAtual, setCorAtual] = useState(COR_PADRAO)
  const [corPreview, setCorPreview] = useState(COR_PADRAO)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    carregarCorSalva().then(c => { setCorAtual(c); setCorPreview(c) })
  }, [])

  // prévia ao vivo
  function preview(cor: string) {
    setCorPreview(cor)
    aplicarCor(cor)
    setSalvo(false)
  }

  async function confirmar() {
    setSalvando(true)
    await salvarCor(corPreview)
    setCorAtual(corPreview)
    setSalvando(false)
    setSalvo(true)
  }

  function cancelar() {
    aplicarCor(corAtual)
    setCorPreview(corAtual)
    setSalvo(false)
  }

  const mudou = corPreview.toLowerCase() !== corAtual.toLowerCase()

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
        Escolha a cor principal do sistema. A mudança aparece na hora (prévia). Toque em <b>Aplicar</b> para salvar para todos.
      </p>

      {/* Paleta pronta */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cores prontas</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
        {PALETA.map(p => {
          const sel = corPreview.toLowerCase() === p.cor.toLowerCase()
          return (
            <button
              key={p.cor}
              type="button"
              onClick={() => preview(p.cor)}
              title={p.nome}
              style={{
                width: 46, height: 46, borderRadius: 12, background: p.cor, cursor: 'pointer',
                border: 'none',
                boxShadow: sel ? '0 0 0 3px white, 0 0 0 5px ' + p.cor : 'none',
              }}
            />
          )
        })}
      </div>

      {/* Cor personalizada */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cor personalizada</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 24 }}>
        <input
          type="color"
          value={corPreview}
          onChange={e => preview(e.target.value)}
          style={{ width: 50, height: 50, borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer', padding: 2, background: 'white' }}
        />
        <input
          type="text"
          value={corPreview.toUpperCase()}
          onChange={e => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) { setCorPreview(v); if (/^#[0-9a-fA-F]{6}$/.test(v)) aplicarCor(v) } }}
          className="form-input"
          style={{ flex: 1, fontFamily: 'monospace' }}
          maxLength={7}
        />
      </div>

      {/* Prévia */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Prévia</div>
      <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-sm)', marginBottom: 24, border: '1px solid var(--border)' }}>
        <div style={{ background: corPreview, height: 48, display: 'flex', alignItems: 'center', padding: '0 16px', color: 'white', fontWeight: 700, fontSize: 15 }}>AXIS Eventos</div>
        <div style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: corPreview, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>AF</div>
          <button style={{ background: corPreview, color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 600, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>Botão</button>
          <span style={{ background: corPreview + '22', color: corPreview, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99 }}>Etiqueta</span>
        </div>
      </div>

      {/* Ações */}
      {mudou && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={confirmar} disabled={salvando} className="btn btn-primary" style={{ flex: 1 }}>
            {salvando ? 'Aplicando...' : 'Aplicar para todos'}
          </button>
          <button onClick={cancelar} className="btn btn-ghost">Cancelar</button>
        </div>
      )}
      {salvo && !mudou && (
        <div style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
          ✓ Cor aplicada para todo o sistema
        </div>
      )}
    </div>
  )
}
