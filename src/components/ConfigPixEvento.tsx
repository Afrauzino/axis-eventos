import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { toast } from './Toast'
import { fmtBRL } from '../utils'
import { invalidarEventoAtivo } from '../hooks/useEvento'
import { gerarPixCopiaECola, montarPlano, descreverPlano } from '../lib/pix'

// Financeiro → configuração da inscrição DO EVENTO: contrato, Pix, parcelas e responsáveis (WhatsApp).
type Resp = { id: string; nome: string; whatsapp: string; funcao: string; descricao: string | null; publico: string }
const TIPOS = [['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['email', 'E-mail'], ['telefone', 'Telefone'], ['aleatoria', 'Chave aleatória']]
const PUBLICO: Record<string, string> = { todos: 'Todos', encounterer: 'Encontristas', worker: 'Encontreiros' }
const FUNCAO: Record<string, string> = { financeiro: 'Financeiro', geral: 'Dúvidas gerais', outro: 'Outro assunto' }

export default function ConfigPixEvento({ eventoId, onFechar }: { eventoId: string; onFechar: () => void }) {
  const [f, setF] = useState({ pix_tipo: 'cpf', pix_chave: '', pix_nome: '', pix_cidade: '', parcelas_max: '1', entrada_minima: '0', contrato: '' })
  const [valores, setValores] = useState({ enc: 0, wrk: 0 })
  const [resps, setResps] = useState<Resp[]>([])
  const [novo, setNovo] = useState({ nome: '', whatsapp: '', funcao: 'financeiro', descricao: '', publico: 'todos' })
  const [salvando, setSalvando] = useState(false)
  const [carregado, setCarregado] = useState(false)

  async function carregar() {
    const [{ data: ev }, { data: rs }] = await Promise.all([
      supabase.from('events').select('pix_tipo,pix_chave,pix_nome,pix_cidade,parcelas_max,entrada_minima,valor_encontrista,valor_encontreiro,contrato').eq('id', eventoId).maybeSingle(),
      supabase.from('evento_responsaveis').select('*').eq('event_id', eventoId).order('ordem').order('nome'),
    ])
    if (ev) {
      setF({ pix_tipo: ev.pix_tipo || 'cpf', pix_chave: ev.pix_chave || '', pix_nome: ev.pix_nome || '', pix_cidade: ev.pix_cidade || '',
             parcelas_max: String(ev.parcelas_max ?? 1), entrada_minima: String(ev.entrada_minima ?? 0), contrato: ev.contrato || '' })
      setValores({ enc: Number(ev.valor_encontrista) || 0, wrk: Number(ev.valor_encontreiro) || 0 })
    }
    setResps((rs ?? []) as Resp[]); setCarregado(true)
  }
  useEffect(() => { carregar() }, [eventoId])

  const parcelas = Math.max(1, parseInt(f.parcelas_max) || 1)
  const entradaMin = Math.max(0, parseFloat(f.entrada_minima.replace(',', '.')) || 0)
  const exemplo = valores.enc || valores.wrk

  async function salvar() {
    if (f.pix_chave.trim() && (!f.pix_nome.trim() || !f.pix_cidade.trim())) { toast.aviso('Preencha o nome e a cidade de quem recebe o Pix.'); return }
    setSalvando(true)
    // Pela função (sql/103): o financeiro salva sem precisar de "Administração: editar"
    const { error } = await supabase.rpc('salvar_config_inscricao', { p_event: eventoId, p: {
      pix_tipo: f.pix_tipo, pix_chave: f.pix_chave, pix_nome: f.pix_nome, pix_cidade: f.pix_cidade,
      parcelas_max: parcelas, entrada_minima: entradaMin, contrato: f.contrato,
    } })
    setSalvando(false)
    if (error) { toast.falha(error.message || 'Não foi possível salvar a configuração.', error); return }
    invalidarEventoAtivo()
    toast.sucesso('Configuração da inscrição salva!')
  }

  async function addResp() {
    if (!novo.nome.trim() || novo.whatsapp.replace(/\D/g, '').length < 10) { toast.aviso('Informe o nome e o WhatsApp com DDD.'); return }
    const { error } = await supabase.from('evento_responsaveis').insert({
      event_id: eventoId, nome: novo.nome.trim(), whatsapp: novo.whatsapp.trim(), funcao: novo.funcao,
      descricao: novo.descricao.trim() || null, publico: novo.publico, ordem: resps.length,
    })
    if (error) { toast.falha('Não foi possível adicionar o responsável.', error); return }
    setNovo({ nome: '', whatsapp: '', funcao: 'financeiro', descricao: '', publico: 'todos' }); carregar()
  }
  async function delResp(id: string) {
    if (!confirm('Remover este responsável?')) return
    const { data, error } = await supabase.from('evento_responsaveis').delete().eq('id', id).select('id')
    if (error || !data?.length) { toast.falha('Não foi possível remover.', error); return }
    carregar()
  }

  const codigoTeste = f.pix_chave.trim() ? gerarPixCopiaECola({ chave: f.pix_chave, tipo: f.pix_tipo, nome: f.pix_nome, cidade: f.pix_cidade, valor: 1, txid: 'TESTEAXIS' }) : ''

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 20px 32px', maxHeight: '92vh', overflowY: 'auto', maxWidth: 560, width: '100%', margin: '0 auto' }}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 14px', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Inscrição: contrato, Pix e parcelas</span>
          <button onClick={onFechar} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}><span className="icon icon-sm">close</span></button>
        </div>
        {!carregado ? <div className="skeleton" style={{ height: 200, borderRadius: 12 }} /> : (<>
          <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>📄 Contrato deste evento</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>A pessoa lê o termo (Administração → Termos) e este contrato e assina uma vez. Use {'{{nome}}'} para o nome da pessoa.</p>
          <textarea className="form-input" rows={7} value={f.contrato} onChange={e => setF(v => ({ ...v, contrato: e.target.value }))}
            placeholder="Ex.: Valores, formas de pagamento, política de desistência e reembolso…" style={{ resize: 'vertical', marginBottom: 16, fontFamily: 'inherit' }} />
          <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>🔑 Pix deste evento</p>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Tipo de chave</label>
              <select className="form-input" value={f.pix_tipo} onChange={e => setF(v => ({ ...v, pix_tipo: e.target.value }))}>
                {TIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Chave Pix</label>
              <input className="form-input" value={f.pix_chave} onChange={e => setF(v => ({ ...v, pix_chave: e.target.value }))} placeholder="Ex.: 12.345.678/0001-90" />
            </div>
            <div className="form-group"><label className="form-label">Nome de quem recebe</label>
              <input className="form-input" value={f.pix_nome} maxLength={60} onChange={e => setF(v => ({ ...v, pix_nome: e.target.value }))} placeholder="Como aparece no banco" />
            </div>
            <div className="form-group"><label className="form-label">Cidade de quem recebe</label>
              <input className="form-input" value={f.pix_cidade} onChange={e => setF(v => ({ ...v, pix_cidade: e.target.value }))} />
            </div>
          </div>
          {codigoTeste && (
            <details style={{ fontSize: 12, marginBottom: 12 }}>
              <summary style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 700 }}>Testar: Pix de R$ 1,00 com estes dados</summary>
              <div style={{ textAlign: 'center', marginTop: 8 }}><QRCodeSVG value={codigoTeste} size={150} /></div>
              <p style={{ wordBreak: 'break-all', fontSize: 10, marginTop: 6, color: 'var(--muted)' }}>{codigoTeste}</p>
              <p style={{ fontSize: 11, color: 'var(--muted)' }}>Leia com o app do banco e confira se o nome do recebedor está certo (não precisa pagar).</p>
            </details>
          )}

          <p style={{ fontSize: 13, fontWeight: 800, margin: '8px 0' }}>🧾 Parcelas</p>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Máximo de parcelas</label>
              <input className="form-input" type="number" min={1} value={f.parcelas_max} onChange={e => setF(v => ({ ...v, parcelas_max: e.target.value }))} />
            </div>
            <div className="form-group"><label className="form-label">Entrada mínima (R$)</label>
              <input className="form-input" inputMode="decimal" value={f.entrada_minima} onChange={e => setF(v => ({ ...v, entrada_minima: e.target.value }))} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
            Valores do evento: encontrista {fmtBRL(valores.enc)} · encontreiro {fmtBRL(valores.wrk)} (mude em Administração → Eventos).
            {exemplo > 0 && parcelas > 1 && <> Exemplo em {parcelas}x: {descreverPlano(montarPlano(exemplo, parcelas, Math.max(entradaMin, exemplo / parcelas)), fmtBRL)}.</>}
          </p>
          <button className="btn btn-primary btn-full" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar contrato, Pix e parcelas'}</button>

          <p style={{ fontSize: 13, fontWeight: 800, margin: '22px 0 8px' }}>📲 Responsáveis (WhatsApp)</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Aparecem para a pessoa depois que ela assina, com a mensagem pronta (valor, pago e o que falta).</p>
          {resps.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg)', borderRadius: 10, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 13 }}>{r.nome} <span style={{ fontWeight: 500, color: 'var(--muted)' }}>· {r.whatsapp}</span></p>
                <p style={{ fontSize: 11, color: 'var(--muted)' }}>{FUNCAO[r.funcao] ?? r.funcao}{r.descricao ? ` — ${r.descricao}` : ''} · {PUBLICO[r.publico] ?? r.publico}</p>
              </div>
              <button onClick={() => delResp(r.id)} aria-label="Remover" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><span className="icon icon-sm">delete</span></button>
            </div>
          ))}
          <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: 12, marginTop: 8 }}>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Nome</label>
                <input className="form-input" value={novo.nome} onChange={e => setNovo(v => ({ ...v, nome: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">WhatsApp (com DDD)</label>
                <input className="form-input" inputMode="tel" value={novo.whatsapp} onChange={e => setNovo(v => ({ ...v, whatsapp: e.target.value }))} placeholder="(12) 99999-9999" /></div>
              <div className="form-group"><label className="form-label">Assunto</label>
                <select className="form-input" value={novo.funcao} onChange={e => setNovo(v => ({ ...v, funcao: e.target.value }))}>
                  {Object.entries(FUNCAO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></div>
              <div className="form-group"><label className="form-label">Para quem</label>
                <select className="form-input" value={novo.publico} onChange={e => setNovo(v => ({ ...v, publico: e.target.value }))}>
                  {Object.entries(PUBLICO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></div>
            </div>
            {novo.funcao !== 'financeiro' && (
              <div className="form-group"><label className="form-label">Descrição (opcional)</label>
                <input className="form-input" value={novo.descricao} onChange={e => setNovo(v => ({ ...v, descricao: e.target.value }))} placeholder="Ex.: transporte, hospedagem…" /></div>
            )}
            <button className="btn btn-outline btn-full" onClick={addResp}><span className="icon icon-sm">add</span> Adicionar responsável</button>
          </div>
        </>)}
      </div>
    </div>
  )
}
