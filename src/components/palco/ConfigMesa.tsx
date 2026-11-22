import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { linkPedal } from '../../lib/palco'
import { ToastHost, toast } from '../Toast'
import { ConfirmHost, confirmar } from '../Confirmar'
import { EditorBotao, limparEtapas, type BotaoCfg } from './EditorBotao'

// ⚙️ CONFIGURAR PELA MESA (/mesa e aba Mesa do /cel), sem login: o técnico ajusta os
// 6 botões (nome, recado, cor, etapas), os recados rápidos da mesa → palco e os
// pedais (criar, renomear, ativar, excluir, link/QR). Tudo via funções que validam
// o link da mesa (sql/102 e 103). Mesmo editor de botão da tela /palco.

type Pedal = { id: string; nome: string; ativo: boolean; token: string; online: boolean }
type Config = { canal: { nome: string; recados_mesa: string[] }; botoes: BotaoCfg[]; pedais: Pedal[] }

const ERROS: Record<string, string> = {
  mesa_invalida: 'Este link da mesa não vale mais.',
  limite_pedais: 'Limite de 30 pedais neste palco.',
  palco_botoes_nome_check: 'O nome do botão precisa ter de 1 a 24 letras.',
  palco_pedais_nome_check: 'O nome do pedal precisa ter de 1 a 40 letras.',
  palco_canais_recados_chk: 'Cada recado precisa ter de 1 a 80 letras (máx. 12 recados).',
}
function msgErro(e: { message?: string } | null) {
  const k = Object.keys(ERROS).find(x => e?.message?.includes(x))
  return k ? ERROS[k] : 'Não foi possível salvar.'
}

