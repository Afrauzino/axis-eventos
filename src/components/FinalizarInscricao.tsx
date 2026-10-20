import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { toast } from './Toast'
import { fmtBRL } from '../utils'
import AssinaturaCanvas, { type AssinaturaRef } from './AssinaturaCanvas'
import { gerarPixCopiaECola, montarPlano, proximoPagamento, descreverPlano, linkWhatsApp, txidDe } from '../lib/pix'

// Fim da inscrição em TODO evento: termo + valor + parcelas → assinatura com o dedo →
// Pix da parcela + WhatsApp do responsável. Tudo vem do banco (sql/98), que é o mesmo
// que o Koinonia usa — assinou/pagou em um, o outro sabe.
export type Resumo = {
  pessoa: { id: string; nome: string; role_type: string }
  evento: { id: string; nome: string; inicio: string | null; fim: string | null }
  termo: string; contrato?: string; texto_hash?: string; valor_total: number; pago: number; falta: number
  parcelas_max: number; entrada_minima: number
  pix: { chave: string; tipo: string | null; nome: string | null; cidade: string | null } | null
  aceite: { parcelas: number; entrada: number; valor_total: number; aceito_em: string; origem: string; assinatura_path: string } | null
  responsaveis: { nome: string; whatsapp: string; funcao: string; descricao: string | null }[]
}

const papel = (rt: string) => rt === 'worker' ? 'Encontreiro(a)' : 'Encontrista'

