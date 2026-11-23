import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { MAX_BOTOES, PALCO_CORES, linkPedal } from '../../lib/palco'
import { ToastHost, toast } from '../Toast'
import { ConfirmHost, confirmar } from '../Confirmar'
import { EditorBotao, limparEtapas, type BotaoCfg } from './EditorBotao'

// ⚙️ CONFIGURAR PELA MESA (/mesa e aba Mesa do /cel), sem login. O técnico ajusta:
//  • BOTÕES: os padrão do palco OU os próprios de cada pedal (cada pessoa com os
//    seus — ex.: baterista "+Click", vocal "+Mic"). Até 12 por conjunto; adicionar
//    e excluir. Mesmo editor de botão da tela /palco.
//  • RECADOS rápidos da mesa → palco.
//  • PEDAIS: um por pessoa, cada um com SEU link/QR ("Mostrar para a pessoa").
// Tudo via funções que validam o link da mesa (sql/102–104).

type Pedal = { id: string; nome: string; ativo: boolean; token: string; online: boolean; botoes_proprios: boolean; botoes: BotaoCfg[] }
type Config = { canal: { nome: string; recados_mesa: string[] }; botoes: BotaoCfg[]; pedais: Pedal[] }

const ERROS: Record<string, string> = {
  mesa_invalida: 'Este link da mesa não vale mais.',
  limite_pedais: 'Limite de 30 pedais neste palco.',
  pedal_sem_botoes_proprios: 'Este pedal usa os botões padrão. Ative “botões próprios” primeiro.',
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
  const [aba, setAba] = useState<'botoes' | 'recados' | 'pedais'>('pedais')
  const [conjunto, setConjunto] = useState<string | null>(null)   // null = padrão do palco; id = pedal
  const [novoRecado, setNovoRecado] = useState('')
  const [mostrar, setMostrar] = useState<Pedal | null>(null)     // QR em tela cheia

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('palco_mesa_config', { p_token: token })
    if (error || !data) { toast.falha('Não foi possível carregar a configuração', error); return }
    setCfg(data as Config)
  }, [token])
  useEffect(() => { carregar() }, [carregar])

  const pedalSel = cfg?.pedais.find(p => p.id === conjunto) ?? null
  const botoesSel: BotaoCfg[] = !cfg ? [] : pedalSel ? pedalSel.botoes : cfg.botoes

  function setBotoesSel(fn: (bs: BotaoCfg[]) => BotaoCfg[]) {
    setCfg(c => {
      if (!c) return c
      if (!conjunto) return { ...c, botoes: fn(c.botoes) }
      return { ...c, pedais: c.pedais.map(p => (p.id === conjunto ? { ...p, botoes: fn(p.botoes) } : p)) }
    })
  }

  // ── botões ──
  async function salvarBotao(b: BotaoCfg) {
    const nome = b.nome.trim()
    if (!nome) { toast.aviso('O botão precisa de um nome'); return }
    const etapas = limparEtapas(b.etapas)
    const { error } = await supabase.rpc('palco_mesa_salvar_botao', {
      p_token: token, p_posicao: b.posicao, p_nome: nome.slice(0, 24), p_mensagem: b.mensagem.trim().slice(0, 160),
      p_cor: b.cor, p_ativo: b.ativo, p_etapas: etapas, p_pedal: conjunto,
    })
    if (error) { toast.erro(msgErro(error)); return }
    setBotoesSel(bs => bs.map(x => (x.posicao === b.posicao ? { ...b, nome, etapas } : x)))
    toast.sucesso(`Botão ${b.posicao} salvo — já aparece no palco`)
    onMudou()
  }
  function adicionarBotao() {
    const usadas = new Set(botoesSel.map(b => b.posicao))
    const pos = Array.from({ length: MAX_BOTOES }, (_, i) => i + 1).find(p => !usadas.has(p))
    if (!pos) { toast.aviso(`Máximo de ${MAX_BOTOES} botões`); return }
    const cor = PALCO_CORES[(pos - 1) % PALCO_CORES.length]
    setBotoesSel(bs => [...bs, { posicao: pos, nome: '', mensagem: '', cor, ativo: true, etapas: [] }].sort((a, z) => a.posicao - z.posicao))
    toast.info(`Botão ${pos} criado — preencha o nome e toque em Salvar`)
  }
  async function excluirBotao(b: BotaoCfg) {
    if (!(await confirmar({ titulo: `Excluir o botão “${b.nome || b.posicao}”?`, mensagem: 'Some do palco na hora. O histórico de recados é mantido.', perigo: true }))) return
    const { error } = await supabase.rpc('palco_mesa_excluir_botao', { p_token: token, p_posicao: b.posicao, p_pedal: conjunto })
    if (error) { toast.erro(msgErro(error)); return }
    setBotoesSel(bs => bs.filter(x => x.posicao !== b.posicao))
    toast.sucesso('Botão excluído')
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
    const nome = window.prompt('Nome da pessoa ou do lugar (ex.: Ana, Vocal 1, Bateria)', `Pedal ${(cfg?.pedais.length ?? 0) + 1}`)?.trim()
    if (!nome) return
    const r = await pedal('criar', undefined, nome.slice(0, 40))
    if (r) toast.sucesso(`Pedal de ${nome} criado — toque em “Mostrar para a pessoa”`)
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
    if (conjunto === p.id) setConjunto(null)
    await pedal('excluir', p)
  }
  async function botoesProprios(p: Pedal) {
    if (await pedal('botoes_proprios', p)) toast.sucesso(`${p.nome} agora tem botões próprios (cópia do padrão) — edite à vontade`)
  }
  async function voltarPadrao(p: Pedal) {
    if (!(await confirmar({ titulo: `${p.nome} volta aos botões padrão?`, mensagem: 'Os botões próprios dele são apagados.', confirmar: 'Voltar ao padrão' }))) return
    if (await pedal('botoes_padrao', p)) toast.sucesso(`${p.nome} usa os botões padrão`)
  }
  async function copiar(link: string) {
    try { await navigator.clipboard.writeText(link); toast.sucesso('Link copiado') } catch { window.prompt('Copie o link:', link) }
  }
  async function compartilhar(p: Pedal) {
    const link = linkPedal(p.token)
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    if (nav.share) { try { await nav.share({ title: `Pedal de ${p.nome}`, text: `${p.nome}, este é o seu pedal do palco (abra e toque em Instalar):`, url: link }) } catch {} }
    else copiar(link)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 78, background: 'var(--bg, #F2F4F7)', color: 'var(--text, #1A202C)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', paddingTop: 'max(12px, env(safe-area-inset-top))', background: '#0f172a', color: 'white' }}>
        <span style={{ fontSize: 18, fontWeight: 900, flex: 1 }}>⚙️ Configurar · {cfg?.canal.nome ?? ''}</span>
        <button onClick={onFechar} style={{ background: 'rgba(255,255,255,.15)', color: 'white', border: 'none', borderRadius: 10, padding: '8px 14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Pronto</button>
      </div>
      <div className="tabs" style={{ margin: '12px 16px 0' }}>
        <button className={`tab ${aba === 'pedais' ? 'active' : ''}`} onClick={() => setAba('pedais')}>🦶 Pedais (pessoas)</button>
        <button className={`tab ${aba === 'botoes' ? 'active' : ''}`} onClick={() => setAba('botoes')}>🔘 Botões</button>
        <button className={`tab ${aba === 'recados' ? 'active' : ''}`} onClick={() => setAba('recados')}>📣 Recados da mesa</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        {!cfg ? <div className="skeleton" style={{ height: 200, borderRadius: 14 }} /> : aba === 'botoes' ? (
          <>
            {/* de quem são os botões */}
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 6 }}>BOTÕES DE</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <button className={`btn btn-sm ${conjunto === null ? 'btn-primary' : 'btn-outline'}`} onClick={() => setConjunto(null)}>⭐ Padrão do palco</button>
              {cfg.pedais.map(p => (
                <button key={p.id} className={`btn btn-sm ${conjunto === p.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setConjunto(p.id)}>
                  🎤 {p.nome}{p.botoes_proprios ? ' · próprios' : ''}
                </button>
              ))}
            </div>

            {pedalSel && !pedalSel.botoes_proprios ? (
              <div style={{ background: 'white', borderRadius: 14, padding: 18, maxWidth: 560 }}>
                <p style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>🎤 {pedalSel.nome} usa os botões padrão do palco</p>
                <p className="text-sm text-muted mb-3">Quer que {pedalSel.nome} tenha botões diferentes? Criamos uma cópia dos botões padrão só pra ele(a), e você edita, adiciona ou exclui à vontade.</p>
                <button className="btn btn-primary" onClick={() => botoesProprios(pedalSel)}>Criar botões próprios para {pedalSel.nome}</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <p className="text-sm text-muted" style={{ flex: 1, minWidth: 220 }}>
                    {pedalSel
                      ? <>Botões que só <b>{pedalSel.nome}</b> vê no pedal dele(a).</>
                      : <>Botões de todo pedal que não tem botões próprios.</>}
                    {' '}Até {MAX_BOTOES}. Salve cada botão.
                  </p>
                  {pedalSel && <button className="btn btn-ghost btn-sm" onClick={() => voltarPadrao(pedalSel)}>Voltar aos botões padrão</button>}
                  {botoesSel.length < MAX_BOTOES && <button className="btn btn-primary btn-sm" onClick={adicionarBotao}>+ Adicionar botão</button>}
                </div>
                {botoesSel.length === 0 && <div className="empty"><p className="empty-title">Nenhum botão</p><p className="empty-desc">Toque em “+ Adicionar botão”.</p></div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
                  {botoesSel.map(b => (
                    <div key={`${conjunto ?? 'padrao'}-${b.posicao}`} style={{ background: 'white', borderRadius: 14 }}>
                      <EditorBotao botao={b} canEdit
                        onChange={nb => setBotoesSel(bs => bs.map(x => (x.posicao === b.posicao ? nb : x)))}
                        onSalvar={salvarBotao}
                        onExcluir={() => excluirBotao(b)} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : aba === 'recados' ? (
          <div style={{ background: 'white', borderRadius: 14, padding: 16, maxWidth: 640 }}>
            <p className="text-sm text-muted mb-3">Recados prontos que a mesa manda pro palco com 1 toque (em “📣 Falar com o palco”), pra todos ou pra uma pessoa. Até 12.</p>
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
          <div style={{ maxWidth: 760 }}>
            <p className="text-sm text-muted mb-3">Um pedal por pessoa. Cada um tem o <b>seu link</b>: mostre o QR pra pessoa abrir no celular/tablet dela e tocar em “Instalar”. A mesa recebe tudo com o nome de quem apertou.</p>
            {cfg.pedais.map(p => (
              <div key={p.id} style={{ background: 'white', borderRadius: 14, padding: 14, marginBottom: 10, opacity: p.ativo ? 1 : .6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <b style={{ flex: 1, fontSize: 17 }}>🎤 {p.nome}</b>
                  <span className="badge badge-neutral">{p.botoes_proprios ? `${p.botoes.length} botões próprios` : 'botões padrão'}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: !p.ativo ? 'var(--muted)' : p.online ? 'var(--success)' : 'var(--warning)' }}>
                    ● {!p.ativo ? 'desativado' : p.online ? 'conectado' : 'sem contato'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setMostrar(p)}>📱 Mostrar para a pessoa</button>
                  <button className="btn btn-outline btn-sm" onClick={() => compartilhar(p)}>Compartilhar</button>
                  <button className="btn btn-outline btn-sm" onClick={() => { setConjunto(p.id); setAba('botoes') }}>Botões</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => renomear(p)}>Renomear</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => pedal(p.ativo ? 'desativar' : 'ativar', p)}>{p.ativo ? 'Desativar' : 'Ativar'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => novoLink(p)}>Novo link</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => excluir(p)}>Excluir</button>
                </div>
              </div>
            ))}
            <button className="btn btn-primary" onClick={novoPedal}>+ Adicionar pessoa / pedal</button>
          </div>
        )}
      </div>

      {/* QR em tela cheia pra mostrar à pessoa */}
      {mostrar && (
        <div onClick={() => setMostrar(null)} style={{ position: 'fixed', inset: 0, zIndex: 85, background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: 'var(--muted)', fontWeight: 700 }}>Pedal do palco de</div>
          <div style={{ fontSize: 'clamp(30px, 7vw, 56px)', fontWeight: 900, marginBottom: 16 }}>🎤 {mostrar.nome}</div>
          <QRCodeSVG value={linkPedal(mostrar.token)} size={Math.min(window.innerWidth, window.innerHeight) * 0.55} level="M" />
          <p style={{ fontSize: 15, margin: '16px 0 4px', fontWeight: 700 }}>Aponte a câmera do celular, abra o link e toque em “📲 Instalar”.</p>
          <p className="text-xs text-muted" style={{ wordBreak: 'break-all', maxWidth: 520 }}>{linkPedal(mostrar.token)}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }} onClick={e => e.stopPropagation()}>
            <button className="btn btn-outline" onClick={() => copiar(linkPedal(mostrar.token))}>Copiar link</button>
            <button className="btn btn-outline" onClick={() => compartilhar(mostrar)}>Compartilhar</button>
            <button className="btn btn-primary" onClick={() => setMostrar(null)}>Fechar</button>
          </div>
        </div>
      )}
      <ToastHost />
      <ConfirmHost />
    </div>
  )
}
