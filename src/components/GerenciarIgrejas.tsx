import { useEffect, useState } from 'react'
import { carregarIgrejas, salvarIgrejas, OUTROS } from '../lib/igrejas'
import { toast } from './Toast'

// Modal (admin) pra adicionar/excluir as igrejas da lista.
// "Outros" é fixo (não aparece aqui) — sempre existe pra quem quer digitar.
export default function GerenciarIgrejas({ onClose, onSalvo }: { onClose: () => void; onSalvo?: () => void }) {
  const [lista, setLista] = useState<string[]>([])
  const [nova, setNova]   = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { carregarIgrejas().then(l => { setLista(l); setLoading(false) }) }, [])

  function adicionar() {
    const v = nova.trim()
    if (!v) return
    if (v.toLowerCase() === OUTROS.toLowerCase()) { toast.erro('"Outros" já existe automaticamente.'); return }
    if (lista.some(x => x.toLowerCase() === v.toLowerCase())) { toast.erro('Essa igreja já está na lista.'); return }
    setLista(prev => [...prev, v]); setNova('')
  }
  function remover(i: number) { setLista(prev => prev.filter((_, idx) => idx !== i)) }

  async function salvar() {
    setSalvando(true)
    const ok = await salvarIgrejas(lista)
    setSalvando(false)
    if (ok) { toast.sucesso('Lista de igrejas salva!'); onSalvo?.(); onClose() }
    else toast.erro('Não foi possível salvar.')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 450, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 20px 28px', maxWidth: 480, width: '100%', margin: '0 auto', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 14px' }} />
        <p style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Gerenciar igrejas</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
          Essas opções aparecem no cadastro. <b>"Outros"</b> sempre existe (a pessoa digita o nome).
        </p>

        {/* Adicionar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input className="form-input" style={{ flex: 1 }} placeholder="Nova igreja..." value={nova}
            onChange={e => setNova(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionar() } }} />
          <button onClick={adicionar} disabled={!nova.trim()}
            style={{ flexShrink: 0, borderRadius: 10, border: 'none', background: 'var(--primary)', color: 'white', padding: '0 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', opacity: nova.trim() ? 1 : 0.5 }}>
            <span className="icon icon-sm">add</span>
          </button>
        </div>

        {/* Lista */}
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Carregando...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {lista.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhuma igreja na lista. Só vai aparecer "Outros".</p>}
            {lista.map((ig, i) => (
              <div key={ig + i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                <span style={{ fontSize: 18 }}>⛪</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{ig}</span>
                <button onClick={() => remover(i)} aria-label="Excluir"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', padding: 4 }}>
                  <span className="icon icon-sm">delete</span>
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px dashed var(--border)', opacity: 0.7 }}>
              <span style={{ fontSize: 18 }}>✍️</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>Outros <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(fixo — a pessoa digita)</span></span>
            </div>
          </div>
        )}

        <button className="btn btn-primary btn-full" onClick={salvar} disabled={salvando || loading}>
          {salvando ? 'Salvando...' : 'Salvar lista'}
        </button>
        <button className="btn btn-ghost btn-full" onClick={onClose} style={{ marginTop: 8 }}>Cancelar</button>
      </div>
    </div>
  )
}
