import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'

// Tela do evento pra TRANSMITIR — pública (abre sem login), travada (sem menu do
// app). A pessoa edita TUDO (nome, cor, fonte, %, fundo) e salva como IMAGEM 16:9.
// Rota: /tela  (App.tsx renderiza isto ANTES do login quando o caminho começa com /tela)

const FONTES = [
  { nome: 'Cinzel Decorative', css: "'Cinzel Decorative', serif" },
  { nome: 'Cinzel',            css: "'Cinzel', serif" },
  { nome: 'Cormorant',         css: "'Cormorant Garamond', serif" },
  { nome: 'Playfair',          css: "'Playfair Display', serif" },
  { nome: 'Cardo',             css: "'Cardo', serif" },
  { nome: 'Anton',             css: "'Anton', sans-serif" },
]
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@600;800&family=Cormorant+Garamond:wght@600;700&family=Playfair+Display:wght@700;900&family=Cardo:wght@700&display=swap'

const LARG = 1280, ALT = 720   // 16:9 — tamanho real da imagem exportada

export default function TelaEvento() {
  const params = new URLSearchParams(window.location.search)
  const [nome, setNome]       = useState(params.get('nome') || 'Encontro com Deus 2026')
  const [cor, setCor]         = useState('#ffffff')
  const [fonte, setFonte]     = useState(FONTES[0].css)
  const [pct, setPct]         = useState(Number(params.get('pct')) || 16)
  const [bgUrl, setBgUrl]     = useState<string | null>(null)
  const [bgCor, setBgCor]     = useState('#4a2f6b')
  const [escuro, setEscuro]   = useState(0.45)
  const [corBarra, setCorBarra] = useState('#ffffff')
  const [mostrarNome, setMostrarNome] = useState(true)
  const [mostrarBarra, setMostrarBarra] = useState(true)
  const [painel, setPainel]   = useState(true)
  const [salvando, setSalvando] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const telaRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fit, setFit] = useState(1)

  // carrega as fontes decorativas (só nesta página)
  useEffect(() => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_URL
    document.head.appendChild(l)
    return () => { try { document.head.removeChild(l) } catch {} }
  }, [])

  // encolhe a tela 16:9 pra caber na área (na exportação sai em tamanho real)
  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const calc = () => { const w = el.clientWidth, h = el.clientHeight; if (w > 0 && h > 0) setFit(Math.min(1, (w - 24) / LARG, (h - 24) / ALT)) }
    calc()
    const ro = new ResizeObserver(calc); ro.observe(el)
    window.addEventListener('resize', calc)
    return () => { ro.disconnect(); window.removeEventListener('resize', calc) }
  }, [])

  function escolherFundo(f: File) { setBgUrl(URL.createObjectURL(f)) }

  async function salvarImagem() {
    if (!telaRef.current) return
    setSalvando(true)
    try {
      await (document as any).fonts?.ready
      const dataUrl = await toPng(telaRef.current, { cacheBust: true, pixelRatio: 2, width: LARG, height: ALT, backgroundColor: bgUrl ? undefined : bgCor })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${(nome || 'tela').replace(/[^\w\s-]/g, '').trim() || 'tela'}.png`
      a.click()
    } catch { alert('Não consegui gerar a imagem. Tente de novo.') }
    setSalvando(false)
  }

  function copiarLink() {
    const url = window.location.origin + '/tela'
    navigator.clipboard?.writeText(url).then(() => alert('Link copiado! Qualquer um abre (sem login).'), () => {})
  }

  function telaCheia() {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else (document.documentElement as any).requestFullscreen?.()
  }

  const bgStyle: React.CSSProperties = bgUrl
    ? { backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: bgCor }

  const botao: React.CSSProperties = { background: '#2a2a2a', color: '#eee', border: '1px solid #444', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }
  const campo: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 }
  const rotulo: React.CSSProperties = { fontSize: 11, color: '#aaa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }
  const inputTxt: React.CSSProperties = { padding: '9px 10px', borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', fontFamily: 'inherit', fontSize: 14 }
  const corInput: React.CSSProperties = { width: 40, height: 30, borderRadius: 6, border: '1px solid #444', background: 'none', cursor: 'pointer', padding: 1 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0d0d0d', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Barra de ações (fora da imagem) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#161616', flexShrink: 0, flexWrap: 'wrap', borderBottom: '1px solid #262626' }}>
        <button onClick={salvarImagem} disabled={salvando} style={{ ...botao, background: '#2F855A', color: '#fff', border: 'none', opacity: salvando ? 0.6 : 1 }}>
          {salvando ? 'Gerando...' : '💾 Salvar imagem'}
        </button>
        <button onClick={() => setPainel(v => !v)} style={botao}>{painel ? 'Esconder edição' : '✏️ Editar'}</button>
        <button onClick={telaCheia} style={botao}>⛶ Tela cheia</button>
        <button onClick={copiarLink} style={botao}>🔗 Copiar link</button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#777' }}>Edite tudo e salve a imagem pra transmitir</span>
      </div>

      {/* Área da tela 16:9 (encolhida pra caber; exporta em 1280×720) */}
      <div ref={wrapRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ width: LARG * fit, height: ALT * fit, flexShrink: 0, boxShadow: '0 6px 30px rgba(0,0,0,0.6)' }}>
          <div ref={telaRef} style={{ width: LARG, height: ALT, transform: `scale(${fit})`, transformOrigin: 'top left', position: 'relative', overflow: 'hidden', ...bgStyle }}>
            {bgUrl && <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${escuro})` }} />}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44, padding: '7%', textAlign: 'center' }}>
              {mostrarNome && (
                <div style={{ fontFamily: fonte, fontSize: 76, fontWeight: 700, color: cor, lineHeight: 1.1, textShadow: '0 3px 14px rgba(0,0,0,0.5)' }}>{nome}</div>
              )}
              {mostrarBarra && (
                <div style={{ width: '78%', display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ height: 36, background: 'rgba(255,255,255,0.28)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: corBarra, borderRadius: 99 }} />
                  </div>
                  <div style={{ fontFamily: fonte, fontSize: 60, fontWeight: 700, color: cor, textShadow: '0 3px 14px rgba(0,0,0,0.5)' }}>{pct}%</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Painel de edição */}
      {painel && (
        <div style={{ background: '#161616', borderTop: '1px solid #262626', padding: '14px 16px', flexShrink: 0, maxHeight: '42vh', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
          <div style={campo}>
            <span style={rotulo}>Nome</span>
            <input style={inputTxt} value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do evento" />
          </div>
          <div style={campo}>
            <span style={rotulo}>Fonte</span>
            <select style={{ ...inputTxt, cursor: 'pointer' }} value={fonte} onChange={e => setFonte(e.target.value)}>
              {FONTES.map(f => <option key={f.nome} value={f.css}>{f.nome}</option>)}
            </select>
          </div>
          <div style={campo}>
            <span style={rotulo}>Cor do texto</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" style={corInput} value={cor} onChange={e => setCor(e.target.value)} />
              {['#ffffff', '#111111', '#F6E05E', '#F6AD55'].map(c => <button key={c} onClick={() => setCor(c)} style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid #444', background: c, cursor: 'pointer' }} />)}
            </div>
          </div>
          <div style={campo}>
            <span style={rotulo}>Progresso ({pct}%)</span>
            <input type="range" min={0} max={100} value={pct} onChange={e => setPct(Number(e.target.value))} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#aaa' }}>cor da barra</span>
              <input type="color" style={corInput} value={corBarra} onChange={e => setCorBarra(e.target.value)} />
            </div>
          </div>
          <div style={campo}>
            <span style={rotulo}>Fundo</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button style={botao} onClick={() => fileRef.current?.click()}>🖼️ Trocar imagem</button>
              {bgUrl && <button style={{ ...botao, borderColor: '#833' }} onClick={() => setBgUrl(null)}>Tirar</button>}
              {!bgUrl && <input type="color" style={corInput} value={bgCor} onChange={e => setBgCor(e.target.value)} />}
            </div>
            {bgUrl && (
              <label style={{ fontSize: 11, color: '#aaa' }}>Escurecer o fundo ({Math.round(escuro * 100)}%)
                <input type="range" min={0} max={0.85} step={0.05} value={escuro} onChange={e => setEscuro(Number(e.target.value))} style={{ width: '100%' }} />
              </label>
            )}
          </div>
          <div style={campo}>
            <span style={rotulo}>Mostrar</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setMostrarNome(v => !v)} style={{ ...botao, borderColor: mostrarNome ? '#2F855A' : '#444' }}>{mostrarNome ? '✓ ' : ''}Nome</button>
              <button onClick={() => setMostrarBarra(v => !v)} style={{ ...botao, borderColor: mostrarBarra ? '#2F855A' : '#444' }}>{mostrarBarra ? '✓ ' : ''}Barra</button>
            </div>
          </div>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && escolherFundo(e.target.files[0])} />
    </div>
  )
}
