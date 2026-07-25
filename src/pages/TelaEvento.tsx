import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { supabase } from '../lib/supabase'
import { carregarConfig, salvarConfig } from '../lib/tema'

// Tela do evento pra TRANSMITIR — pública (abre sem login), travada (sem menu).
// • A barra de progresso é AO VIVO (consulta o evento a cada 10s — RPC tela_progresso).
// • "Salvar pra todos" (admin) grava a APARÊNCIA (nome, cor, fonte, fundo…) e todo
//   mundo que abrir o link passa a ver igual.
// • "Salvar imagem" exporta o 16:9 em PNG pra jogar na TV/projetor.
// Rota /tela é renderizada no App.tsx ANTES do login.

const FONTES = [
  { nome: 'Cinzel Decorative', css: "'Cinzel Decorative', serif" },
  { nome: 'Cinzel',            css: "'Cinzel', serif" },
  { nome: 'Playfair Display',  css: "'Playfair Display', serif" },
  { nome: 'Cormorant',         css: "'Cormorant Garamond', serif" },
  { nome: 'EB Garamond',       css: "'EB Garamond', serif" },
  { nome: 'Marcellus',         css: "'Marcellus', serif" },
  { nome: 'Forum',             css: "'Forum', serif" },
  { nome: 'Cardo',             css: "'Cardo', serif" },
  { nome: 'Fraunces',          css: "'Fraunces', serif" },
  { nome: 'Abril Fatface',     css: "'Abril Fatface', serif" },
  { nome: 'Great Vibes (script)', css: "'Great Vibes', cursive" },
  { nome: 'Dancing Script',    css: "'Dancing Script', cursive" },
  { nome: 'Sacramento',        css: "'Sacramento', cursive" },
  { nome: 'Parisienne',        css: "'Parisienne', cursive" },
  { nome: 'Allura',            css: "'Allura', cursive" },
  { nome: 'Pinyon Script',     css: "'Pinyon Script', cursive" },
  { nome: 'Tangerine',         css: "'Tangerine', cursive" },
  { nome: 'Bebas Neue',        css: "'Bebas Neue', sans-serif" },
  { nome: 'Oswald',            css: "'Oswald', sans-serif" },
  { nome: 'Anton',             css: "'Anton', sans-serif" },
]
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Cormorant+Garamond:wght@600;700&family=EB+Garamond:wght@600;700&family=Cinzel:wght@600;800&family=Cinzel+Decorative:wght@700;900&family=Marcellus&family=Forum&family=Cardo:wght@700&family=Fraunces:wght@600;900&family=Abril+Fatface&family=Great+Vibes&family=Dancing+Script:wght@700&family=Sacramento&family=Parisienne&family=Allura&family=Pinyon+Script&family=Tangerine:wght@700&family=Bebas+Neue&family=Oswald:wght@600;700&family=Anton&display=swap'

const LARG = 1920, ALT = 1080   // Full HD 16:9
const CHAVE = 'tela_config'
// alças do quadrado de seleção: cantos (nwse/nesw) = tamanho; lados = largura/altura
const ALCAS = [
  { k: 'nw', x: 0,   y: 0,   c: 'nwse-resize' },
  { k: 'n',  x: 0.5, y: 0,   c: 'ns-resize' },
  { k: 'ne', x: 1,   y: 0,   c: 'nesw-resize' },
  { k: 'e',  x: 1,   y: 0.5, c: 'ew-resize' },
  { k: 'se', x: 1,   y: 1,   c: 'nwse-resize' },
  { k: 's',  x: 0.5, y: 1,   c: 'ns-resize' },
  { k: 'sw', x: 0,   y: 1,   c: 'nesw-resize' },
  { k: 'w',  x: 0,   y: 0.5, c: 'ew-resize' },
]

