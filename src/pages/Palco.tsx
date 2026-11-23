import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { confirmar } from '../components/Confirmar'
import { toast } from '../components/Toast'
import { isAdmin } from '../utils'
import { linkMesa, linkPedal, linkCelular, MAX_BOTOES, PALCO_CORES, type PalcoEtapa } from '../lib/palco'
import { EditorBotao, limparEtapas } from '../components/palco/EditorBotao'
import type { Profile } from '../App'

// PALCO ↔ MESA — configuração (dentro do app). Cada "palco" tem 6 botões de recado
// (nome curto + mensagem), um ou mais PEDAIS (aparelhos no palco, cada um com link
// próprio → a mesa sabe quem apertou) e o link do MONITOR da mesa de som.
// As telas do palco (/ped/…) e da mesa (/mesa/…) abrem sem login, só pelo link.

type Canal  = { id: string; event_id: string; nome: string; token_mesa: string; token_celular: string; ativo: boolean; created_at: string }
type Botao  = { id: string; canal_id: string; posicao: number; nome: string; mensagem: string; cor: string; ativo: boolean; etapas: PalcoEtapa[] }
type Pedal  = { id: string; canal_id: string; nome: string; token: string; ativo: boolean; visto_em: string | null }
type Resumo = { posicao: number; nome: string; total: number }

