import { useEffect, useState } from 'react'
import { carregarConfig, salvarConfig } from '../lib/tema'
import { toast } from '../components/Toast'
import ParabensAniversario, { MSG_PADRAO, TITULO_PADRAO } from '../components/ParabensAniversario'
import type { Profile } from '../App'

// Administração → Notificações. Por enquanto: a tela de Parabéns de aniversário
// (ver / testar / editar) + avisar líderes e admins. Dá pra crescer com o tempo.
export default function ConfigNotificacoes({ profile }: { profile?: Profile }) {
  const [titulo, setTitulo] = useState(TITULO_PADRAO)
  const [mensagem, setMensagem] = useState(MSG_PADRAO)
  const [avisar, setAvisar] = useState(true)
  const [carregado, setCarregado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [preview, setPreview] = useState<{ nome: string; titulo: string; mensagem: string } | null>(null)

  useEffect(() => {
    ;(async () => {
      const [t, m, a] = await Promise.all([
        carregarConfig('aniversario_titulo'), carregarConfig('aniversario_mensagem'), carregarConfig('aniversario_avisar_lideres'),
      ])
      if (t) setTitulo(t)
      if (m) setMensagem(m)
      if (a === '0') setAvisar(false)
      setCarregado(true)
    })()
  }, [])

  async function salvar() {
    setSalvando(true)
    await Promise.all([
      salvarConfig('aniversario_titulo', titulo.trim() || TITULO_PADRAO),
      salvarConfig('aniversario_mensagem', mensagem.trim() || MSG_PADRAO),
      salvarConfig('aniversario_avisar_lideres', avisar ? '1' : '0'),
    ])
    setSalvando(false)
    toast.sucesso('Configuração salva!')
  }

  function testar() {
    setPreview({ nome: (profile?.full_name || 'você').split(' ')[0] || 'você', titulo: titulo.trim() || TITULO_PADRAO, mensagem: mensagem.trim() || MSG_PADRAO })
  }

  if (!carregado) return <div className="page"><div className="skeleton" style={{ height: 200, borderRadius: 14 }} /></div>

  return (
    <div className="page">
      <div className="section-label mb-2">🎂 Tela de Parabéns (aniversário)</div>

      <div style={{ background: 'white', borderRadius: 14, padding: '16px 18px', boxShadow: 'var(--shadow-sm)', marginBottom: 12 }}>
        <div className="form-group">
          <label className="form-label">Título (linha de cima)</label>
          <input className="form-input" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={TITULO_PADRAO} />
        </div>
        <div className="form-group">
          <label className="form-label">Mensagem</label>
          <textarea className="form-input" value={mensagem} onChange={e => setMensagem(e.target.value)} rows={4} style={{ resize: 'vertical' }} placeholder={MSG_PADRAO} />
        </div>

        <button type="button" onClick={() => setAvisar(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', border: `2px solid ${avisar ? 'var(--primary)' : 'var(--border)'}`, background: avisar ? 'var(--primary-light)' : 'white', marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>🔔</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: avisar ? 'var(--primary-dark)' : 'var(--text2)' }}>Avisar líderes e admins</p>
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>Eles recebem "Hoje é aniversário de Fulano!" no celular.</p>
          </div>
          <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${avisar ? 'var(--primary)' : 'var(--border)'}`, background: avisar ? 'var(--primary)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {avisar && <span className="icon" style={{ fontSize: 14, color: 'white' }}>check</span>}
          </div>
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        <button className="btn btn-ghost" onClick={testar}><span className="icon icon-sm">visibility</span> Ver / testar</button>
      </div>

      <p className="form-hint" style={{ marginTop: 12 }}>
        No dia do aniversário, a pessoa vê essa tela ao abrir o app (com confete e som), 1x no dia. "Ver / testar" mostra como fica agora, sem afetar ninguém.
      </p>

      {preview && profile && <ParabensAniversario profile={profile} preview={preview} onFecharPreview={() => setPreview(null)} />}
    </div>
  )
}
