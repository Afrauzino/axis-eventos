import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  tokenDaUrl, usePalcoSync, useTelaAcesa, useFundoEscuro, alternarTelaCheia,
  vibrar, erroPalco, type PalcoBotao, type MeuChamado,
} from '../lib/palco'
import PadPalco from '../components/palco/PadPalco'
import { Aviso, LinkInvalido, Tela } from '../components/palco/Comum'

// PEDAL DO PALCO — página pública (/ped/:token), sem login, pro tablet/celular no palco.
// Até 6 botões (configurados em /palco). Botão simples: 1 toque envia. Botão com etapas:
// abre as telas de escolha (até 3 toques). Teclas 1–6 / A–F pra pedal USB/Bluetooth.
// O botão mostra o retorno da mesa: ENVIADO → MESA VIU → RESOLVIDO.

type Estado = {
  pedal: { id: string; nome: string }
  canal: { nome: string; sinal: string }
  botoes: PalcoBotao[]
  chamados: MeuChamado[]
}

export default function PalcoPedal() {
  const token = tokenDaUrl()
  const [estado, setEstado] = useState<Estado | null>(null)
  const [carregou, setCarregou] = useState(false)
  const [online, setOnline] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)
  const avisoTimer = useRef<number | undefined>(undefined)

  useTelaAcesa(true)
  useFundoEscuro('#0b0f17')
  useEffect(() => { document.title = estado ? `Pedal · ${estado.pedal.nome}` : 'Pedal do palco' }, [estado?.pedal.nome])

  const puxar = useCallback(async () => {
    if (!token) { setCarregou(true); return }
    const { data, error } = await supabase.rpc('palco_pedal_estado', { p_token: token })
    if (error) { setOnline(false); return }
    setOnline(true)
    setEstado((data as Estado) ?? null)
    setCarregou(true)
  }, [token])

  const avisar = usePalcoSync(puxar, estado?.canal.sinal ?? null, 2000)

  function mostrarAviso(txt: string) {
    setAviso(txt)
    window.clearTimeout(avisoTimer.current)
    avisoTimer.current = window.setTimeout(() => setAviso(null), 3500)
  }

  const enviar = useCallback(async (posicao: number, escolhas: string[]) => {
    if (!token) return false
    const { data, error } = await supabase.rpc('palco_enviar', { p_token: token, p_posicao: posicao, p_escolhas: escolhas })
    if (error) { mostrarAviso(erroPalco(error.message)); vibrar([80, 60, 80]); puxar(); return false }
    const r = data as { id: string; status: MeuChamado['status']; repeticoes: number; ignorado: boolean }
    const detalhe = escolhas.join(' · ')
    setEstado(e => e && ({ ...e, chamados: [...e.chamados.filter(c => c.id !== r.id), { id: r.id, posicao, status: r.status, repeticoes: r.repeticoes, detalhe }] }))
    if (!r.ignorado) avisar()
    return true
  }, [token, avisar, puxar])

  const cancelar = useCallback(async (c: MeuChamado) => {
    if (!token) return
    setEstado(e => e && ({ ...e, chamados: e.chamados.filter(x => x.id !== c.id) }))
    const { error } = await supabase.rpc('palco_cancelar', { p_token: token, p_chamado: c.id })
    if (error) { mostrarAviso('Não foi possível cancelar.'); puxar(); return }
    avisar()
  }, [token, avisar, puxar])

  if (!carregou) return <Tela><div style={{ color: '#64748b', fontSize: 18 }}>Carregando…</div></Tela>
  if (!token || !estado) return <Tela><LinkInvalido titulo="Pedal não encontrado" /></Tela>

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0b0f17', color: '#f8fafc', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #1e293b' }}>
        <span title={online ? 'Conectado' : 'Sem conexão'} style={{ width: 12, height: 12, borderRadius: 99, background: online ? '#22c55e' : '#ef4444', boxShadow: online ? '0 0 8px #22c55e' : 'none', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🎤 {estado.pedal.nome}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{estado.canal.nome} · mesa de som</div>
        </div>
        <button onClick={alternarTelaCheia} aria-label="Tela cheia"
          style={{ background: '#1e293b', color: '#e2e8f0', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>⛶ Tela cheia</button>
      </div>
      {!online && <div style={{ background: '#7f1d1d', color: 'white', textAlign: 'center', padding: '6px 10px', fontSize: 14, fontWeight: 700 }}>Sem conexão com a mesa — verifique a internet</div>}
      <PadPalco botoes={estado.botoes} chamados={estado.chamados} onEnviar={enviar} onCancelar={cancelar} />
      {aviso && <Aviso texto={aviso} />}
    </div>
  )
}