export default function FinalizarInscricao({ personId, onAssinou }: { personId: string; onAssinou?: () => void }) {
  const [r, setR] = useState<Resumo | null>(null)
  const [erro, setErro] = useState('')
  const [parcelas, setParcelas] = useState(1)
  const [entrada, setEntrada] = useState('')
  const [aceito, setAceito] = useState(false)
  const [temAssinatura, setTemAssinatura] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [pagarTudo, setPagarTudo] = useState(false)
  const assin = useRef<AssinaturaRef>(null)

  async function carregar() {
    setErro('')
    const { data, error } = await supabase.rpc('inscricao_resumo', { p_person: personId })
    if (error || !data) { setErro(error?.message || 'Não foi possível carregar sua inscrição.'); return }
    setR(data as Resumo)
  }
  useEffect(() => { carregar() }, [personId])

  // Entrada sugerida: o maior entre a mínima e uma parcela "igual"
  useEffect(() => {
    if (!r || parcelas <= 1) return
    const igual = Math.ceil((r.valor_total / parcelas) * 100) / 100
    setEntrada(String(Math.max(r.entrada_minima, igual).toFixed(2)))
  }, [parcelas, r?.valor_total, r?.entrada_minima])

  if (erro) return <div className="alert-box alert-warning">{erro}</div>
  if (!r) return <div className="skeleton" style={{ height: 220, borderRadius: 14 }} />

  const entradaNum = parseFloat((entrada || '0').replace(',', '.')) || 0
  const planoEscolhido = montarPlano(r.valor_total, parcelas, entradaNum)
  const entradaInvalida = parcelas > 1 && (entradaNum < r.entrada_minima || entradaNum > r.valor_total)

  async function assinar() {
    if (!r) return
    if (!aceito) { toast.aviso('Marque que leu e concorda com o termo e o valor.'); return }
    if (!temAssinatura || assin.current?.vazia()) { toast.aviso('Faça sua assinatura no quadro.'); return }
    if (entradaInvalida) { toast.aviso(`A entrada precisa ser de pelo menos ${fmtBRL(r.entrada_minima)}.`); return }
    setEnviando(true)
    try {
      const png = await assin.current!.png()
      if (!png) throw new Error('Não foi possível gerar a assinatura.')
      const path = `${r.evento.id}/${r.pessoa.id}.png`
      const up = await supabase.storage.from('assinaturas').upload(path, png, { upsert: true, contentType: 'image/png' })
      if (up.error) throw up.error
      const { data, error } = await supabase.rpc('inscricao_registrar_aceite', {
        p_person: r.pessoa.id, p_parcelas: parcelas, p_entrada: planoEscolhido.entrada,
        p_assinatura_path: path, p_user_agent: navigator.userAgent,
      })
      if (error) throw error
      setR(data as Resumo)
      toast.sucesso('Termo assinado! Agora é só fazer o Pix.')
      onAssinou?.()
    } catch (e: any) {
      toast.falha(e?.message || 'Não foi possível concluir a assinatura.', e)
    }
    setEnviando(false)
  }

  // ── Já assinou: pagamento ────────────────────────────────────────────────────
  if (r.aceite) {
    const plano = montarPlano(r.aceite.valor_total, r.aceite.parcelas, r.aceite.entrada)
    const prox = proximoPagamento(plano, r.pago)
    const valorPix = pagarTudo ? r.falta : prox.valor
    const codigo = r.pix && valorPix > 0
      ? gerarPixCopiaECola({ ...r.pix, valor: valorPix, txid: txidDe(r.pessoa.id, pagarTudo ? 'T' : 'P' + prox.numero) })
      : ''
    const pct = r.valor_total > 0 ? Math.min(100, Math.round((r.pago / r.valor_total) * 100)) : 100
    const msgZap = (resp: string) =>
      `Olá ${resp.split(' ')[0]}! Sou ${r.pessoa.nome} e me inscrevi no ${r.evento.nome} como ${papel(r.pessoa.role_type)}. ` +
      `Valor total: ${fmtBRL(r.valor_total)}. Já paguei: ${fmtBRL(r.pago)}. ` +
      (r.falta > 0 ? `Falta: ${fmtBRL(r.falta)} (${descreverPlano(plano, fmtBRL)}).` : 'Pagamento completo!')

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="alert-box alert-success" style={{ fontSize: 13 }}>
          ✅ Termo do <b>{r.evento.nome}</b> assinado em {new Date(r.aceite.aceito_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          {r.aceite.origem === 'koinonia' ? ' (pelo Koinonia)' : ''} · {papel(r.pessoa.role_type)}
        </div>

        <div style={{ background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>💰 Meu pagamento</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, textAlign: 'center', marginBottom: 10 }}>
            {[['Total', r.valor_total, 'var(--text)'], ['Pago', r.pago, 'var(--success)'], ['Falta', r.falta, r.falta > 0 ? 'var(--warning)' : 'var(--success)']].map(([l, v, c]) => (
              <div key={l as string} style={{ background: 'var(--bg)', borderRadius: 10, padding: '8px 4px' }}>
                <p style={{ fontSize: 11, color: 'var(--muted)' }}>{l as string}</p>
                <p style={{ fontSize: 15, fontWeight: 800, color: c as string }}>{fmtBRL(v as number)}</p>
              </div>
            ))}
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--success)', borderRadius: 99 }} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Plano: {descreverPlano(plano, fmtBRL)}</p>
        </div>

        {r.falta > 0 && (
          <div style={{ background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: 16, textAlign: 'center' }}>
            {!r.pix ? (
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>O financeiro ainda vai cadastrar o Pix deste evento. Fale com o responsável abaixo.</p>
            ) : (
              <>
                <p style={{ fontSize: 13, fontWeight: 800 }}>
                  {pagarTudo ? 'Pagar tudo o que falta' : plano.parcelas > 1 ? (prox.numero === 1 ? 'Entrada' : `Parcela ${prox.numero} de ${plano.parcelas}`) : 'Pagamento'}
                </p>
                <p style={{ fontSize: 26, fontWeight: 900, color: 'var(--primary)', margin: '4px 0 12px' }}>{fmtBRL(valorPix)}</p>
                <div style={{ display: 'inline-block', background: 'white', padding: 10, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <QRCodeSVG value={codigo} size={190} level="M" />
                </div>
                <p style={{ fontSize: 11, color: 'var(--muted)', margin: '10px 0 6px' }}>Ou use o Pix copia e cola:</p>
                <div style={{ fontSize: 10, wordBreak: 'break-all', background: 'var(--bg)', borderRadius: 8, padding: 8, textAlign: 'left', maxHeight: 70, overflowY: 'auto' }}>{codigo}</div>
                <button className="btn btn-primary btn-full" style={{ marginTop: 10 }}
                  onClick={() => navigator.clipboard.writeText(codigo).then(() => toast.sucesso('Código Pix copiado!'), () => toast.aviso('Não deu pra copiar — segure no código e copie.'))}>
                  <span className="icon icon-sm">content_copy</span> Copiar código Pix
                </button>
                {plano.parcelas > 1 && r.falta > prox.valor && (
                  <button className="btn btn-outline btn-full btn-sm" style={{ marginTop: 8 }} onClick={() => setPagarTudo(v => !v)}>
                    {pagarTudo ? 'Voltar para a parcela' : `Prefiro pagar tudo (${fmtBRL(r.falta)})`}
                  </button>
                )}
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                  Recebedor: {r.pix.nome || '—'}. O pagamento aparece aqui quando o financeiro confirmar.
                </p>
              </>
            )}
          </div>
        )}
        {r.falta <= 0 && <div className="alert-box alert-success">🎉 Pagamento completo. Obrigado!</div>}

        {r.responsaveis.length > 0 && (
          <div style={{ background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 800 }}>📲 Avisar o responsável</p>
            {r.responsaveis.map((p, i) => (
              <a key={i} className="btn btn-full" href={linkWhatsApp(p.whatsapp, msgZap(p.nome))} target="_blank" rel="noopener noreferrer"
                style={{ background: '#25D366', color: 'white', textDecoration: 'none', justifyContent: 'center' }}>
                WhatsApp · {p.nome}{p.funcao === 'financeiro' ? ' (financeiro)' : p.descricao ? ` (${p.descricao})` : ''}
              </a>
            ))}
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>A mensagem já vai pronta com o valor, o que você pagou e o que falta. Mande junto o comprovante.</p>
          </div>
        )}
      </div>
    )
  }

  // ── Ainda não assinou ────────────────────────────────────────────────────────
  const opcoes = Array.from({ length: Math.max(1, r.parcelas_max) }, (_, i) => i + 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: 16 }}>
        <p style={{ fontSize: 15, fontWeight: 800 }}>📝 Finalize sua inscrição</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{r.evento.nome} · {papel(r.pessoa.role_type)}</p>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, lineHeight: 1.5 }}>
          Em todo evento é preciso ler e assinar o termo, mesmo que você já tenha participado de outros.
        </p>
      </div>

      <div style={{ background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>📜 Termo do evento</p>
        <div style={{ maxHeight: 240, overflowY: 'auto', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'var(--bg)', borderRadius: 10, padding: 12, color: 'var(--text2)' }}>
          {r.termo.trim() || 'Este evento não tem um texto de termo cadastrado. Sua assinatura confirma a inscrição e o valor abaixo.'}
        </div>
      </div>

      {!!r.contrato?.trim() && (
        <div style={{ background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>📄 Contrato</p>
          <div style={{ maxHeight: 240, overflowY: 'auto', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'var(--bg)', borderRadius: 10, padding: 12, color: 'var(--text2)' }}>{r.contrato}</div>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>💰 Valor da inscrição</p>
        <p style={{ fontSize: 24, fontWeight: 900, color: 'var(--primary)' }}>{fmtBRL(r.valor_total)}</p>
        {r.valor_total > 0 && r.parcelas_max > 1 && (
          <>
            <p className="form-label" style={{ marginTop: 10 }}>Como você quer pagar?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {opcoes.map(n => (
                <button key={n} type="button" onClick={() => setParcelas(n)}
                  style={{ padding: '8px 12px', borderRadius: 99, border: '1.5px solid ' + (parcelas === n ? 'var(--primary)' : 'var(--border)'), background: parcelas === n ? 'var(--primary)' : 'white', color: parcelas === n ? 'white' : 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {n === 1 ? 'À vista' : `${n}x`}
                </button>
              ))}
            </div>
            {parcelas > 1 && (
              <div className="form-group" style={{ marginTop: 10 }}>
                <label className="form-label">Entrada (mínimo {fmtBRL(r.entrada_minima)})</label>
                <input className="form-input" inputMode="decimal" value={entrada} onChange={e => setEntrada(e.target.value)} />
                {entradaInvalida && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>A entrada precisa estar entre {fmtBRL(r.entrada_minima)} e {fmtBRL(r.valor_total)}.</p>}
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>Plano: <b>{descreverPlano(planoEscolhido, fmtBRL)}</b></p>
          </>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: 16 }}>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.5, cursor: 'pointer', marginBottom: 12 }}>
          <input type="checkbox" checked={aceito} onChange={e => setAceito(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
          <span>Li e concordo com o termo{r.contrato?.trim() ? ', o contrato' : ''}, o valor de <b>{fmtBRL(r.valor_total)}</b> e o plano de pagamento escolhido.</span>
        </label>
        <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>✍️ Sua assinatura</p>
        <AssinaturaCanvas ref={assin} onMudar={setTemAssinatura} />
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{r.pessoa.nome}</p>
        <button className="btn btn-primary btn-full" style={{ marginTop: 12 }} disabled={enviando || !aceito || !temAssinatura || entradaInvalida} onClick={assinar}>
          {enviando ? 'Enviando...' : 'Assinar e concluir inscrição'}
        </button>
      </div>
    </div>
  )
}
