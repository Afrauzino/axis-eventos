import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { confirmar } from '../components/Confirmar'
import { toast } from '../components/Toast'
import { isAdmin } from '../utils'
import { PALCO_CORES, linkMesa, linkPedal, linkCelular, type PalcoEtapa } from '../lib/palco'
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
      supabase.from('palco_botoes').select('*').eq('canal_id', id).order('posicao'),
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
    const etapas = (b.etapas ?? []).map(e => ({
      titulo: e.titulo.trim().slice(0, 40),
      opcoes: [...new Set(e.opcoes.map(o => o.trim().slice(0, 30)).filter(Boolean))].slice(0, 6),
    })).filter(e => e.opcoes.length > 0).slice(0, 2)
    const { error } = await supabase.from('palco_botoes')
      .update({ nome: nome.slice(0, 24), mensagem: b.mensagem.trim().slice(0, 160), cor: b.cor, ativo: b.ativo, etapas }).eq('id', b.id)
    if (error) { toast.falha('Não foi possível salvar o botão', error); return }
    setBotoes(bs => bs.map(x => (x.id === b.id ? { ...b, nome, etapas } : x)))
    toast.sucesso(`Botão ${b.posicao} salvo`)
  }
  async function criarSlot(posicao: number) {
    if (!canal) return
    const { error } = await supabase.from('palco_botoes').insert({ canal_id: canal.id, posicao, nome: `Botão ${posicao}`, mensagem: '' })
    if (error) { toast.falha('Não foi possível criar o botão', error); return }
    carregarCanal(canal.id)
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

  const slots = useMemo(() => [1, 2, 3, 4, 5, 6].map(pos => botoes.find(b => b.posicao === pos) ?? null), [botoes])

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
          <Secao titulo="🔘 Botões (recados)" dica="Nome = o que aparece grande no botão e na mesa. Recado = a explicação embaixo. Opcional: “Etapas” abre telas de escolha antes de enviar (ex.: Back → Sem retorno → Ana = 3 toques).">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))', gap: 12 }}>
              {slots.map((b, i) => b
                ? <EditorBotao key={b.id} botao={b} canEdit={canEdit}
                    onChange={nb => setBotoes(bs => bs.map(x => (x.id === nb.id ? nb : x)))}
                    onSalvar={salvarBotao} />
                : canEdit && (
                  <button key={`vazio-${i}`} onClick={() => criarSlot(i + 1)} className="btn btn-outline" style={{ minHeight: 120 }}>+ Criar botão {i + 1}</button>
                ))}
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

