import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../App'

type Pessoa = {
  id: string; name: string; phone: string; church: string
  role_type: string; team_id: string | null; status: string
  sexo: string | null; birth_date: string | null; cpf: string | null
  photo_url: string | null; event_id: string; cidade: string | null
}
type Equipe = { id: string; name: string; color: string }

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

export default function Pessoas({ profile }: { profile: Profile }) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [eventoId, setEventoId] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Pessoa | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    name: '', phone: '', church: '', role_type: 'encounterer',
    team_id: '', status: 'inscrito', sexo: '', birth_date: '',
    cpf: '', cidade: '', notes: '',
  })

  const canEdit = profile.is_admin

  useEffect(() => {
    supabase.from('events').select('id').eq('status', 'active').limit(1)
      .then(({ data }) => {
        if (data?.[0]) setEventoId(data[0].id)
        else supabase.from('events').select('id').order('created_at', { ascending: false }).limit(1)
          .then(({ data: d2 }) => { if (d2?.[0]) setEventoId(d2[0].id) })
      })
  }, [])

  useEffect(() => { if (eventoId) { setLoading(true); carregar() } }, [eventoId])

  async function carregar() {
    const [p, e] = await Promise.all([
      supabase.from('people').select('*').eq('event_id', eventoId).order('name'),
      supabase.from('teams').select('id,name,color').eq('event_id', eventoId).order('name'),
    ])
    setPessoas(p.data ?? [])
    setEquipes(e.data ?? [])
    setLoading(false)
  }

  function abrirNovo() {
    setEditando(null)
    setForm({ name: '', phone: '', church: '', role_type: 'encounterer', team_id: '', status: 'inscrito', sexo: '', birth_date: '', cpf: '', cidade: '', notes: '' })
    setModal(true)
  }

  function abrirEdicao(p: Pessoa) {
    if (!canEdit) return
    setEditando(p)
    setForm({ name: p.name, phone: p.phone, church: p.church, role_type: p.role_type, team_id: p.team_id ?? '', status: p.status, sexo: p.sexo ?? '', birth_date: p.birth_date ?? '', cpf: p.cpf ?? '', cidade: p.cidade ?? '', notes: '' })
    setModal(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!eventoId) return
    setSalvando(true)
    const payload = { ...form, team_id: form.team_id || null, sexo: form.sexo || null, birth_date: form.birth_date || null, cpf: form.cpf || null, cidade: form.cidade || null }
    if (editando) {
      await supabase.from('people').update(payload).eq('id', editando.id)
    } else {
      await supabase.from('people').insert({ ...payload, event_id: eventoId })
    }
    setModal(false); setSalvando(false); carregar()
  }

  const STATUS_BADGE: Record<string, string> = {
    inscrito: 'badge-info', confirmado: 'badge-success',
    cancelado: 'badge-danger', concluiu: 'badge-neutral',
  }

  const filtrados = pessoas.filter(p => {
    const q = busca.toLowerCase()
    const matchBusca = !q || p.name.toLowerCase().includes(q) || p.church.toLowerCase().includes(q) || p.phone.includes(q)
    const matchTipo = filtroTipo === 'todos' || p.role_type === filtroTipo
    const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus
    return matchBusca && matchTipo && matchStatus
  })

  const encCount = pessoas.filter(p => p.role_type === 'encounterer').length
  const srvCount = pessoas.filter(p => p.role_type === 'worker').length

  return (
    <div className="page">
      <div className="stats-grid mb-4">
        <div className="stat-card">
          <div className="stat-card-label">Encontristas</div>
          <div className="stat-card-value">{encCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Servos</div>
          <div className="stat-card-value">{srvCount}</div>
        </div>
      </div>

      <div className="search-wrap">
        <span className="search-icon">P</span>
        <input className="search-input" placeholder="Buscar por nome, igreja ou telefone..."
          value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <div className="filter-bar">
        {[['todos','Todos'],['encounterer','Encontristas'],['worker','Servos']].map(([v,l]) => (
          <button key={v} className={`filter-chip ${filtroTipo === v ? 'active' : ''}`} onClick={() => setFiltroTipo(v)}>{l}</button>
        ))}
      </div>

      <div className="filter-bar">
        {[['todos','Todos'],['inscrito','Inscritos'],['confirmado','Confirmados'],['cancelado','Cancelados']].map(([v,l]) => (
          <button key={v} className={`filter-chip ${filtroStatus === v ? 'active' : ''}`} onClick={() => setFiltroStatus(v)}>{l}</button>
        ))}
      </div>

      {loading ? (
        [1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 68, marginBottom: 8, borderRadius: 14 }} />)
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><span style={{ fontSize: 20, color: 'var(--text-muted)' }}>P</span></div>
          <p className="empty-title">{busca ? 'Nenhum resultado' : 'Nenhuma pessoa cadastrada'}</p>
          <p className="empty-desc">{busca ? 'Tente outros termos.' : 'Cadastre a primeira pessoa deste evento.'}</p>
        </div>
      ) : filtrados.map(p => {
        const eq = equipes.find(e => e.id === p.team_id)
        return (
          <div key={p.id} className="list-item" onClick={() => abrirEdicao(p)}>
            <div className="avatar avatar-sm">{getInitials(p.name)}</div>
            <div className="list-item-content">
              <div className="list-item-title">{p.name}</div>
              <div className="list-item-sub">
                {p.church}{eq ? ` · ${eq.name}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span className={`badge ${STATUS_BADGE[p.status] ?? 'badge-neutral'}`}>
                {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
              </span>
              <span className="badge badge-neutral">
                {p.role_type === 'encounterer' ? 'Enc.' : 'Servo'}
              </span>
            </div>
          </div>
        )
      })}

      {canEdit && <button className="fab" onClick={abrirNovo}>+</button>}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-handle" />
            <div className="modal-header">
              <span className="modal-title">{editando ? 'Editar cadastro' : 'Novo cadastro'}</span>
              <button className="modal-close" onClick={() => setModal(false)}>x</button>
            </div>
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Nome completo <span>*</span></label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Celular <span>*</span></label>
                  <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
                </div>
                <div className="form-group"><label className="form-label">Sexo</label>
                  <select className="form-select" value={form.sexo} onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))}>
                    <option value="">Selecionar</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Igreja <span>*</span></label>
                <input className="form-input" value={form.church} onChange={e => setForm(f => ({ ...f, church: e.target.value }))} required />
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Cidade</label>
                  <input className="form-input" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
                </div>
                <div className="form-group"><label className="form-label">Nascimento</label>
                  <input className="form-input" type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group"><label className="form-label">CPF / RG</label>
                <input className="form-input" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} />
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Tipo</label>
                  <select className="form-select" value={form.role_type} onChange={e => setForm(f => ({ ...f, role_type: e.target.value }))}>
                    <option value="encounterer">Encontrista</option>
                    <option value="worker">Servo</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="inscrito">Inscrito</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="cancelado">Cancelado</option>
                    <option value="concluiu">Concluiu</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Equipe</label>
                <select className="form-select" value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}>
                  <option value="">Sem equipe</option>
                  {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando ? 'Salvando...' : editando ? 'Salvar alteracoes' : 'Cadastrar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
