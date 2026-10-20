// "Abrir inscrição no Koinonia" — fica no card de cada evento (Admin → Eventos).
//
// Ligado, o evento aparece no Koinonia (menu "Inscrição em encontro") pra quem
// tem cadastro lá. A pessoa se inscreve com os dados que já tem, lê o termo e
// o valor e assina com o dedo; a inscrição chega aqui como PENDENTE, já com o
// aceite assinado (sql/98 + sql/99). Quem ainda não tem conta no AXIS ganha um
// código de primeiro acesso.
//
// Componente autocontido de propósito: lê e grava só as colunas koinonia_* do
// evento, sem mexer no formulário de evento do Admin.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from './Toast'

type Papel = 'encounterer' | 'worker'
const PAPEIS: { v: Papel; rot: string; emoji: string }[] = [
  { v: 'encounterer', rot: 'Encontrista', emoji: '🙏' },
  { v: 'worker', rot: 'Encontreiro', emoji: '🤝' },
]

export default function InscricaoKoinonia({ eventoId, encerrado }: { eventoId: string; encerrado?: boolean }) {
  const [cfg, setCfg] = useState<{ aberto: boolean; papeis: Papel[]; ate: string } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [semColuna, setSemColuna] = useState(false)

  useEffect(() => {
    supabase.from('events').select('koinonia_aberto,koinonia_papeis,inscricao_ate').eq('id', eventoId).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setSemColuna(/koinonia/i.test(error.message)); return }
        setCfg({ aberto: !!data?.koinonia_aberto, papeis: (data?.koinonia_papeis ?? []) as Papel[], ate: data?.inscricao_ate ?? '' })
      })
  }, [eventoId])

  if (semColuna) return null          // sql/99 ainda não rodou: não mostra nada quebrado
  if (!cfg) return null

  async function salvar(novo: typeof cfg) {
    if (!novo) return
    if (novo.aberto && novo.papeis.length === 0) { toast.aviso('Escolha pelo menos um papel aberto.'); return }
    const anterior = cfg
    setCfg(novo); setSalvando(true)
    const { error } = await supabase.from('events').update({
      koinonia_aberto: novo.aberto, koinonia_papeis: novo.papeis, inscricao_ate: novo.ate || null,
    }).eq('id', eventoId).select('id').single()
    setSalvando(false)
    if (error) { setCfg(anterior); toast.erro('Não salvou: ' + error.message); return }
    toast.sucesso(novo.aberto ? 'Inscrição aberta no Koinonia' : 'Inscrição fechada no Koinonia')
  }

  const abrir = () => salvar({ ...cfg, aberto: !cfg.aberto, papeis: !cfg.aberto && cfg.papeis.length === 0 ? ['encounterer', 'worker'] : cfg.papeis })
  const alternaPapel = (p: Papel) => {
    const papeis = cfg.papeis.includes(p) ? cfg.papeis.filter(x => x !== p) : [...cfg.papeis, p]
    if (cfg.aberto && papeis.length === 0) { toast.aviso('Deixe pelo menos um papel aberto, ou feche a inscrição.'); return }
    salvar({ ...cfg, papeis })
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>📲</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 13 }}>Inscrição pelo Koinonia</p>
          <p style={{ fontSize: 11, color: 'var(--muted)' }}>
            {cfg.aberto ? 'Aberta — aparece no Koinonia para quem tem cadastro lá' : 'Fechada'}
          </p>
        </div>
        <button onClick={abrir} disabled={salvando || (encerrado && !cfg.aberto)} aria-label="Abrir/fechar inscrição no Koinonia"
          style={{ width: 50, height: 28, borderRadius: 99, border: 'none', cursor: 'pointer', background: cfg.aberto ? 'var(--success)' : 'var(--border)', position: 'relative', flexShrink: 0, transition: 'background 0.15s', opacity: salvando ? 0.6 : 1 }}>
          <span style={{ position: 'absolute', top: 3, left: cfg.aberto ? 25 : 3, width: 22, height: 22, borderRadius: '50%', background: 'white', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
        </button>
      </div>

      {cfg.aberto && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>Quem pode se inscrever</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {PAPEIS.map(p => {
              const on = cfg.papeis.includes(p.v)
              return (
                <button key={p.v} onClick={() => alternaPapel(p.v)} disabled={salvando}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                    border: `2px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary-light)' : 'white', color: on ? 'var(--primary)' : 'var(--text2)' }}>
                  <span>{p.emoji}</span> {p.rot}
                </button>
              )
            })}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
            Inscrições até
            <input type="date" className="input" value={cfg.ate} onChange={e => salvar({ ...cfg, ate: e.target.value })}
              style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} />
            {cfg.ate && <button className="btn btn-ghost btn-sm" onClick={() => salvar({ ...cfg, ate: '' })}>sem prazo</button>}
          </label>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
            A inscrição chega em Usuários como pendente, com o termo e o valor deste evento assinados no celular.
          </p>
        </div>
      )}
    </div>
  )
}