function EditorBotao({ botao, canEdit, onChange, onSalvar }: {
  botao: Botao; canEdit: boolean; onChange: (b: Botao) => void; onSalvar: (b: Botao) => void
}) {
  const b = botao
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', opacity: b.ativo ? 1 : .6 }}>
      {/* prévia */}
      <div style={{ background: b.cor, color: 'white', padding: '12px 14px', position: 'relative', minHeight: 74 }}>
        <span style={{ position: 'absolute', top: 8, right: 10, fontSize: 12, fontWeight: 800, background: 'rgba(0,0,0,.25)', borderRadius: 6, padding: '1px 7px' }}>tecla {b.posicao}</span>
        <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1, paddingRight: 56 }}>{b.nome || '—'}</div>
        <div style={{ fontSize: 13, opacity: .92 }}>{b.mensagem}</div>
        {!!b.etapas?.length && <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4 }}>{b.etapas.length + 1} toques: {[b.nome, ...b.etapas.map(e => e.titulo || 'escolha')].join(' → ')}</div>}
      </div>
      {canEdit && (
        <div style={{ padding: 12 }}>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Nome no botão</label>
            <input className="form-input" maxLength={24} value={b.nome} placeholder="+Mic" onChange={e => onChange({ ...b, nome: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Recado</label>
            <input className="form-input" maxLength={160} value={b.mensagem} placeholder="Aumenta o microfone no retorno" onChange={e => onChange({ ...b, mensagem: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {PALCO_CORES.map(c => (
              <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => onChange({ ...b, cor: c })}
                style={{ width: 28, height: 28, borderRadius: 8, background: c, border: 'none', cursor: 'pointer', boxShadow: b.cor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none' }} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input type="color" value={b.cor} aria-label="Cor personalizada" onChange={e => onChange({ ...b, cor: e.target.value })}
              style={{ width: 40, height: 32, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
            <span className="text-xs text-muted">Qualquer cor — é a cor que pisca na mesa</span>
          </div>
          <EditorEtapas etapas={b.etapas ?? []} cor={b.cor} nome={b.nome} onChange={etapas => onChange({ ...b, etapas })} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, flex: 1, cursor: 'pointer' }}>
              <input type="checkbox" checked={b.ativo} onChange={e => onChange({ ...b, ativo: e.target.checked })} /> Ativo no palco
            </label>
            <button className="btn btn-primary btn-sm" onClick={() => onSalvar(b)}>Salvar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Etapas opcionais do botão: até 2 telas de escolha (até 6 opções cada) antes de enviar.
function EditorEtapas({ etapas, cor, nome, onChange }: { etapas: PalcoEtapa[]; cor: string; nome: string; onChange: (e: PalcoEtapa[]) => void }) {
  const [nova, setNova] = useState<Record<number, string>>({})
  function mudar(i: number, e: Partial<PalcoEtapa>) { onChange(etapas.map((x, j) => (j === i ? { ...x, ...e } : x))) }
  function addOpcao(i: number) {
    const txt = (nova[i] ?? '').trim().slice(0, 30)
    if (!txt) return
    if (etapas[i].opcoes.includes(txt)) { setNova(n => ({ ...n, [i]: '' })); return }
    if (etapas[i].opcoes.length >= 6) { toast.aviso('Máximo de 6 opções por etapa'); return }
    mudar(i, { opcoes: [...etapas[i].opcoes, txt] })
    setNova(n => ({ ...n, [i]: '' }))
  }
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: etapas.length ? 8 : 0 }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>Etapas antes de enviar <span className="text-muted" style={{ fontWeight: 500 }}>(opcional)</span></span>
        {etapas.length < 2 && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange([...etapas, { titulo: etapas.length ? 'Qual?' : 'O que houve?', opcoes: [] }])}>+ Etapa</button>
        )}
      </div>
      {etapas.length === 0 && <p className="text-xs text-muted" style={{ marginTop: 4 }}>Sem etapas: 1 toque envia direto.</p>}
      {etapas.map((et, i) => (
        <div key={i} style={{ background: 'white', borderRadius: 10, padding: 10, marginBottom: 8, borderLeft: `4px solid ${cor}` }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>Toque {i + 2}</span>
            <input className="form-input" style={{ flex: 1 }} maxLength={40} value={et.titulo} placeholder="Pergunta (ex.: Qual back?)" onChange={e => mudar(i, { titulo: e.target.value })} />
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => onChange(etapas.filter((_, j) => j !== i))} aria-label="Remover etapa">✕</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {et.opcoes.map((op, k) => (
              <span key={op} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: cor, color: 'white', borderRadius: 99, padding: '4px 6px 4px 10px', fontSize: 13, fontWeight: 700 }}>
                <small style={{ opacity: .8 }}>{k + 1}</small> {op}
                <button type="button" onClick={() => mudar(i, { opcoes: et.opcoes.filter(x => x !== op) })} aria-label={`Remover ${op}`}
                  style={{ background: 'rgba(0,0,0,.25)', border: 'none', color: 'white', borderRadius: 99, width: 20, height: 20, cursor: 'pointer', fontSize: 11 }}>✕</button>
              </span>
            ))}
            {et.opcoes.length === 0 && <span className="text-xs" style={{ color: 'var(--danger)' }}>Adicione pelo menos 1 opção</span>}
          </div>
          {et.opcoes.length < 6 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="form-input" style={{ flex: 1 }} maxLength={30} value={nova[i] ?? ''} placeholder={i === 0 ? 'Opção (ex.: Sem retorno)' : 'Opção (ex.: Ana)'}
                onChange={e => setNova(n => ({ ...n, [i]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOpcao(i) } }} />
              <button type="button" className="btn btn-outline btn-sm" onClick={() => addOpcao(i)}>Adicionar</button>
            </div>
          )}
        </div>
      ))}
      {etapas.length > 0 && (
        <p className="text-xs text-muted">No palco: <b>{nome || 'Botão'}</b> → {etapas.map(e => `[${e.opcoes.slice(0, 3).join(' / ') || '…'}${e.opcoes.length > 3 ? ' …' : ''}]`).join(' → ')} → envia. Lembre de salvar.</p>
      )}
    </div>
  )
}
