import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Item = { id: string; title: string; type: string; start_time: string; end_time: string; status: string; location: string | null }

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const TIPO_LABEL: Record<string, string> = {
  ministry: 'Ministério', theater: 'Teatro', break: 'Intervalo',
  meal: 'Refeição', activity: 'Atividade', prayer: 'Oração', worship: 'Louvor'
}

const STATUS_COR: Record<string, string> = {
  not_started: '#A0AEC0', in_progress: '#F5A623', done: '#38A169', canceled: '#E53E3E'
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Pendente', in_progress: 'Em andamento', done: 'Concluído', canceled: 'Cancelado'
}

export default function Agenda() {
  const [itens, setItens] = useState<Item[]>([])
  const [eventoId, setEventoId] = useState('')
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Item | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ title: '', type: 'ministry', start_time: '', end_time: '', location: '' })

  // Calendário
  const hoje = new Date()
  const [dataSelecionada, setDataSelecionada] = useState(hoje)
  const inicioSemana = new Date(dataSelecionada)
  inicioSemana.setDate(dataSelecionada.getDate() - dataSelecionada.getDay())

  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana)
    d.setDate(inicioSemana.getDate() + i)
    return d
  })

  useEffect(() => {
    supabase.from('events').select('id').order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setEventoId(data[0].id) })
  }, [])

  useEffect(() => { if (eventoId) { setLoading(true); carregar() } }, [eventoId])

  async function carregar() {
    const { data } = await supabase.from('schedules').select('*').eq('event_id', eventoId).order('start_time')
    setItens(data ?? [])
    setLoading(false)
  }

  async function mudarStatus(id: string, status: string) {
    await supabase.from('schedules').update({ status }).eq('id', id)
    carregar()
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const payload = {
      title: form.title, type: form.type, location: form.location || null,
      start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(),
      status: 'not_started',
    }
    if (editando) {
      await supabase.from('schedules').update(payload).eq('id', editando.id)
    } else {
      await supabase.from('schedules').insert({ ...payload, event_id: eventoId })
    }
    setModal(false); setSalvando(false); setEditando(null)
    setForm({ title: '', type: 'ministry', start_time: '', end_time: '', location: '' })
    carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Remover este item?')) return
    await supabase.from('schedules').delete().eq('id', id)
    carregar()
  }

  function abrirEdicao(item: Item) {
    setEditando(item)
    const toLocal = (iso: string) => new Date(iso).toISOString().slice(0, 16)
    setForm({ title: item.title, type: item.type, start_time: toLocal(item.start_time), end_time: toLocal(item.end_time), location: item.location ?? '' })
    setModal(true)
  }

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const mesmodia = (iso: string) => {
    const d = new Date(iso)
    return d.toDateString() === dataSelecionada.toDateString()
  }

  const itensDia = itens.filter(i => mesmodia(i.start_time))
  const itensFiltrados = filtro === 'todos' ? itensDia : itensDia.filter(i => i.status === filtro)

  // Agrupar por hora
  const grupos: Record<string, Item[]> = {}
  itensFiltrados.forEach(item => {
    const hora = `${new Date(item.start_time).getHours()}h`
    if (!grupos[hora]) grupos[hora] = []
    grupos[hora].push(item)
  })

  return (
    <div className="page">
      {/* Mini calendário semanal */}
      <div className="card" style={{ padding: '12px 8px', marginBottom: 12 }}>
        {/* Mês e navegação */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 8px' }}>
          <button onClick={() => { const d = new Date(dataSelecionada); d.setDate(d.getDate() - 7); setDataSelecionada(d) }}
            style={{ background: 'var(--fundo)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>‹</button>
          <p style={{ fontWeight: 700, fontSize: 15 }}>
            {MESES[dataSelecionada.getMonth()]} {dataSelecionada.getFullYear()}
          </p>
          <button onClick={() => { const d = new Date(dataSelecionada); d.setDate(d.getDate() + 7); setDataSelecionada(d) }}
            style={{ background: 'var(--fundo)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>›</button>
        </div>

        {/* Dias */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {diasSemana.map((dia, i) => {
            const isHoje = dia.toDateString() === hoje.toDateString()
            const isSelecionado = dia.toDateString() === dataSelecionada.toDateString()
            const temItens = itens.some(item => new Date(item.start_time).toDateString() === dia.toDateString())

            return (
              <button key={i} onClick={() => setDataSelecionada(new Date(dia))}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 4px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: isSelecionado ? 'var(--laranja)' : isHoje ? 'var(--turquesa-light)' : 'transparent',
                  transition: 'all 0.15s',
                }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: isSelecionado ? 'white' : 'var(--muted)' }}>
                  {DIAS[dia.getDay()]}
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, color: isSelecionado ? 'white' : isHoje ? 'var(--turquesa)' : 'var(--texto)' }}>
                  {dia.getDate()}
                </span>
                {temItens && <div style={{ width: 5, height: 5, borderRadius: '50%', background: isSelecionado ? 'white' : 'var(--turquesa)' }} />}
              </button>
            )
          })}
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
          {dataSelecionada.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Filtros status */}
      <div className="filtros">
        {[['todos','Todos'], ['not_started','Pendentes'], ['in_progress','Em andamento'], ['done','Concluídos']].map(([v, l]) => (
          <button key={v} className={`filtro-btn ${filtro === v ? 'active' : ''}`} onClick={() => setFiltro(v)}>{l}</button>
        ))}
      </div>

      {/* Lista do dia */}
      {loading ? (
        <div>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 10, borderRadius: 16 }} />)}</div>
      ) : Object.keys(grupos).length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <p className="empty-state-title">Nenhum item</p>
          <p className="empty-state-desc">Nenhuma atividade agendada para este dia.</p>
        </div>
      ) : (
        Object.entries(grupos).map(([hora, items]) => (
          <div key={hora}>
            <p className="hora-grupo">{hora}</p>
            {items.map(item => (
              <div key={item.id} className={`agenda-card status-${item.status}`} style={{ cursor: 'pointer' }} onClick={() => abrirEdicao(item)}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: STATUS_COR[item.status] }}>
                    {fmt(item.start_time)}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>{fmt(item.end_time)}</p>
                </div>
                <div className="agenda-content">
                  <p className="agenda-title">{item.title}</p>
                  <p className="agenda-detail">
                    {TIPO_LABEL[item.type] ?? item.type}
                    {item.location ? ` · ${item.location}` : ''}
                  </p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {item.status !== 'done' && item.status !== 'canceled' && (
                      <>
                        {item.status === 'not_started' && (
                          <button className="btn btn-sm" style={{ background: '#EBF8FF', color: 'var(--info)', padding: '4px 10px', fontSize: 12 }}
                            onClick={e => { e.stopPropagation(); mudarStatus(item.id, 'in_progress') }}>▶ Iniciar</button>
                        )}
                        {item.status === 'in_progress' && (
                          <button className="btn btn-sm" style={{ background: '#E6F7EE', color: 'var(--success)', padding: '4px 10px', fontSize: 12 }}
                            onClick={e => { e.stopPropagation(); mudarStatus(item.id, 'done') }}>✓ Concluir</button>
                        )}
                        <button className="btn btn-sm" style={{ background: '#FDE8E8', color: 'var(--danger)', padding: '4px 10px', fontSize: 12 }}
                          onClick={e => { e.stopPropagation(); mudarStatus(item.id, 'canceled') }}>✕ Cancelar</button>
                      </>
                    )}
                    <span className="badge badge-gray" style={{ fontSize: 11 }}>{STATUS_LABEL[item.status]}</span>
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); excluir(item.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, alignSelf: 'flex-start' }}>⋮</button>
              </div>
            ))}
          </div>
        ))
      )}

      {/* FAB */}
      <button className="fab" onClick={() => { setEditando(null); setForm({ title: '', type: 'ministry', start_time: '', end_time: '', location: '' }); setModal(true) }}>+</button>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-handle" />
            <div className="modal-header">
              <p className="modal-title">{editando ? 'Editar item' : 'Novo item'}</p>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={salvar}>
              <div className="field"><label>Título *</label>
                <input placeholder="Nome da atividade" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="field"><label>Tipo</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field"><label>Início *</label>
                  <input type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} required />
                </div>
                <div className="field"><label>Fim *</label>
                  <input type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} required />
                </div>
              </div>
              <div className="field"><label>Local</label>
                <input placeholder="Ex: Sala principal" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={salvando} style={{ marginTop: 8 }}>
                {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
