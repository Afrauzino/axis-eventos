import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { invalidarEventoAtivo } from '../hooks/useEvento'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { toast } from './Toast'

// Relógio digital de contagem regressiva para o 1º dia do evento.
//  - dias / horas / min / seg + barra de progresso (janela de 30 dias);
//  - no dia do evento mostra "É HOJE" e toca a buzina uma vez (bem alto);
//  - admin pode desligar e personalizar (cor/imagem), igual à caixa do evento.

const BUZINA = '/buzina-evento.mp3'
const JANELA_DIAS = 30
const CORES = ['#00A99D','#1565C0','#6B46C1','#2F855A','#C53030','#D69E2E','#E8821A','#0F766E','#B83280','#1A202C']

function hojeLocalStr(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function ContagemRegressiva({ evento, admin }: { evento: any; admin: boolean }) {
  const [agora, setAgora] = useState(Date.now())
  const [editando, setEditando] = useState(false)
  const [cor, setCor] = useState('')
  const [bg, setBg] = useState('')
  const [ativa, setAtiva] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const bgFileRef = useRef<HTMLInputElement>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const bufRef = useRef<AudioBuffer | null>(null)
  const tocouRef = useRef(false)
  useVoltarFecha(editando, () => setEditando(false))

  const startStr: string | null = evento?.start_date ? String(evento.start_date).slice(0, 10) : null
  const eventoAtiva = (evento?.contagem_ativa ?? true) !== false
  const hoje = hojeLocalStr()
  const estado: 'antes' | 'hoje' | 'passou' =
    !startStr ? 'passou' : hoje < startStr ? 'antes' : hoje === startStr ? 'hoje' : 'passou'

  // Sincroniza rascunho com o evento
  useEffect(() => {
    if (!evento) return
    setCor(evento.contagem_cor || '')
    setBg(evento.contagem_bg_url || '')
    setAtiva((evento.contagem_ativa ?? true) !== false)
  }, [evento?.id, evento?.contagem_cor, evento?.contagem_bg_url, evento?.contagem_ativa])

  // tick de 1s
  useEffect(() => {
    if (!startStr) return
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startStr])

  // Desbloqueia o áudio no primeiro toque do usuário (política de autoplay)
  useEffect(() => {
    const desbloquear = async () => {
      try {
        const AC = (window.AudioContext || (window as any).webkitAudioContext)
        if (AC && !ctxRef.current) ctxRef.current = new AC()
        await ctxRef.current?.resume()
        if (ctxRef.current && !bufRef.current) {
          const resp = await fetch(BUZINA)
          bufRef.current = await ctxRef.current.decodeAudioData(await resp.arrayBuffer())
        }
      } catch {}
    }
    window.addEventListener('pointerdown', desbloquear, { once: true })
    return () => window.removeEventListener('pointerdown', desbloquear)
  }, [])

  // Toca a buzina UMA vez quando é o dia
  useEffect(() => {
    if (estado === 'hoje' && eventoAtiva && !tocouRef.current) {
      tocouRef.current = true
      tocarBuzina()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, eventoAtiva])

  async function tocarBuzina() {
    // Web Audio com ganho alto (mais alto que o volume padrão do arquivo)
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext)
      if (AC && !ctxRef.current) ctxRef.current = new AC()
      const ctx = ctxRef.current!
      await ctx.resume()
      if (!bufRef.current) {
        const resp = await fetch(BUZINA)
        bufRef.current = await ctx.decodeAudioData(await resp.arrayBuffer())
      }
      const src = ctx.createBufferSource(); src.buffer = bufRef.current
      const gain = ctx.createGain(); gain.gain.value = 3.0
      src.connect(gain); gain.connect(ctx.destination)
      src.start()
      return
    } catch {}
    try { const a = new Audio(BUZINA); a.volume = 1; await a.play() } catch {}
  }

  function abrirEdicao() {
    setCor(evento?.contagem_cor || '')
    setBg(evento?.contagem_bg_url || '')
    setAtiva((evento?.contagem_ativa ?? true) !== false)
    setEditando(true)
  }

  async function enviarBg(file: File) {
    if (!evento) return
    setSalvando(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `contagem-bg/${evento.id}.${ext}`
    const { error } = await supabase.storage.from('pessoas').upload(path, file, { upsert: true })
    if (error) { setSalvando(false); toast.falha('Não foi possível enviar a imagem.', error); return }
    const { data } = supabase.storage.from('pessoas').getPublicUrl(path)
    setBg(`${data.publicUrl}?t=${Date.now()}`)
    setSalvando(false)
  }

  async function salvar() {
    if (!evento) return
    setSalvando(true)
    const { error } = await supabase.from('events').update({
      contagem_ativa: ativa, contagem_cor: cor || null, contagem_bg_url: bg || null,
    }).eq('id', evento.id)
    setSalvando(false)
    if (error) { toast.falha('Não foi possível salvar. Rode o SQL 38_contagem_regressiva.sql no Supabase.', error); return }
    invalidarEventoAtivo()
    setEditando(false)
    toast.sucesso('Contagem regressiva atualizada!')
  }

  function modal() {
    const previa: React.CSSProperties = bg
      ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.42),rgba(0,0,0,0.58)), url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }
      : { background: cor || 'linear-gradient(135deg, var(--primary), var(--primary-dark))', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
        onClick={e => e.target === e.currentTarget && setEditando(false)}>
        <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 20px 28px', maxWidth: 480, width: '100%', margin: '0 auto', maxHeight: '88vh', overflowY: 'auto' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 16px' }} />
          <p style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Contagem regressiva</p>

          {/* Ligar/desligar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg)', borderRadius: 12, marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700 }}>Mostrar na tela inicial</p>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>Desligue para parar a contagem para todos.</p>
            </div>
            <button onClick={() => setAtiva(a => !a)} aria-label="Ligar/desligar"
              style={{ width: 50, height: 28, borderRadius: 99, border: 'none', cursor: 'pointer', background: ativa ? 'var(--primary)' : 'var(--border)', position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 3, left: ativa ? 25 : 3, width: 22, height: 22, borderRadius: '50%', background: 'white', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            </button>
          </div>

          {/* Prévia */}
          <div style={previa}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)' }}>Contagem regressiva</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>00 : 00 : 00</p>
          </div>

          <label className="form-label">Cor de fundo</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {CORES.map(c => (
              <button key={c} type="button" onClick={() => setCor(c)} aria-label={c}
                style={{ width: 34, height: 34, borderRadius: 8, background: c, border: cor === c ? '3px solid var(--text)' : '2px solid white', boxShadow: '0 0 0 1px var(--border)', cursor: 'pointer' }} />
            ))}
          </div>

          <label className="form-label">Imagem de fundo</label>
          <p className="form-hint mb-2">Se colocar uma imagem, ela cobre a cor (fica escurecida para o texto ler bem).</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => bgFileRef.current?.click()} disabled={salvando}>
              <span className="icon icon-sm">image</span> {salvando ? 'Enviando...' : 'Enviar imagem'}
            </button>
            {bg && <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setBg('')}>
              <span className="icon icon-sm">delete</span> Remover imagem
            </button>}
          </div>

          <button className="btn btn-primary btn-full" onClick={salvar} disabled={salvando} style={{ marginBottom: 8 }}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button className="btn btn-ghost btn-full" onClick={() => setEditando(false)}>Cancelar</button>
          <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) enviarBg(f); e.target.value = '' }} />
        </div>
      </div>
    )
  }

  if (!startStr) return null

  // Desligada: some para todos; admin vê faixa fina para reativar/personalizar
  if (!eventoAtiva) {
    if (!admin) return null
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>⏳ Contagem regressiva desativada</span>
        <button onClick={abrirEdicao} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Reativar</button>
        {editando && modal()}
      </div>
    )
  }

  if (estado === 'passou') return null

  // Cálculos
  const [y, mo, da] = startStr.split('-').map(Number)
  const alvoMs = new Date(y, mo - 1, da, 0, 0, 0, 0).getTime()
  const restante = Math.max(0, alvoMs - agora)
  const totalSeg = Math.floor(restante / 1000)
  const dias = Math.floor(totalSeg / 86400)
  const horas = Math.floor((totalSeg % 86400) / 3600)
  const min = Math.floor((totalSeg % 3600) / 60)
  const seg = totalSeg % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  const janelaMs = JANELA_DIAS * 86400 * 1000
  const inicioJanela = alvoMs - janelaMs
  const pct = estado === 'hoje' ? 100 : Math.max(0, Math.min(100, Math.round(((agora - inicioJanela) / (alvoMs - inicioJanela)) * 100)))

  const cardStyle: React.CSSProperties = bg
    ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.42),rgba(0,0,0,0.58)), url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 14, padding: '16px 16px 18px', marginBottom: 16, boxShadow: '0 4px 14px rgba(0,0,0,0.25)', position: 'relative' }
    : { background: cor || 'linear-gradient(135deg, var(--primary), var(--primary-dark))', borderRadius: 14, padding: '16px 16px 18px', marginBottom: 16, boxShadow: '0 4px 14px rgba(0,0,0,0.15)', position: 'relative' }

  const blocos: { v: string; l: string }[] = [
    { v: String(dias), l: dias === 1 ? 'DIA' : 'DIAS' },
    { v: pad(horas), l: 'HORAS' },
    { v: pad(min), l: 'MIN' },
    { v: pad(seg), l: 'SEG' },
  ]

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 16 }}>⏳</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {estado === 'hoje' ? 'O encontro é hoje!' : 'Contagem para o encontro'}
          </span>
        </div>
        {admin && (
          <button onClick={abrirEdicao} title="Personalizar / desativar"
            style={{ background: 'rgba(255,255,255,0.22)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'inherit' }}>
            <span className="icon icon-sm">palette</span>
          </button>
        )}
      </div>

      {estado === 'hoje' ? (
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: 'white', lineHeight: 1, letterSpacing: '0.02em' }}>É HOJE! 🎉</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginTop: 8, letterSpacing: '0.06em' }}>CHEGOU O GRANDE DIA</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          {blocos.map((b, i) => (
            <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 12, padding: '12px 4px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'white', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>{b.v}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginTop: 6, letterSpacing: '0.08em' }}>{b.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Barra de progresso (janela de 30 dias) */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Últimos {JANELA_DIAS} dias</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>{pct}%</span>
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,0.25)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'white', borderRadius: 99, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {editando && modal()}
    </div>
  )
}
