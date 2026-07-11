import { useEffect, useMemo, useState } from 'react'
import { carregarConfig, salvarConfig } from '../lib/tema'
import { useRegistrarChromeAdmin } from '../lib/chrome'
import { toast } from '../components/Toast'
import ParabensAniversario, { MSG_PADRAO, TITULO_PADRAO } from '../components/ParabensAniversario'
import { AREAS, REGRAS, carregarRegrasNotif, salvarRegrasNotif } from '../lib/notifRegras'
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

  useRegistrarChromeAdmin()   // mesmo menu ⚙️ das outras telas admin

  // Regras de notificação (liga/desliga cada evento)
  const [regras, setRegras] = useState<Record<string, boolean>>({})
  const [salvandoRegras, setSalvandoRegras] = useState(false)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    ;(async () => {
      const [t, m, a, rg] = await Promise.all([
        carregarConfig('aniversario_titulo'), carregarConfig('aniversario_mensagem'), carregarConfig('aniversario_avisar_lideres'),
        carregarRegrasNotif(true),
      ])
      if (t) setTitulo(t)
      if (m) setMensagem(m)
      if (a === '0') setAvisar(false)
      const init: Record<string, boolean> = {}
      for (const r of REGRAS) init[r.key] = rg[r.key] ?? r.padrao
      setRegras(init)
      setCarregado(true)
    })()
  }, [])

  function toggleRegra(key: string) { setRegras(p => ({ ...p, [key]: !p[key] })) }
  function setTodas(v: boolean) { const n: Record<string, boolean> = {}; for (const r of REGRAS) n[r.key] = v; setRegras(n) }
  function setArea(areaId: string, v: boolean) { setRegras(p => { const n = { ...p }; for (const r of REGRAS) if (r.area === areaId) n[r.key] = v; return n }) }
  async function salvarRegras() {
    setSalvandoRegras(true)
    const ok = await salvarRegrasNotif(regras)
    setSalvandoRegras(false)
    ok ? toast.sucesso('Regras salvas!') : toast.falha('Não foi possível salvar.')
  }
  const ligadas = REGRAS.filter(r => regras[r.key]).length
  const areasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return AREAS.map(a => ({ area: a, regras: REGRAS.filter(r => r.area === a.id && (!q || r.label.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q))) }))
              .filter(g => g.regras.length > 0)
  }, [busca])

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
      {/* ===== Regras de notificação ===== */}
      <div className="section-label mb-2">🔔 Regras de notificação</div>
      <div style={{ background:'white', borderRadius:14, padding:'14px 16px', boxShadow:'var(--shadow-sm)', marginBottom:16 }}>
        <p style={{ fontSize:12, color:'var(--muted)', marginBottom:12 }}>Ligue só o que você quer que vire notificação. <b>{ligadas}</b> de {REGRAS.length} ligadas. O ⏱ depende do agendador (avisos por horário).</p>

        <div className="search-bar" style={{ marginBottom:10 }}>
          <span className="icon icon-sm" style={{ color:'var(--muted-light)' }}>search</span>
          <input placeholder="Buscar regra..." value={busca} onChange={e => setBusca(e.target.value)} />
          {busca && <button onClick={() => setBusca('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted-light)', padding:0, fontFamily:'inherit' }}><span className="icon icon-sm">close</span></button>}
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:6 }}>
          <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => setTodas(true)}>Ligar todas</button>
          <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => setTodas(false)}>Desligar todas</button>
        </div>

        {areasFiltradas.map(({ area, regras: rs }) => {
          const todasOn = rs.every(r => regras[r.key])
          return (
            <div key={area.id} style={{ marginTop:12 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <p style={{ fontSize:13, fontWeight:800 }}>{area.emoji} {area.nome}</p>
                <button onClick={() => setArea(area.id, !todasOn)} style={{ background:'none', border:'none', color:'var(--primary)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{todasOn ? 'Desligar área' : 'Ligar área'}</button>
              </div>
              {rs.map(r => {
                const on = !!regras[r.key]
                return (
                  <button key={r.key} onClick={() => toggleRegra(r.key)} style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'10px 4px', background:'none', border:'none', borderBottom:'1px solid var(--border)', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:14, fontWeight:600 }}>{r.label} {r.agendado && <span style={{ fontSize:10, fontWeight:700, color:'#B7791F', background:'#FFFBEB', borderRadius:6, padding:'1px 5px' }}>⏱ agendador</span>} {r.pendente && <span style={{ fontSize:10, fontWeight:700, color:'var(--muted)', background:'var(--bg)', borderRadius:6, padding:'1px 5px' }}>em breve</span>}</p>
                      <p style={{ fontSize:11, color:'var(--muted)' }}>{r.desc}</p>
                    </div>
                    <span style={{ width:44, height:26, borderRadius:99, background:on ? 'var(--success)' : 'var(--border)', position:'relative', flexShrink:0, transition:'background .15s' }}>
                      <span style={{ position:'absolute', top:3, left:on ? 21 : 3, width:20, height:20, borderRadius:'50%', background:'white', transition:'left .15s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }} />
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}

        <button className="btn btn-primary btn-full" style={{ marginTop:16 }} onClick={salvarRegras} disabled={salvandoRegras}>{salvandoRegras ? 'Salvando...' : 'Salvar regras'}</button>
      </div>

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
        No dia do aniversário, a pessoa vê essa tela ao abrir o app (com confete e som) — <b>uma vez só</b>, mesmo que ela abra em vários aparelhos. "Ver / testar" mostra como fica agora, sem afetar ninguém.
      </p>

      {preview && profile && <ParabensAniversario profile={profile} preview={preview} onFecharPreview={() => setPreview(null)} />}
    </div>
  )
}
