// Escolher quem vai ser impresso. Abre ao tocar em "Imprimir".
// Três filtros que conversam entre si e vão estreitando a lista:
//   tipo (encontrista / encontreiro / todos) → equipe (opcional) → busca
// Por cima deles, a seleção manual: marque quem quiser, quantos quiser.
//
// O TIPO é a base: trocá-lo remarca todo mundo daquele tipo (senão, ao pular
// de Encontristas pra Encontreiros, os 76 anteriores iriam junto pra impressora).
// Equipe e busca só estreitam a VISTA — a seleção manual sobrevive a elas.
import { useMemo, useState } from 'react'
import { formatName, getInitials } from '../utils'

export type PessoaImp = { id: string; name: string; photo_url: string | null; role_type?: string | null; cargo?: string | null }
type Tipo = 'encounterer' | 'worker' | 'todos'

type Props = {
  pessoas: PessoaImp[]
  equipes: { id: string; name: string }[]
  equipeIds: Record<string, string[]>       // person_id → team_ids
  tipoInicial?: Tipo
  nomeModelo: string
  folhaLabel: string                        // ex: "A4 em pé"
  porFolha: number
  cabe: boolean
  onCancelar: () => void
  onImprimir: (ids: string[]) => void
}

export default function EscolherPessoas({
  pessoas, equipes, equipeIds, tipoInicial = 'encounterer',
  nomeModelo, folhaLabel, porFolha, cabe, onCancelar, onImprimir,
}: Props) {
  const [tipo, setTipo] = useState<Tipo>(tipoInicial)
  const [equipe, setEquipe] = useState('')
  const [busca, setBusca] = useState('')
  const [cargos, setCargos] = useState<Set<string>>(new Set())   // vazio = todos os cargos

  // Cargos que existem entre as pessoas (pra montar os chips).
  const cargosDisp = useMemo(
    () => Array.from(new Set(pessoas.map(p => (p.cargo ?? '').trim()).filter(Boolean))).sort(),
    [pessoas])

  /** Base da seleção: pessoas do tipo + (se escolheu) só dos cargos marcados. */
  const baseSel = (t: Tipo, cs: Set<string>) =>
    pessoas.filter(p =>
      (t === 'todos' || p.role_type === t) &&
      (cs.size === 0 || cs.has((p.cargo ?? '').trim()))
    ).map(p => p.id)

  // Começa com todo mundo do tipo inicial marcado — assim, quem só quer
  // imprimir tudo é só tocar em Imprimir.
  const [selecionadas, setSelecionadas] = useState<Set<string>>(() => new Set(baseSel(tipoInicial, new Set())))

  /** Trocar o tipo redefine a base (respeitando os cargos escolhidos). */
  function trocarTipo(t: Tipo) {
    setTipo(t)
    if (t === 'encounterer') setEquipe('')   // encontrista não entra em equipe
    setSelecionadas(new Set(baseSel(t, cargos)))
  }
  /** Escolher cargo(s): só quem tem aquele cargo aparece e é impresso. */
  function alternarCargo(c: string) {
    setCargos(prev => {
      const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c)
      setSelecionadas(new Set(baseSel(tipo, n)))
      return n
    })
  }

  // Encontrista não tem equipe: o filtro só aparece pra encontreiros (ou "Todos").
  const mostrarEquipes = tipo !== 'encounterer' && equipes.length > 0

  /** Os filtros aplicados em cascata. */
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return pessoas.filter(p => {
      if (tipo !== 'todos' && p.role_type !== tipo) return false
      if (cargos.size > 0 && !cargos.has((p.cargo ?? '').trim())) return false
      if (equipe && !(equipeIds[p.id] ?? []).includes(equipe)) return false
      if (t && !formatName(p.name).toLowerCase().includes(t)) return false
      return true
    })
  }, [pessoas, tipo, cargos, equipe, busca, equipeIds])

  const nomeEquipes = (pid: string) =>
    (equipeIds[pid] ?? []).map(tid => equipes.find(e => e.id === tid)?.name).filter(Boolean).join(', ')

  function alternar(id: string) {
    setSelecionadas(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  /** "Todos" marca só o que está visível no filtro atual. */
  const marcarVisiveis = () => setSelecionadas(s => new Set([...s, ...lista.map(p => p.id)]))
  const limparTudo = () => setSelecionadas(new Set())

  const total = selecionadas.size
  const foraDoFiltro = total - lista.filter(p => selecionadas.has(p.id)).length
  const folhas = cabe && porFolha > 0 ? Math.ceil(total / porFolha) : 0

  const btnTipo = (v: Tipo, rotulo: string) => (
    <button type="button" onClick={() => trocarTipo(v)}
      style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
        border: tipo === v ? '2px solid var(--primary)' : '1px solid var(--border)',
        background: tipo === v ? 'var(--primary-light)' : 'white',
        color: tipo === v ? 'var(--primary)' : 'var(--text2)' }}>
      {rotulo}
    </button>
  )

  const chipEquipe = (id: string, rotulo: string) => (
    <button key={id || 'todas'} type="button" onClick={() => setEquipe(id)}
      style={{ flexShrink: 0, padding: '6px 13px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
        border: equipe === id ? '1px solid var(--primary)' : '1px solid var(--border)',
        background: equipe === id ? 'var(--primary-light)' : 'white',
        color: equipe === id ? 'var(--primary)' : 'var(--text2)' }}>
      {rotulo}
    </button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 340, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'white', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 17, fontWeight: 800 }}>Quem vai ser impresso</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nomeModelo} · {cabe ? folhaLabel : 'não cabe no A4'}
          </p>
        </div>
        <button onClick={onCancelar} aria-label="Fechar"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', flexShrink: 0 }}>
          <span className="icon icon-sm">close</span>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

        <p style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700, marginBottom: 6 }}>Tipo</p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {btnTipo('encounterer', 'Encontristas')}
          {btnTipo('worker', 'Encontreiros')}
          {btnTipo('todos', 'Todos')}
        </div>

        {mostrarEquipes && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700, marginBottom: 6 }}>
              Equipe <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(opcional)</span>
            </p>
            <div className="ed-tira" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 14, paddingBottom: 2 }}>
              {chipEquipe('', 'Todas')}
              {equipes.map(e => chipEquipe(e.id, e.name))}
            </div>
          </>
        )}

        {cargosDisp.length > 0 && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700, marginBottom: 6 }}>
              Cargo <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(opcional · pode marcar vários)</span>
            </p>
            <div className="ed-tira" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 14, paddingBottom: 2 }}>
              {cargosDisp.map(c => {
                const on = cargos.has(c)
                return (
                  <button key={c} type="button" onClick={() => alternarCargo(c)}
                    style={{ flexShrink: 0, padding: '6px 13px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                      border: on ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: on ? 'var(--primary-light)' : 'white',
                      color: on ? 'var(--primary)' : 'var(--text2)' }}>
                    {on ? '✓ ' : ''}{c}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <input className="form-input" placeholder="Buscar pessoa" value={busca} onChange={e => setBusca(e.target.value)} style={{ marginBottom: 10 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {lista.length} na lista · <b style={{ color: 'var(--primary)' }}>{total} selecionada(s)</b>
          </span>
          {/* "Marcar todos", não "Todos": o filtro de tipo já tem um botão "Todos" */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={marcarVisiveis}>Marcar todos</button>
            <button className="btn btn-ghost btn-sm" onClick={limparTudo}>Limpar</button>
          </div>
        </div>

        {foraDoFiltro > 0 && (
          <p style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>
            {foraDoFiltro} selecionada(s) fora deste filtro — elas também serão impressas.
          </p>
        )}

        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {lista.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '26px 12px' }}>Ninguém neste filtro.</p>}
          {lista.map((p, i) => {
            const on = selecionadas.has(p.id)
            const eq = nomeEquipes(p.id)
            return (
              <button key={p.id} type="button" onClick={() => alternar(p.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  border: 'none', borderBottom: i < lista.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.photo_url
                    ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{getInitials(p.name)}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: on ? 700 : 500, color: on ? 'var(--text)' : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatName(p.name)}</p>
                  {/* encontrista não tem equipe — não sujar a linha com "Sem equipe" */}
                  {eq && <p style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq}</p>}
                </div>
                <span className="icon" style={{ color: on ? 'var(--primary)' : 'var(--border)', flexShrink: 0 }}>
                  {on ? 'check_circle' : 'radio_button_unchecked'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'white', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700 }}>{total} {total === 1 ? 'cópia' : 'cópias'}</p>
          <p style={{ fontSize: 11, color: 'var(--muted)' }}>
            {!cabe ? 'O modelo não cabe no A4' : total === 0 ? 'Escolha pelo menos uma pessoa' : `${folhas} ${folhas === 1 ? 'folha' : 'folhas'} ${folhaLabel} (cabem ${porFolha})`}
          </p>
        </div>
        <button className="btn btn-primary" disabled={total === 0} onClick={() => onImprimir([...selecionadas])}>
          <span className="icon icon-sm">print</span> Imprimir {total > 0 ? total : ''}
        </button>
      </div>
    </div>
  )
}