export default function Palco({ profile }: { profile: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const { pode } = usePermissao(profile)
  const canEdit = isAdmin(profile.user_role) || !!profile.is_admin || pode('palco', 'editar')

  const [canais, setCanais] = useState<Canal[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [botoes, setBotoes] = useState<Botao[]>([])
  const [pedais, setPedais] = useState<Pedal[]>([])
  const [resumo, setResumo] = useState<{ total: number; porBotao: Resumo[] }>({ total: 0, porBotao: [] })
  const [loading, setLoading] = useState(true)
  const [qr, setQr] = useState<{ titulo: string; link: string } | null>(null)
  useVoltarFecha(!!qr, () => setQr(null))

  const canal = canais.find(c => c.id === selId) ?? null

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregarCanais() }, [evento?.id, evLoading])
  useEffect(() => { if (selId) carregarCanal(selId) }, [selId])
  // status "online" dos pedais se atualiza sozinho enquanto a tela está aberta
  useEffect(() => {
    if (!selId) return
    const t = setInterval(() => carregarPedais(selId), 20000)
    return () => clearInterval(t)
  }, [selId])

  async function carregarCanais(manter?: string) {
    if (!evento) return
    setLoading(true)
    const { data, error } = await supabase.from('palco_canais').select('*').eq('event_id', evento.id).order('created_at')
    if (error) toast.falha('Não foi possível carregar os palcos', error)
    const lista = (data ?? []) as Canal[]
    setCanais(lista)
    setSelId(s => manter ?? (lista.some(c => c.id === s) ? s : lista[0]?.id ?? null))
    setLoading(false)
  }
  async function carregarPedais(id: string) {
    const { data } = await supabase.from('palco_pedais').select('*').eq('canal_id', id).order('created_at')
    setPedais((data ?? []) as Pedal[])
  }
  async function carregarCanal(id: string) {
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0)
    const [b, , ch] = await Promise.all([
      supabase.from('palco_botoes').select('*').eq('canal_id', id).is('pedal_id', null).order('posicao'),   // só os PADRÃO (os próprios de cada pedal ficam no ⚙️ da mesa)
      carregarPedais(id),
      supabase.from('palco_chamados').select('posicao,nome,repeticoes').eq('canal_id', id).gte('criado_em', inicioDia.toISOString()).limit(2000),
    ])
    setBotoes((b.data ?? []) as Botao[])
    const mapa = new Map<number, Resumo>()
    ;((ch.data ?? []) as { posicao: number; nome: string; repeticoes: number }[]).forEach(r => {
      const m = mapa.get(r.posicao) ?? { posicao: r.posicao, nome: r.nome, total: 0 }
      m.total += 1; mapa.set(r.posicao, m)
    })
    setResumo({ total: (ch.data ?? []).length, porBotao: [...mapa.values()].sort((a, z) => z.total - a.total) })
  }

  // ── Palco (canal) ──
  async function novoCanal() {
    if (!evento) return
    const nome = window.prompt('Nome do palco (ex.: Palco principal, Auditório)', canais.length ? `Palco ${canais.length + 1}` : 'Palco principal')?.trim()
    if (!nome) return
    const { data, error } = await supabase.from('palco_canais').insert({ event_id: evento.id, nome: nome.slice(0, 60) }).select('id').single()
    if (error) { toast.falha('Não foi possível criar o palco', error); return }
    toast.sucesso('Palco criado com 6 botões padrão')
    carregarCanais(data.id)
  }
  async function salvarCanal(campos: Partial<Canal>) {
    if (!canal) return
    const { error } = await supabase.from('palco_canais').update(campos).eq('id', canal.id)
    if (error) { toast.falha('Não foi possível salvar', error); return }
    setCanais(cs => cs.map(c => (c.id === canal.id ? { ...c, ...campos } : c)))
  }
  async function renomearCanal() {
    if (!canal) return
    const nome = window.prompt('Novo nome do palco', canal.nome)?.trim()
    if (nome && nome !== canal.nome) salvarCanal({ nome: nome.slice(0, 60) })
  }
  async function excluirCanal() {
    if (!canal) return
    if (!(await confirmar({ titulo: `Excluir "${canal.nome}"?`, mensagem: 'Apaga botões, pedais e o histórico de recados deste palco. Os links param de funcionar. Não dá pra desfazer.', perigo: true }))) return
    const { error } = await supabase.from('palco_canais').delete().eq('id', canal.id)
    if (error) { toast.falha('Não foi possível excluir', error); return }
    toast.sucesso('Palco excluído')
    setSelId(null); carregarCanais()
  }
  async function novoLinkCanal(tipo: 'mesa' | 'celular') {
    if (!canal) return
    const nome = tipo === 'mesa' ? 'da mesa' : 'do celular'
    if (!(await confirmar({ titulo: `Gerar novo link ${nome}?`, mensagem: 'O link atual para de funcionar na hora. Use se o link vazou ou o aparelho foi trocado.', confirmar: 'Gerar novo' }))) return
    const { data, error } = await supabase.rpc('palco_novo_token', { p_tipo: tipo, p_id: canal.id })
    if (error) { toast.falha('Não foi possível gerar', error); return }
    const campo = tipo === 'mesa' ? 'token_mesa' : 'token_celular'
    setCanais(cs => cs.map(c => (c.id === canal.id ? { ...c, [campo]: data as string } : c)))
    toast.sucesso(`Novo link ${nome} gerado`)
  }

  // ── Botões ──
  async function salvarBotao(b: Botao) {
    const nome = b.nome.trim()
    if (!nome) { toast.aviso('O botão precisa de um nome'); return }
    // etapas: tira opções vazias/repetidas e etapas sem opção (o banco recusa formato inválido)
    const etapas = limparEtapas(b.etapas)
    const { error } = await supabase.from('palco_botoes')
      .update({ nome: nome.slice(0, 24), mensagem: b.mensagem.trim().slice(0, 160), cor: b.cor, ativo: b.ativo, etapas }).eq('id', b.id)
    if (error) { toast.falha('Não foi possível salvar o botão', error); return }
    setBotoes(bs => bs.map(x => (x.id === b.id ? { ...b, nome, etapas } : x)))
    toast.sucesso(`Botão ${b.posicao} salvo`)
  }
  async function adicionarBotao() {
    if (!canal) return
    const usadas = new Set(botoes.map(b => b.posicao))
    const posicao = Array.from({ length: MAX_BOTOES }, (_, i) => i + 1).find(p => !usadas.has(p))
    if (!posicao) { toast.aviso(`Máximo de ${MAX_BOTOES} botões`); return }
    const { error } = await supabase.from('palco_botoes').insert({ canal_id: canal.id, posicao, nome: `Botão ${posicao}`, mensagem: '', cor: PALCO_CORES[(posicao - 1) % PALCO_CORES.length] })
    if (error) { toast.falha('Não foi possível criar o botão', error); return }
    carregarCanal(canal.id)
  }
  async function excluirBotao(b: Botao) {
    if (!(await confirmar({ titulo: `Excluir o botão “${b.nome}”?`, mensagem: 'Some do palco na hora. O histórico de recados é mantido.', perigo: true }))) return
    const { error } = await supabase.from('palco_botoes').delete().eq('id', b.id)
    if (error) { toast.falha('Não foi possível excluir', error); return }
    setBotoes(bs => bs.filter(x => x.id !== b.id))
  }

  // ── Pedais ──
  async function novoPedal() {
    if (!canal) return
    const nome = window.prompt('Nome do pedal (quem/onde está — ex.: Vocal 1, Back, Bateria)', `Pedal ${pedais.length + 1}`)?.trim()
    if (!nome) return
    const { error } = await supabase.from('palco_pedais').insert({ canal_id: canal.id, nome: nome.slice(0, 40) })
    if (error) { toast.falha('Não foi possível criar o pedal', error); return }
    carregarPedais(canal.id)
  }
  async function renomearPedal(p: Pedal) {
    const nome = window.prompt('Novo nome do pedal', p.nome)?.trim()
    if (!nome || nome === p.nome) return
    const { error } = await supabase.from('palco_pedais').update({ nome: nome.slice(0, 40) }).eq('id', p.id)
    if (error) { toast.falha('Não foi possível renomear', error); return }
    setPedais(ps => ps.map(x => (x.id === p.id ? { ...x, nome } : x)))
  }
  async function alternarPedal(p: Pedal) {
    const { error } = await supabase.from('palco_pedais').update({ ativo: !p.ativo }).eq('id', p.id)
    if (error) { toast.falha('Não foi possível alterar', error); return }
    setPedais(ps => ps.map(x => (x.id === p.id ? { ...x, ativo: !p.ativo } : x)))
  }
  async function novoLinkPedal(p: Pedal) {
    if (!(await confirmar({ titulo: `Gerar novo link de "${p.nome}"?`, mensagem: 'O link atual deste pedal para de funcionar na hora.', confirmar: 'Gerar novo' }))) return
    const { data, error } = await supabase.rpc('palco_novo_token', { p_tipo: 'pedal', p_id: p.id })
    if (error) { toast.falha('Não foi possível gerar', error); return }
    setPedais(ps => ps.map(x => (x.id === p.id ? { ...x, token: data as string } : x)))
    toast.sucesso('Novo link do pedal gerado')
  }
  async function excluirPedal(p: Pedal) {
    if (!(await confirmar({ titulo: `Excluir o pedal "${p.nome}"?`, mensagem: 'O link dele para de funcionar. O histórico de recados é mantido.', perigo: true }))) return
    const { error } = await supabase.from('palco_pedais').delete().eq('id', p.id)
    if (error) { toast.falha('Não foi possível excluir', error); return }
    setPedais(ps => ps.filter(x => x.id !== p.id))
  }

  async function copiar(link: string) {
    try { await navigator.clipboard.writeText(link); toast.sucesso('Link copiado') }
    catch { window.prompt('Copie o link:', link) }
  }


  if (loading) return <div className="page">{[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 10, borderRadius: 14 }} />)}</div>
  if (!evento) return <div className="page"><div className="empty"><p className="empty-title">Nenhum evento ativo</p></div></div>

  return (
    <div className="page" style={{ paddingBottom: 90 }}>
      {/* seletor de palco */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 12 }}>
        {canais.map(c => (
          <button key={c.id} onClick={() => setSelId(c.id)} className="chip"
            style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap', padding: '8px 14px', fontWeight: 700,
                     background: c.id === selId ? 'var(--primary)' : 'white', color: c.id === selId ? 'white' : 'var(--text)', opacity: c.ativo ? 1 : .55 }}>
            🎚️ {c.nome}{!c.ativo ? ' (desativado)' : ''}
          </button>
        ))}
        {canEdit && <button onClick={novoCanal} className="btn btn-outline btn-sm" style={{ whiteSpace: 'nowrap' }}>+ Novo palco</button>}
      </div>

      {!canal ? (
        <div className="empty">
          <div style={{ fontSize: 48 }}>🎚️</div>
          <p className="empty-title">Comunicação palco ↔ mesa de som</p>
          <p className="empty-desc">Crie um palco: ele já vem com 6 botões de recado (ex.: +Mic, +Playback). No palco, quem canta aperta o botão; na mesa de som, o técnico vê o recado na hora.</p>
          {canEdit && <button className="btn btn-primary mt-3" onClick={novoCanal}>Criar primeiro palco</button>}
        </div>
      ) : (
        <>
          {/* monitor da mesa */}
          <Secao titulo="🖥️ Monitor da mesa de som" dica="Abra no computador/tablet da mesa. Toque em “Iniciar monitor” pra ativar o som de alerta.">
            <LinhaLink
              nome={canal.nome}
              link={linkMesa(canal.token_mesa)}
              onQr={() => setQr({ titulo: `Mesa · ${canal.nome}`, link: linkMesa(canal.token_mesa) })}
              onCopiar={copiar}
              onNovo={canEdit ? () => novoLinkCanal('mesa') : undefined}
            />
          </Secao>

          {/* celular */}
          <Secao titulo="📱 Link do celular (palco + mesa)" dica="Um link só pro celular, com as duas funções em abas: enviar recados (a pessoa escolhe qual pedal ela é) e o monitor da mesa. Dá o mesmo poder do link da mesa — entregue só pra quem precisa.">
            <LinhaLink
              nome="Celular"
              link={linkCelular(canal.token_celular)}
              onQr={() => setQr({ titulo: `Celular · ${canal.nome}`, link: linkCelular(canal.token_celular) })}
              onCopiar={copiar}
              onNovo={canEdit ? () => novoLinkCanal('celular') : undefined}
            />
          </Secao>

          {/* pedais */}
          <Secao titulo="🦶 Pedais do palco" dica="Um link por aparelho/posição. A mesa mostra o nome de quem apertou. Pedal físico USB/Bluetooth: programe as teclas 1 a 6 (ou A a F).">
            {pedais.length === 0 && <p className="text-muted text-sm">Nenhum pedal. Crie um para o palco poder enviar recados.</p>}
            {pedais.map(p => {
              const online = !!p.visto_em && Date.now() - Date.parse(p.visto_em) < 45000
              return (
                <LinhaLink key={p.id}
                  nome={p.nome}
                  status={!p.ativo ? 'desativado' : online ? 'online' : 'offline'}
                  link={linkPedal(p.token)}
                  onQr={() => setQr({ titulo: `Pedal · ${p.nome}`, link: linkPedal(p.token) })}
                  onCopiar={copiar}
                  onNovo={canEdit ? () => novoLinkPedal(p) : undefined}
                  extras={canEdit ? [
                    { label: 'Renomear', onClick: () => renomearPedal(p) },
                    { label: p.ativo ? 'Desativar' : 'Ativar', onClick: () => alternarPedal(p) },
                    { label: 'Excluir', onClick: () => excluirPedal(p), perigo: true },
                  ] : []}
                />
              )
            })}
            {canEdit && <button className="btn btn-outline btn-sm mt-2" onClick={novoPedal}>+ Adicionar pedal</button>}
          </Secao>

          {/* botões */}
          <Secao titulo="🔘 Botões (recados)" dica="Nome = o que aparece grande no botão e na mesa. Recado = a explicação embaixo. Opcional: “Etapas” abre telas de escolha antes de enviar (ex.: Back → Sem retorno → Ana = 3 toques). Até 12 botões. Estes são os PADRÃO; botões diferentes por pessoa se configuram no ⚙️ do monitor da mesa.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))', gap: 12 }}>
              {botoes.map(b => (
                <EditorBotao key={b.id} botao={b} canEdit={canEdit}
                  onChange={nb => setBotoes(bs => bs.map(x => (x.id === b.id ? { ...x, ...nb } : x)))}
                  onSalvar={nb => salvarBotao({ ...b, ...nb })}
                  onExcluir={canEdit ? () => excluirBotao(b) : undefined} />
              ))}
              {canEdit && botoes.length < MAX_BOTOES && (
                <button onClick={adicionarBotao} className="btn btn-outline" style={{ minHeight: 120 }}>+ Adicionar botão</button>
              )}
            </div>
          </Secao>

          {/* resumo do dia */}
          <Secao titulo="📊 Recados de hoje">
            {resumo.total === 0 ? <p className="text-muted text-sm">Nenhum recado hoje.</p> : (
              <>
                <p style={{ fontWeight: 700, marginBottom: 8 }}>{resumo.total} recado(s)</p>
                {resumo.porBotao.map(r => (
                  <div key={r.posicao} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                    <span>{r.posicao}. {r.nome}</span><b>{r.total}</b>
                  </div>
                ))}
              </>
            )}
          </Secao>

          {canEdit && (
            <Secao titulo="⚙️ Este palco">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-outline btn-sm" onClick={renomearCanal}>Renomear</button>
                <button className="btn btn-outline btn-sm" onClick={() => salvarCanal({ ativo: !canal.ativo })}>{canal.ativo ? 'Desativar (links param)' : 'Reativar'}</button>
                <button className="btn btn-danger btn-sm" onClick={excluirCanal}>Excluir palco</button>
              </div>
            </Secao>
          )}
        </>
      )}

      {qr && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => e.target === e.currentTarget && setQr(null)}>
          <div style={{ background: 'white', borderRadius: 20, padding: 22, width: '100%', maxWidth: 360, textAlign: 'center' }}>
            <p style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{qr.titulo}</p>
            <div style={{ display: 'inline-block', padding: 12, background: 'white', borderRadius: 12, border: '1px solid var(--border)' }}>
              <QRCodeSVG value={qr.link} size={230} level="M" />
            </div>
            <p className="text-xs text-muted" style={{ wordBreak: 'break-all', margin: '12px 0' }}>{qr.link}</p>
            <p className="text-xs" style={{ color: 'var(--warning)', marginBottom: 12 }}>Quem tiver este link usa a tela sem login. Não publique.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => copiar(qr.link)}>Copiar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setQr(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Secao({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <p style={{ fontSize: 15, fontWeight: 800, marginBottom: dica ? 2 : 10 }}>{titulo}</p>
      {dica && <p className="text-xs text-muted" style={{ marginBottom: 12 }}>{dica}</p>}
      {children}
    </div>
  )
}

function LinhaLink({ nome, status, link, onQr, onCopiar, onNovo, extras = [] }: {
  nome: string; status?: 'online' | 'offline' | 'desativado'; link: string
  onQr: () => void; onCopiar: (l: string) => void; onNovo?: () => void
  extras?: { label: string; onClick: () => void; perigo?: boolean }[]
}) {
  const cor = status === 'online' ? 'var(--success)' : status === 'desativado' ? 'var(--muted)' : status === 'offline' ? 'var(--warning)' : undefined
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <b style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</b>
        {status && <span style={{ fontSize: 12, fontWeight: 700, color: cor }}>● {status === 'online' ? 'conectado' : status === 'offline' ? 'sem contato' : 'desativado'}</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <a className="btn btn-primary btn-sm" href={link} target="_blank" rel="noopener noreferrer">Abrir</a>
        <button className="btn btn-outline btn-sm" onClick={onQr}>QR code</button>
        <button className="btn btn-outline btn-sm" onClick={() => onCopiar(link)}>Copiar link</button>
        {onNovo && <button className="btn btn-ghost btn-sm" onClick={onNovo}>Novo link</button>}
        {extras.map(x => (
          <button key={x.label} className="btn btn-ghost btn-sm" onClick={x.onClick} style={x.perigo ? { color: 'var(--danger)' } : undefined}>{x.label}</button>
        ))}
      </div>
    </div>
  )
}