export default function ConfigMesa({ token, onFechar, onMudou }: { token: string; onFechar: () => void; onMudou: () => void }) {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [aba, setAba] = useState<'botoes' | 'recados' | 'pedais'>('botoes')
  const [novoRecado, setNovoRecado] = useState('')
  const [qr, setQr] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('palco_mesa_config', { p_token: token })
    if (error || !data) { toast.falha('Não foi possível carregar a configuração', error); return }
    const c = data as Config
    // garante as 6 posições (uma que falte aparece pra criar)
    const botoes = [1, 2, 3, 4, 5, 6].map(p => c.botoes.find(b => b.posicao === p) ?? { posicao: p, nome: '', mensagem: '', cor: '#00A99D', ativo: false, etapas: [] })
    setCfg({ ...c, botoes })
  }, [token])
  useEffect(() => { carregar() }, [carregar])

  // ── botões ──
  async function salvarBotao(b: BotaoCfg) {
    const nome = b.nome.trim()
    if (!nome) { toast.aviso('O botão precisa de um nome'); return }
    const etapas = limparEtapas(b.etapas)
    const { error } = await supabase.rpc('palco_mesa_salvar_botao', {
      p_token: token, p_posicao: b.posicao, p_nome: nome.slice(0, 24), p_mensagem: b.mensagem.trim().slice(0, 160),
      p_cor: b.cor, p_ativo: b.ativo, p_etapas: etapas,
    })
    if (error) { toast.erro(msgErro(error)); return }
    setCfg(c => c && ({ ...c, botoes: c.botoes.map(x => (x.posicao === b.posicao ? { ...b, nome, etapas } : x)) }))
    toast.sucesso(`Botão ${b.posicao} salvo — já aparece no palco`)
    onMudou()
  }

  // ── recados rápidos ──
  async function salvarRecados(lista: string[]) {
    const limpa = [...new Set(lista.map(r => r.trim().slice(0, 80)).filter(Boolean))].slice(0, 12)
    const { error } = await supabase.rpc('palco_mesa_salvar_recados', { p_token: token, p_recados: limpa })
    if (error) { toast.erro(msgErro(error)); return false }
    setCfg(c => c && ({ ...c, canal: { ...c.canal, recados_mesa: limpa } }))
    onMudou()
    return true
  }
  async function addRecado() {
    if (!cfg || !novoRecado.trim()) return
    if (cfg.canal.recados_mesa.length >= 12) { toast.aviso('Máximo de 12 recados rápidos'); return }
    if (await salvarRecados([...cfg.canal.recados_mesa, novoRecado])) { setNovoRecado(''); toast.sucesso('Recado adicionado') }
  }
  function moverRecado(i: number, d: -1 | 1) {
    if (!cfg) return
    const l = [...cfg.canal.recados_mesa]; const j = i + d
    if (j < 0 || j >= l.length) return
    ;[l[i], l[j]] = [l[j], l[i]]
    salvarRecados(l)
  }

  // ── pedais ──
  async function pedal(acao: string, p?: Pedal, nome?: string) {
    const { data, error } = await supabase.rpc('palco_mesa_pedal', { p_token: token, p_acao: acao, p_id: p?.id ?? null, p_nome: nome ?? null })
    if (error) { toast.erro(msgErro(error)); return null }
    await carregar(); onMudou()
    return data as { id: string; token?: string }
  }
  async function novoPedal() {
    const nome = window.prompt('Nome do pedal (quem/onde está — ex.: Vocal 1, Back, Bateria)', `Pedal ${(cfg?.pedais.length ?? 0) + 1}`)?.trim()
    if (nome && await pedal('criar', undefined, nome.slice(0, 40))) toast.sucesso('Pedal criado — abra o link/QR no aparelho do palco')
  }
  async function renomear(p: Pedal) {
    const nome = window.prompt('Novo nome do pedal', p.nome)?.trim()
    if (nome && nome !== p.nome) await pedal('renomear', p, nome.slice(0, 40))
  }
  async function novoLink(p: Pedal) {
    if (!(await confirmar({ titulo: `Gerar novo link de "${p.nome}"?`, mensagem: 'O link atual deste pedal para de funcionar na hora.', confirmar: 'Gerar novo' }))) return
    if (await pedal('novo_link', p)) toast.sucesso('Novo link gerado')
  }
  async function excluir(p: Pedal) {
    if (!(await confirmar({ titulo: `Excluir o pedal "${p.nome}"?`, mensagem: 'O link dele para de funcionar. O histórico de recados é mantido.', perigo: true }))) return
    await pedal('excluir', p)
  }
  async function copiar(link: string) {
    try { await navigator.clipboard.writeText(link); toast.sucesso('Link copiado') } catch { window.prompt('Copie o link:', link) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 78, background: 'var(--bg, #F2F4F7)', color: 'var(--text, #1A202C)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', paddingTop: 'max(12px, env(safe-area-inset-top))', background: '#0f172a', color: 'white' }}>
        <span style={{ fontSize: 18, fontWeight: 900, flex: 1 }}>⚙️ Configurar · {cfg?.canal.nome ?? ''}</span>
        <button onClick={onFechar} style={{ background: 'rgba(255,255,255,.15)', color: 'white', border: 'none', borderRadius: 10, padding: '8px 14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Pronto</button>
      </div>
      <div className="tabs" style={{ margin: '12px 16px 0' }}>
        <button className={`tab ${aba === 'botoes' ? 'active' : ''}`} onClick={() => setAba('botoes')}>🔘 Botões do palco</button>
        <button className={`tab ${aba === 'recados' ? 'active' : ''}`} onClick={() => setAba('recados')}>📣 Recados da mesa</button>
        <button className={`tab ${aba === 'pedais' ? 'active' : ''}`} onClick={() => setAba('pedais')}>🦶 Pedais</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        {!cfg ? <div className="skeleton" style={{ height: 200, borderRadius: 14 }} /> : aba === 'botoes' ? (
          <>
            <p className="text-sm text-muted mb-3">O que o palco envia pra mesa. Nome = grande no botão; recado = explicação. “Etapas” abre telas de escolha antes de enviar (até 3 toques). Salve cada botão.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
              {cfg.botoes.map(b => (
                <div key={b.posicao} style={{ background: 'white', borderRadius: 14 }}>
                  <EditorBotao botao={{ ...b, nome: b.nome }} canEdit
                    onChange={nb => setCfg(c => c && ({ ...c, botoes: c.botoes.map(x => (x.posicao === b.posicao ? nb : x)) }))}
                    onSalvar={salvarBotao} />
                </div>
              ))}
            </div>
          </>
        ) : aba === 'recados' ? (
          <div style={{ background: 'white', borderRadius: 14, padding: 16, maxWidth: 640 }}>
            <p className="text-sm text-muted mb-3">Recados prontos que a mesa manda pro palco com 1 toque (em “📣 Falar com o palco”). Até 12.</p>
            {cfg.canal.recados_mesa.map((r, i) => (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{r}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => moverRecado(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
                <button className="btn btn-ghost btn-sm" onClick={() => moverRecado(i, 1)} disabled={i === cfg.canal.recados_mesa.length - 1} aria-label="Descer">↓</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} aria-label={`Remover ${r}`}
                  onClick={() => salvarRecados(cfg.canal.recados_mesa.filter(x => x !== r))}>✕</button>
              </div>
            ))}
            {cfg.canal.recados_mesa.length < 12 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input className="form-input" style={{ flex: 1 }} maxLength={80} value={novoRecado} placeholder="Ex.: Afaste o microfone da boca"
                  onChange={e => setNovoRecado(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRecado() } }} />
                <button className="btn btn-primary btn-sm" onClick={addRecado}>Adicionar</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ maxWidth: 720 }}>
            <p className="text-sm text-muted mb-3">Cada aparelho do palco (ou cada pessoa) tem um link próprio — a mesa vê o nome de quem apertou. Abra o QR no aparelho do palco e toque em “Instalar”.</p>
            {cfg.pedais.map(p => (
              <div key={p.id} style={{ background: 'white', borderRadius: 14, padding: 14, marginBottom: 10, opacity: p.ativo ? 1 : .6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <b style={{ flex: 1, fontSize: 16 }}>🎤 {p.nome}</b>
                  <span style={{ fontSize: 12, fontWeight: 700, color: !p.ativo ? 'var(--muted)' : p.online ? 'var(--success)' : 'var(--warning)' }}>
                    ● {!p.ativo ? 'desativado' : p.online ? 'conectado' : 'sem contato'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setQr(qr === p.id ? null : p.id)}>{qr === p.id ? 'Esconder QR' : 'QR code'}</button>
                  <button className="btn btn-outline btn-sm" onClick={() => copiar(linkPedal(p.token))}>Copiar link</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => renomear(p)}>Renomear</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => pedal(p.ativo ? 'desativar' : 'ativar', p)}>{p.ativo ? 'Desativar' : 'Ativar'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => novoLink(p)}>Novo link</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => excluir(p)}>Excluir</button>
                </div>
                {qr === p.id && (
                  <div style={{ textAlign: 'center', marginTop: 12 }}>
                    <div style={{ display: 'inline-block', padding: 10, background: 'white', border: '1px solid var(--border)', borderRadius: 12 }}>
                      <QRCodeSVG value={linkPedal(p.token)} size={200} level="M" />
                    </div>
                    <p className="text-xs text-muted" style={{ wordBreak: 'break-all', marginTop: 6 }}>{linkPedal(p.token)}</p>
                  </div>
                )}
              </div>
            ))}
            <button className="btn btn-primary" onClick={novoPedal}>+ Adicionar pedal</button>
          </div>
        )}
      </div>
      <ToastHost />
      <ConfirmHost />
    </div>
  )
}