export default function TelaEvento() {
  // ?apresentar=1 (ou ?limpo / ?holyrics / ?tv) já abre no MODO LIMPO — é o link pra colar no Holyrics/projetor
  const modoLimpo = (() => {
    try {
      const p = new URLSearchParams(window.location.search)
      return p.get('apresentar') === '1' || p.has('limpo') || p.has('holyrics') || p.has('tv')
    } catch { return false }
  })()

  const [nome, setNome]       = useState('Encontro com Deus 2026')
  const [cor, setCor]         = useState('#ffffff')
  const [fonte, setFonte]     = useState(FONTES[0].css)
  const [pct, setPct]         = useState(0)          // AO VIVO (poll)
  const [bg, setBg]           = useState<string | null>(null)   // url (público) ou blob local
  const [bgFile, setBgFile]   = useState<File | null>(null)     // arquivo local aguardando upload
  const [bgCor, setBgCor]     = useState('#4a2f6b')
  const [escuro, setEscuro]   = useState(0.45)
  const [corBarra, setCorBarra] = useState('#ffffff')
  const [mostrarNome, setMostrarNome] = useState(true)
  const [mostrarBarra, setMostrarBarra] = useState(true)
  const [nomeTam, setNomeTam]     = useState(84)   // tamanho da fonte do nome (px)
  const [nomeLarg, setNomeLarg]   = useState(100)  // largura da fonte do nome (%) — esticar/alargar
  const [nomeAlt, setNomeAlt]     = useState(100)  // altura da fonte do nome (%) — esticar vertical
  const [pctTam, setPctTam]       = useState(62)   // tamanho da fonte do número %
  const [barraLarg, setBarraLarg] = useState(78)   // largura da barra (% da tela)
  const [barraAlt, setBarraAlt]   = useState(36)   // altura da barra (px)
  const [painel, setPainel]   = useState(true)
  const [apresentar, setApresentar] = useState(modoLimpo)   // modo transmissão: só o 16:9, sem botões
  const [embutido] = useState(modoLimpo)   // veio pela URL (Holyrics/TV): sem botão de sair, sem fullscreen forçado
  const [salvando, setSalvando] = useState(false)
  const [salvandoCfg, setSalvandoCfg] = useState(false)
  const [souLogado, setSouLogado] = useState(false)
  const [msg, setMsg] = useState('')

  const wrapRef = useRef<HTMLDivElement>(null)
  const telaRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fit, setFit] = useState(1)
  // posições (no espaço 1280×720; o ponto é o CENTRO do elemento)
  const [nomePos, setNomePos]   = useState({ x: LARG / 2, y: 300 })
  const [barraPos, setBarraPos] = useState({ x: LARG / 2, y: 500 })
  const [guias, setGuias] = useState({ v: false, h: false })
  const dragRef = useRef<{ alvo: 'nome' | 'barra'; x0: number; y0: number; px: number; py: number } | null>(null)
  // redimensionar o nome (quadrado de seleção com alças)
  const nomeSpanRef = useRef<HTMLSpanElement>(null)
  const [nomeW0, setNomeW0] = useState(300)   // largura natural do nome (100%), px do 1280
  const [nomeH0, setNomeH0] = useState(90)    // altura natural do nome (100%), px do 1280
  const [sel, setSel] = useState<'nome' | null>(null)   // o que está selecionado
  const resizeRef = useRef<{ h: string; x0: number; y0: number; tam: number; larg: number; alt: number; w0: number; h0: number } | null>(null)

  // Fontes (só nesta página)
  useEffect(() => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_URL
    document.head.appendChild(l)
    return () => { try { document.head.removeChild(l) } catch {} }
  }, [])

  // Tem sessão? (só logado salva pra todos)
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSouLogado(!!data.session)) }, [])

  // Carrega a aparência salva (pública) — e recarrega a cada 30s pra pegar mudanças
  useEffect(() => {
    let vivo = true
    const carregar = async () => {
      const raw = await carregarConfig(CHAVE)
      if (!vivo || !raw) return
      try {
        const c = JSON.parse(raw)
        if (c.nome != null) setNome(c.nome)
        if (c.cor) setCor(c.cor)
        if (c.fonte) setFonte(c.fonte)
        if (c.corBarra) setCorBarra(c.corBarra)
        if (c.bgCor) setBgCor(c.bgCor)
        if (typeof c.escuro === 'number') setEscuro(c.escuro)
        if (typeof c.mostrarNome === 'boolean') setMostrarNome(c.mostrarNome)
        if (typeof c.mostrarBarra === 'boolean') setMostrarBarra(c.mostrarBarra)
        if (c.nomePos && !dragRef.current) setNomePos(c.nomePos)
        if (c.barraPos && !dragRef.current) setBarraPos(c.barraPos)
        if (typeof c.nomeTam === 'number') setNomeTam(c.nomeTam)
        if (typeof c.nomeLarg === 'number') setNomeLarg(c.nomeLarg)
        if (typeof c.nomeAlt === 'number') setNomeAlt(c.nomeAlt)
        if (typeof c.pctTam === 'number') setPctTam(c.pctTam)
        if (typeof c.barraLarg === 'number') setBarraLarg(c.barraLarg)
        if (typeof c.barraAlt === 'number') setBarraAlt(c.barraAlt)
        if (!bgFile) setBg(c.bg ?? null)   // não sobrescreve um fundo que a pessoa acabou de escolher
      } catch {}
    }
    carregar()
    // só quem ASSISTE (não logado) recarrega sozinho — pra não atropelar quem edita
    const t = souLogado ? null : setInterval(carregar, 30000)
    return () => { vivo = false; if (t) clearInterval(t) }
  }, [souLogado])

  // Progresso AO VIVO (a cada 10s)
  useEffect(() => {
    let vivo = true
    const puxar = async () => {
      const { data } = await supabase.rpc('tela_progresso')
      if (vivo && data && typeof (data as any).pct === 'number') setPct((data as any).pct)
    }
    puxar()
    const t = setInterval(puxar, 10000)
    return () => { vivo = false; clearInterval(t) }
  }, [])

  // Encolhe a tela 16:9 pra caber (exporta em tamanho real)
  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const calc = () => {
      const w = el.clientWidth, h = el.clientHeight; if (w <= 0 || h <= 0) return
      // apresentar (Holyrics/projetor): ENCHE a tela — pode passar de 100% e sem margem.
      // editando: cabe com uma margem e nunca passa de 100% (pra ver o slide inteiro).
      setFit(apresentar ? Math.min(w / LARG, h / ALT) : Math.min(1, (w - 24) / LARG, (h - 24) / ALT))
    }
    calc()
    const ro = new ResizeObserver(calc); ro.observe(el)
    window.addEventListener('resize', calc)
    return () => { ro.disconnect(); window.removeEventListener('resize', calc) }
  }, [apresentar])

  function escolherFundo(f: File) { setBgFile(f); setBg(URL.createObjectURL(f)) }

  // ---- Arrastar nome/barra dentro da imagem, com encaixe no centro ----
  function onDown(e: React.PointerEvent, alvo: 'nome' | 'barra') {
    if (apresentar) return
    e.stopPropagation(); e.preventDefault()
    setSel(alvo === 'nome' ? 'nome' : null)   // clicar no nome seleciona (mostra o quadrado)
    const pos = alvo === 'nome' ? nomePos : barraPos
    dragRef.current = { alvo, x0: e.clientX, y0: e.clientY, px: pos.x, py: pos.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function onMove(e: React.PointerEvent) {
    const d = dragRef.current; if (!d) return
    let nx = d.px + (e.clientX - d.x0) / fit
    let ny = d.py + (e.clientY - d.y0) / fit
    const perto = 16
    const cv = Math.abs(nx - LARG / 2) < perto, ch = Math.abs(ny - ALT / 2) < perto
    if (cv) nx = LARG / 2
    if (ch) ny = ALT / 2
    setGuias(g => (g.v === cv && g.h === ch ? g : { v: cv, h: ch }))
    nx = Math.max(0, Math.min(LARG, nx)); ny = Math.max(0, Math.min(ALT, ny))
    if (d.alvo === 'nome') setNomePos({ x: nx, y: ny }); else setBarraPos({ x: nx, y: ny })
  }
  function onUp() { dragRef.current = null; setGuias({ v: false, h: false }) }

  // mede a largura/altura natural do nome (100%) sempre que texto/fonte/tamanho mudam
  useEffect(() => {
    const el = nomeSpanRef.current; if (!el) return
    setNomeW0(el.offsetWidth); setNomeH0(el.offsetHeight)
  }, [nome, fonte, nomeTam, mostrarNome])

  const trava = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n)))

  // ---- Redimensionar o nome pelas alças do quadrado ----
  // cantos (nw/ne/se/sw) = tamanho da fonte (uniforme); e/w = largura; n/s = altura
  function onResizeDown(e: React.PointerEvent, h: string) {
    e.stopPropagation(); e.preventDefault()
    resizeRef.current = { h, x0: e.clientX, y0: e.clientY, tam: nomeTam, larg: nomeLarg, alt: nomeAlt, w0: nomeW0, h0: nomeH0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function onResizeMove(e: React.PointerEvent) {
    const d = resizeRef.current; if (!d) return
    const dx = (e.clientX - d.x0) / fit, dy = (e.clientY - d.y0) / fit
    const h = d.h
    if (h === 'e' || h === 'w') {
      const dir = h === 'e' ? 1 : -1
      setNomeLarg(trava(d.larg + (dir * dx / Math.max(20, d.w0 / 2)) * 100, 40, 320))
    } else if (h === 'n' || h === 's') {
      const dir = h === 's' ? 1 : -1
      setNomeAlt(trava(d.alt + (dir * dy / Math.max(10, d.h0 / 2)) * 100, 40, 320))
    } else {
      // canto: escala uniforme = mexe no tamanho da fonte
      const dirX = (h === 'ne' || h === 'se') ? 1 : -1
      const meia = Math.max(20, (d.w0 * (d.larg / 100)) / 2)
      const fator = Math.max(0.2, (meia + dirX * dx) / meia)
      setNomeTam(trava(d.tam * fator, 16, 400))
    }
  }
  function onResizeUp() { resizeRef.current = null }

  // linha de slider (é função, não componente — não remonta a cada render)
  function slider(rot: string, val: number, set: (n: number) => void, min: number, max: number, step = 1, suf = 'px') {
    return (
      <label style={{ fontSize: 11, color: '#aaa', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span>{rot} <b style={{ color: '#ddd' }}>{val}{suf}</b></span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" onClick={() => set(Math.max(min, val - step))} style={{ ...botao, padding: '2px 9px', fontSize: 15 }}>−</button>
          <input type="range" min={min} max={max} step={step} value={val} onChange={e => set(Number(e.target.value))} style={{ flex: 1 }} />
          <button type="button" onClick={() => set(Math.min(max, val + step))} style={{ ...botao, padding: '2px 9px', fontSize: 15 }}>+</button>
        </div>
      </label>
    )
  }

  async function salvarImagem() {
    if (!telaRef.current) return
    setSalvando(true)
    try {
      await (document as any).fonts?.ready
      const dataUrl = await toPng(telaRef.current, { cacheBust: true, pixelRatio: 2, width: LARG, height: ALT, backgroundColor: bg ? undefined : bgCor })
      const a = document.createElement('a')
      a.href = dataUrl; a.download = `${(nome || 'tela').replace(/[^\w\s-]/g, '').trim() || 'tela'}.png`; a.click()
    } catch { alert('Não consegui gerar a imagem. Tente de novo.') }
    setSalvando(false)
  }

  async function salvarParaTodos() {
    setSalvandoCfg(true); setMsg('')
    try {
      let bgFinal = bg
      if (bgFile) {
        // sobe o fundo pra um lugar público (bucket pessoas) pra todo mundo enxergar
        const path = `tela/fundo_${Date.now()}.jpg`
        const { error: eUp } = await supabase.storage.from('pessoas').upload(path, bgFile, { upsert: true, contentType: bgFile.type || 'image/jpeg' })
        if (eUp) throw eUp
        bgFinal = supabase.storage.from('pessoas').getPublicUrl(path).data.publicUrl
      }
      const cfg = { nome, cor, fonte, corBarra, bg: bgFinal, bgCor, escuro, mostrarNome, mostrarBarra, nomePos, barraPos, nomeTam, nomeLarg, nomeAlt, pctTam, barraLarg, barraAlt }
      const ok = await salvarConfig(CHAVE, JSON.stringify(cfg))
      if (!ok) { setMsg('Só o admin salva pra todos. (Você pode salvar a imagem.)'); }
      else { setBg(bgFinal); setBgFile(null); setMsg('✓ Salvo! Todo mundo que abrir o link vê assim.') }
    } catch { setMsg('Não consegui salvar. Tente de novo.') }
    setSalvandoCfg(false)
    setTimeout(() => setMsg(''), 4000)
  }

  function copiarLink() {
    const url = window.location.origin + '/tela'
    const nav: any = navigator
    if (nav.share) nav.share({ title: 'Tela do evento', url }).catch(() => {})
    else nav.clipboard?.writeText(url).then(() => setMsg('🔗 Link de edição copiado! Abre sem login.'), () => {})
    setTimeout(() => setMsg(''), 4000)
  }
  // Link LIMPO pra colar no Holyrics/projetor: abre já em tela cheia, sem barra/edição.
  function copiarLinkHolyrics() {
    const url = window.location.origin + '/tela?apresentar=1'
    const nav: any = navigator
    nav.clipboard?.writeText(url).then(
      () => setMsg('📺 Link copiado! Cole no Holyrics → ' + url),
      () => setMsg('Copie este link: ' + url),
    )
    setTimeout(() => setMsg(''), 9000)
  }
  function entrarApresentar() { setApresentar(true); try { (document.documentElement as any).requestFullscreen?.() } catch {} }
  function sairApresentar() { setApresentar(false); try { if (document.fullscreenElement) document.exitFullscreen?.() } catch {} }
  // Esc sai da apresentação
  useEffect(() => {
    if (!apresentar || embutido) return   // embutido (link do Holyrics): Esc não revela a edição
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setApresentar(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [apresentar, embutido])

  const bgStyle: React.CSSProperties = bg
    ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: bgCor }

  // caixa de seleção do nome (px do 1280); alças com tamanho fixo na tela (÷ fit)
  const selW = Math.max(20, nomeW0 * (nomeLarg / 100))
  const selH = Math.max(16, nomeH0 * (nomeAlt / 100))
  const hs = 15 / fit          // tamanho da alça (~15px na tela)
  const bw = 1.5 / fit         // espessura da borda

  const botao: React.CSSProperties = { background: '#2a2a2a', color: '#eee', border: '1px solid #444', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }
  const campo: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 }
  const rotulo: React.CSSProperties = { fontSize: 11, color: '#aaa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }
  const inputTxt: React.CSSProperties = { padding: '9px 10px', borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', fontFamily: 'inherit', fontSize: 14 }
  const corInput: React.CSSProperties = { width: 40, height: 30, borderRadius: 6, border: '1px solid #444', background: 'none', cursor: 'pointer', padding: 1 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0d0d0d', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {!apresentar && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#161616', flexShrink: 0, flexWrap: 'wrap', borderBottom: '1px solid #262626' }}>
          {souLogado && (
            <button type="button" onClick={salvarParaTodos} disabled={salvandoCfg} style={{ ...botao, background: '#2B6CB0', color: '#fff', border: 'none', opacity: salvandoCfg ? 0.6 : 1 }}>
              {salvandoCfg ? 'Salvando...' : '☁️ Salvar pra todos'}
            </button>
          )}
          <button type="button" onClick={salvarImagem} disabled={salvando} style={{ ...botao, background: '#2F855A', color: '#fff', border: 'none', opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Gerando...' : '💾 Salvar imagem'}
          </button>
          <button type="button" onClick={() => setPainel(v => !v)} style={botao}>{painel ? 'Esconder edição' : '✏️ Editar'}</button>
          <button type="button" onClick={entrarApresentar} style={{ ...botao, background: '#6B46C1', color: '#fff', border: 'none' }}>▶ Apresentar</button>
          <button type="button" onClick={copiarLinkHolyrics} style={{ ...botao, background: '#B7791F', color: '#fff', border: 'none' }}>📺 Link p/ Holyrics</button>
          <button type="button" onClick={copiarLink} style={botao}>🔗 Link (editar)</button>
          {msg && <span style={{ fontSize: 12, color: '#8fd', fontWeight: 700 }}>{msg}</span>}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#777' }}>barra ao vivo · edite e salve</span>
        </div>
      )}

      <div ref={wrapRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, overflow: 'hidden', background: apresentar ? '#000' : undefined }}>
        <div style={{ width: LARG * fit, height: ALT * fit, flexShrink: 0, boxShadow: apresentar ? 'none' : '0 6px 30px rgba(0,0,0,0.6)' }}>
          <div ref={telaRef} onPointerDown={() => { if (!apresentar) setSel(null) }}
            style={{ width: LARG, height: ALT, transform: `scale(${fit})`, transformOrigin: 'top left', position: 'relative', overflow: 'hidden', ...bgStyle }}>
            {bg && <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${escuro})` }} />}

            {mostrarNome && (
              <div onPointerDown={e => onDown(e, 'nome')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                style={{ position: 'absolute', left: nomePos.x, top: nomePos.y, transform: 'translate(-50%,-50%)', cursor: apresentar ? 'default' : 'move', touchAction: 'none',
                  fontFamily: fonte, fontSize: nomeTam, fontWeight: 700, color: cor, lineHeight: 1.1, textAlign: 'center', textShadow: '0 3px 14px rgba(0,0,0,0.5)', userSelect: 'none', whiteSpace: 'nowrap' }}>
                <span ref={nomeSpanRef} style={{ display: 'inline-block', transform: `scale(${nomeLarg / 100},${nomeAlt / 100})`, transformOrigin: 'center' }}>{nome}</span>
              </div>
            )}
            {/* quadrado de seleção do nome (só editando, quando selecionado) */}
            {mostrarNome && !apresentar && sel === 'nome' && (
              <div style={{ position: 'absolute', left: nomePos.x - selW / 2, top: nomePos.y - selH / 2, width: selW, height: selH, border: `${bw}px dashed #6B46C1`, boxSizing: 'border-box', pointerEvents: 'none' }}>
                {ALCAS.map(a => (
                  <div key={a.k} onPointerDown={e => onResizeDown(e, a.k)} onPointerMove={onResizeMove} onPointerUp={onResizeUp} onPointerCancel={onResizeUp}
                    style={{ position: 'absolute', left: a.x * selW, top: a.y * selH, width: hs, height: hs, transform: 'translate(-50%,-50%)', background: '#fff', border: `${bw}px solid #6B46C1`, borderRadius: 3 / fit, cursor: a.c, touchAction: 'none', pointerEvents: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
                ))}
              </div>
            )}
            {mostrarBarra && (
              <div onPointerDown={e => onDown(e, 'barra')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                style={{ position: 'absolute', left: barraPos.x, top: barraPos.y, transform: 'translate(-50%,-50%)', width: LARG * (barraLarg / 100), cursor: apresentar ? 'default' : 'move', touchAction: 'none', display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
                <div style={{ width: '100%', height: barraAlt, background: 'rgba(255,255,255,0.28)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: corBarra, borderRadius: 99, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ fontFamily: fonte, fontSize: pctTam, fontWeight: 700, color: cor, textShadow: '0 3px 14px rgba(0,0,0,0.5)' }}>{pct}%</div>
              </div>
            )}

            {/* linhas de centro (aparecem só ao arrastar; não entram na imagem salva) */}
            {guias.v && <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, marginLeft: -1, background: '#E24B4A', pointerEvents: 'none' }} />}
            {guias.h && <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, marginTop: -1, background: '#E24B4A', pointerEvents: 'none' }} />}
          </div>
        </div>
      </div>

      {apresentar && !embutido && (
        <button type="button" onClick={sairApresentar}
          style={{ position: 'fixed', top: 14, right: 14, zIndex: 10, width: 40, height: 40, borderRadius: 20, border: 'none', background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Sair da apresentação (Esc)">✕</button>
      )}

      {painel && !apresentar && (
        <div style={{ background: '#161616', borderTop: '1px solid #262626', padding: '14px 16px', flexShrink: 0, maxHeight: '42vh', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
          <div style={campo}>
            <span style={rotulo}>Nome</span>
            <input style={inputTxt} value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do evento" />
            {slider('Tamanho da fonte', nomeTam, setNomeTam, 24, 220)}
            {slider('Largura (esticar)', nomeLarg, setNomeLarg, 40, 320, 5, '%')}
            {slider('Altura (esticar)', nomeAlt, setNomeAlt, 40, 320, 5, '%')}
            <span style={{ fontSize: 11, color: '#777' }}>Dica: clique no nome pra aparecer o quadrado e puxar as alças.</span>
          </div>
          <div style={campo}>
            <span style={rotulo}>Fonte</span>
            <select style={{ ...inputTxt, cursor: 'pointer' }} value={fonte} onChange={e => setFonte(e.target.value)}>
              {FONTES.map(f => <option key={f.nome} value={f.css}>{f.nome}</option>)}
            </select>
            <span style={{ fontFamily: fonte, fontSize: 22, color: '#fff', lineHeight: 1.1 }}>{nome || 'Prévia'}</span>
          </div>
          <div style={campo}>
            <span style={rotulo}>Cor do texto</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" style={corInput} value={cor} onChange={e => setCor(e.target.value)} />
              {['#ffffff', '#111111', '#F6E05E', '#F6AD55', '#63B3ED'].map(c => <button key={c} onClick={() => setCor(c)} style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid #444', background: c, cursor: 'pointer' }} />)}
            </div>
          </div>
          <div style={campo}>
            <span style={rotulo}>Barra (ao vivo: {pct}%)</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#aaa' }}>cor</span>
              <input type="color" style={corInput} value={corBarra} onChange={e => setCorBarra(e.target.value)} />
            </div>
            {slider('Largura', barraLarg, setBarraLarg, 20, 100, 1, '%')}
            {slider('Altura', barraAlt, setBarraAlt, 12, 90)}
            {slider('Tamanho do %', pctTam, setPctTam, 18, 160)}
          </div>
          <div style={campo}>
            <span style={rotulo}>Fundo</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button style={botao} onClick={() => fileRef.current?.click()}>🖼️ Trocar imagem</button>
              {bg && <button style={{ ...botao, borderColor: '#833' }} onClick={() => { setBg(null); setBgFile(null) }}>Tirar</button>}
              {!bg && <input type="color" style={corInput} value={bgCor} onChange={e => setBgCor(e.target.value)} />}
            </div>
            {bg && (
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
