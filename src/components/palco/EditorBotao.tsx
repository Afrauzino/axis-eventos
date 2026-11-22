import { useState } from 'react'
import { toast } from '../Toast'
import { PALCO_CORES, type PalcoEtapa } from '../../lib/palco'

// Editor de UM botão do palco (nome, recado, cor, ativo, etapas). Usado na
// configuração dentro do app (/palco) e no painel ⚙️ da mesa (/mesa, /cel).

export type BotaoCfg = { posicao: number; nome: string; mensagem: string; cor: string; ativo: boolean; etapas: PalcoEtapa[] }

/** Tira opções vazias/repetidas e etapas sem opção (o banco recusa formato inválido). */
export function limparEtapas(etapas: PalcoEtapa[] | undefined): PalcoEtapa[] {
  return (etapas ?? []).map(e => ({
    titulo: e.titulo.trim().slice(0, 40),
    opcoes: [...new Set(e.opcoes.map(o => o.trim().slice(0, 30)).filter(Boolean))].slice(0, 6),
  })).filter(e => e.opcoes.length > 0).slice(0, 2)
}

export function EditorBotao({ botao, canEdit, onChange, onSalvar }: {
  botao: BotaoCfg; canEdit: boolean; onChange: (b: BotaoCfg) => void; onSalvar: (b: BotaoCfg) => void
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
