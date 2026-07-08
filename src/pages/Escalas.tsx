import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRegistrarChromeNav } from '../lib/chrome'
import PrintOverlay from '../components/PrintOverlay'
import { getInitials, fmtHora, isAdmin, isLider, nowLocalInput, toLocalInput } from '../utils'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import PersonSelect from '../components/PersonSelect'
import Seletor from '../components/Seletor'
import DataHora from '../components/DataHora'
import BarraData from '../components/BarraData'
import CardItem from '../components/CardItem'
import FotoAmpliada from '../components/FotoAmpliada'
import type { Profile } from '../App'

type Escala  = { id:string; person_id:string; team_id:string|null; title:string; start_time:string; end_time:string; location:string|null; notes:string|null; status:string }
type Pessoa  = { id:string; name:string; photo_url:string|null }
type Equipe  = { id:string; name:string; color:string }
type Local   = { id:string; nome:string }

export default function Escalas({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [escalas, setEscalas]   = useState<Escala[]>([])
  const [pessoas, setPessoas]   = useState<Pessoa[]>([])
  const [equipes, setEquipes]   = useState<Equipe[]>([])
  const [vinculos, setVinculos] = useState<{person_id:string;team_id:string}[]>([])
  const [locais, setLocais]     = useState<Local[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState<Escala|null>(null)
  const [fotoAmpliada, setFotoAmpliada] = useState<string|null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')
  const [conflito, setConflito] = useState<string|null>(null)
  const [imprimir, setImprimir] = useState(false)
  const hoje = new Date()
  const [dataSel, setDataSel]   = useState(hoje)

  const [formEquipeId, setFormEquipeId] = useState('')
  const [form, setForm] = useState({ person_id:'', title:'', start_time:nowLocalInput(), end_time:nowLocalInput(), location:'', notes:'' })
  const [modoGrupo, setModoGrupo]     = useState(false)
  const [pessoasSel, setPessoasSel]   = useState<string[]>([])
  // Fontes de conflito: cronograma (ministração/teatro) + elenco
  const [cronograma, setCronograma]   = useState<{id:string;hora_inicio:string;hora_fim:string;ministracao_id:string|null;theater_id:string|null}[]>([])
  const [ministracoes, setMinistracoes] = useState<{id:string;ministrante_id:string|null;titulo:string}[]>([])
  const [teatros, setTeatros]         = useState<{id:string;nome:string}[]>([])
  const [elenco, setElenco]           = useState<{person_id:string;theater_id:string}[]>([])
  // Checklist da atividade
  const [checklist, setChecklist]     = useState<{id:string;escala_id:string;texto:string;ordem:number;feito:boolean}[]>([])
  const [tipoAtiv, setTipoAtiv]       = useState<'texto'|'checklist'>('texto')
  const [itensCheck, setItensCheck]   = useState<{id?:string;texto:string;feito:boolean}[]>([])

  const { pode } = usePermissao(profile ?? null)
  // Admin/líder OU liberação (individual/equipe) "ver e editar Escalas" na tela do Admin
  const canEdit = (!!profile && (isAdmin(profile.user_role) || isLider(profile.user_role))) || pode('escalas','editar')
  const adminFull = profile && isAdmin(profile.user_role)

  // Resolve my person record and my teams (for líderes)
  const [myPersonId, setMyPersonId] = useState<string|null>(null)
  const [myTeamIds, setMyTeamIds]   = useState<string[]>([])

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [es, pe, eq, vi, lo, cr, mi, te, el] = await Promise.all([
      supabase.from('escalas').select('*').eq('event_id', evento.id).order('start_time'),
      supabase.from('people').select('id,name,photo_url').eq('event_id', evento.id).order('name'),
      supabase.from('teams').select('id,name,color,leader_id,co_leader_id').eq('event_id', evento.id).order('name'),
      supabase.from('people_teams').select('person_id,team_id'),
      supabase.from('locais').select('id,nome').eq('event_id', evento.id).order('nome'),
      supabase.from('cronograma_eventos').select('id,hora_inicio,hora_fim,ministracao_id,theater_id').eq('event_id', evento.id),
      supabase.from('ministrações').select('id,ministrante_id,titulo').eq('event_id', evento.id),
      supabase.from('theaters').select('id,nome').eq('event_id', evento.id),
      supabase.from('teatro_elenco').select('person_id,theater_id'),
    ])
    const allEquipes = eq.data ?? []
    setEscalas(es.data ?? [])
    setPessoas(pe.data ?? [])
    setEquipes(allEquipes)
    setVinculos(vi.data ?? [])
    setLocais(lo.data ?? [])
    setCronograma(cr.data ?? [])
    setMinistracoes(mi.data ?? [])
    setTeatros(te.data ?? [])
    setElenco(el.data ?? [])
    // Checklist das escalas do evento
    const escalaIds = (es.data ?? []).map((x:any)=>x.id)
    if (escalaIds.length) {
      const { data: ck } = await supabase.from('escala_checklist').select('*').in('escala_id', escalaIds)
      setChecklist(ck ?? [])
    } else setChecklist([])

    // Find my person and my led teams (for role-based filtering)
    if (profile && !isAdmin(profile.user_role)) {
      const { data: myPerson } = await supabase.from('people').select('id')
        .eq('event_id', evento!.id).eq('user_id', profile.user_id).maybeSingle()
      if (myPerson) {
        setMyPersonId(myPerson.id)
        const myT = allEquipes
          .filter((t:any) => t.leader_id === myPerson.id || t.co_leader_id === myPerson.id)
          .map((t:any) => t.id)
        setMyTeamIds(myT)
      }
    }
    setLoading(false)
  }

  // Equipes disponíveis no formulário (lider só vê as suas)
  const equipesDisponiveis = adminFull || myTeamIds.length === 0
    ? equipes
    : equipes.filter(e => myTeamIds.includes(e.id))

  // Pessoas filtradas pela equipe selecionada
  const pessoasDaEquipe: Pessoa[] = formEquipeId
    ? pessoas.filter(p => vinculos.some(v => v.person_id === p.id && v.team_id === formEquipeId))
    : pessoas

  const fmtMs = (ms:number) => fmtHora(new Date(ms).toISOString())

  // Todas as janelas em que a pessoa já está ocupada: Escala + Ministração + Teatro
  function janelasOcupadas(personId:string, excludeEscalaId?:string): {ini:number;fim:number;label:string}[] {
    const out: {ini:number;fim:number;label:string}[] = []
    // Escalas
    escalas.forEach(e => {
      if (e.person_id !== personId || (excludeEscalaId && e.id === excludeEscalaId)) return
      out.push({ ini:new Date(e.start_time).getTime(), fim:new Date(e.end_time).getTime(), label:`Escala: ${e.title}` })
    })
    // Ministração (pessoa é o ministrante) — horário vem do cronograma
    const minhasMin = new Set(ministracoes.filter(m => m.ministrante_id === personId).map(m => m.id))
    // Teatro (pessoa está no elenco) — horário vem do cronograma
    const meusTeatros = new Set(elenco.filter(el => el.person_id === personId).map(el => el.theater_id))
    cronograma.forEach(c => {
      if (c.ministracao_id && minhasMin.has(c.ministracao_id)) {
        const m = ministracoes.find(x => x.id === c.ministracao_id)
        out.push({ ini:new Date(c.hora_inicio).getTime(), fim:new Date(c.hora_fim).getTime(), label:`Ministração: ${m?.titulo ?? ''}` })
      }
      if (c.theater_id && meusTeatros.has(c.theater_id)) {
        const t = teatros.find(x => x.id === c.theater_id)
        out.push({ ini:new Date(c.hora_inicio).getTime(), fim:new Date(c.hora_fim).getTime(), label:`Teatro: ${t?.nome ?? ''}` })
      }
    })
    return out
  }

  function verificarConflito(personId:string, startTime:string, endTime:string, excludeId?:string): string|null {
    const inicio = new Date(startTime).getTime()
    const fim    = new Date(endTime).getTime()
    const c = janelasOcupadas(personId, excludeId).find(j => inicio < j.fim && fim > j.ini)
    if (!c) return null
    const p = pessoas.find(x => x.id === personId)
    return `${p?.name ?? 'A pessoa'} já está ocupado(a) das ${fmtMs(c.ini)} às ${fmtMs(c.fim)} — ${c.label}`
  }

  // Horários livres da pessoa no dia (exibição), respeitando o limite visual das 22h.
  function livresNoDia(personId:string, refISO:string): {ini:number;fim:number}[] {
    const base = new Date(refISO); if (isNaN(base.getTime())) return []
    const ini = new Date(base); ini.setHours(6,0,0,0)
    const fim = new Date(base); fim.setHours(22,0,0,0)  // 22h = limite só de exibição
    let livres: {ini:number;fim:number}[] = [{ ini:ini.getTime(), fim:fim.getTime() }]
    janelasOcupadas(personId)
      .filter(b => b.fim > ini.getTime() && b.ini < fim.getTime())
      .forEach(b => {
        livres = livres.flatMap(l => {
          if (b.ini >= l.fim || b.fim <= l.ini) return [l]
          const partes: {ini:number;fim:number}[] = []
          if (b.ini > l.ini) partes.push({ ini:l.ini, fim:b.ini })
          if (b.fim < l.fim) partes.push({ ini:b.fim, fim:l.fim })
          return partes
        })
      })
    return livres.filter(l => l.fim - l.ini >= 15*60000)  // ignora buracos < 15 min
  }

  async function salvar(e:React.FormEvent) {
    e.preventDefault(); setErro(''); setConflito(null); setSalvando(true)
    if (!evento || !form.title || !form.start_time || !form.end_time) {
      setErro('Preencha atividade e horários.'); setSalvando(false); return
    }

    // Grupo: inserir uma escala por pessoa selecionada
    if (modoGrupo && !editando) {
      if (pessoasSel.length === 0) { setErro('Selecione pelo menos uma pessoa.'); setSalvando(false); return }
      const grupoId = crypto.randomUUID()
      const itens = tipoAtiv==='checklist' ? itensCheck.filter(i=>i.texto.trim()) : []
      for (const pid of pessoasSel) {
        const { data: nova } = await supabase.from('escalas').insert({
          event_id: evento.id, person_id: pid, team_id: formEquipeId||null,
          title: form.title, start_time: new Date(form.start_time).toISOString(),
          end_time: new Date(form.end_time).toISOString(), location: form.location||null,
          notes: form.notes||null, status: 'confirmed', grupo_id: grupoId, tipo: tipoAtiv,
        }).select('id').single()
        if (nova && itens.length) {
          await supabase.from('escala_checklist').insert(itens.map((i,idx)=>({ escala_id:nova.id, texto:i.texto.trim(), ordem:idx, feito:false })))
        }
      }
      setModal(false); setSalvando(false); resetForm(); carregar(); return
    }

    // Individual
    if (!form.person_id) { setErro('Selecione a pessoa.'); setSalvando(false); return }
    const cf = await verificarConflito(form.person_id, form.start_time, form.end_time, editando?.id)
    if (cf) { setConflito(cf); setSalvando(false); return }
    const payload = {
      event_id: evento.id, person_id: form.person_id, team_id: formEquipeId||null,
      title: form.title, start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(), location: form.location||null,
      notes: form.notes||null, status: 'confirmed', tipo: tipoAtiv,
    }
    let err, escalaId = editando?.id
    if (editando) { const r = await supabase.from('escalas').update(payload).eq('id',editando.id); err = r.error }
    else { const r = await supabase.from('escalas').insert(payload).select('id').single(); err = r.error; escalaId = r.data?.id }
    if (err) { setErro('Erro: '+err.message); setSalvando(false); return }
    // Sincroniza o checklist (apaga e regrava; preserva o "feito" de cada item)
    if (escalaId) {
      await supabase.from('escala_checklist').delete().eq('escala_id', escalaId)
      const itens = tipoAtiv==='checklist' ? itensCheck.filter(i=>i.texto.trim()) : []
      if (itens.length) await supabase.from('escala_checklist').insert(itens.map((i,idx)=>({ escala_id:escalaId, texto:i.texto.trim(), ordem:idx, feito:i.feito })))
    }
    setModal(false); setSalvando(false); setEditando(null); resetForm(); carregar()
  }

  async function excluirEscala(id:string) {
    if (!confirm('Excluir esta escala?')) return
    await supabase.from('escalas').delete().eq('id', id)
    carregar()
  }

  function resetForm() {
    setFormEquipeId('')
    setForm({ person_id:'', title:'', start_time:nowLocalInput(), end_time:nowLocalInput(), location:'', notes:'' })
    setTipoAtiv('texto'); setItensCheck([])
    setErro(''); setConflito(null)
  }

  function abrirNovo() { resetForm(); setEditando(null); setModal(true) }

  function abrirEdicao(e:Escala) {
    setEditando(e)
    setFormEquipeId(e.team_id ?? '')
    setForm({ person_id:e.person_id, title:e.title, start_time:toLocalInput(e.start_time), end_time:toLocalInput(e.end_time), location:e.location??'', notes:e.notes??'' })
    setTipoAtiv((e as any).tipo === 'checklist' ? 'checklist' : 'texto')
    setItensCheck(checklist.filter(c => c.escala_id === e.id).sort((a,b)=>a.ordem-b.ordem).map(c => ({ id:c.id, texto:c.texto, feito:c.feito })))
    setErro(''); setConflito(null); setModal(true)
  }

  function getPessoa(id:string) { return pessoas.find(p => p.id === id) }
  function getEquipe(id:string|null) { return id ? equipes.find(e => e.id === id) : null }

  const mesmodia = (iso:string) => new Date(iso).toDateString() === dataSel.toDateString()
  const escalasDia = escalas.filter(e => {
    if (!mesmodia(e.start_time)) return false
    // Admin vê tudo; lider vê só sua(s) equipe(s)
    if (adminFull || myTeamIds.length === 0) return true
    return e.team_id ? myTeamIds.includes(e.team_id) : false
  })

  // Equipe selecionada atual (para exibir no PersonSelect de equipe)
  const equipeAtual = equipes.find(e => e.id === formEquipeId)

  useRegistrarChromeNav('equipes', {
    impressoes: escalasDia.length>0 ? [{ label:'Imprimir escala do dia', onClick:()=>setImprimir(true) }] : undefined,
  }, [escalasDia.length])

  return (
    <div className="page">
      {/* Navegação por data — barra de semana (só os dias do evento abrem) */}
      <BarraData value={dataSel} onChange={setDataSel} inicio={evento?.start_date} fim={evento?.end_date} hoje={hoje} />


      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:68,marginBottom:8,borderRadius:14}}/>) :
      escalasDia.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>checklist</span></div>
          <p className="empty-title">Nenhuma escala</p>
          <p className="empty-desc">Nenhuma escala para este dia.</p>
        </div>
      ) : escalasDia.map(e => {
        const p  = getPessoa(e.person_id)
        const eq = getEquipe(e.team_id)
        const itens = checklist.filter(c => c.escala_id === e.id)
        const ehCheck = (e as any).tipo === 'checklist' && itens.length > 0
        const pct = ehCheck ? Math.round(itens.filter(i=>i.feito).length / itens.length * 100) : null
        return (
          <CardItem
            key={e.id}
            cor={eq?.color ?? 'var(--primary)'}
            ehPessoa
            fotoUrl={p?.photo_url ?? null}
            iniciais={getInitials(p?.name??'?')}
            titulo={p?.name ?? '—'}
            subtitulo={`${fmtHora(e.start_time)}–${fmtHora(e.end_time)}${eq?` · ${eq.name}`:''}`}
            extra={<p style={{fontSize:12,color:'var(--muted)'}}>{e.title}{e.location?` · ${e.location}`:''}{ehCheck?` · ${itens.filter(i=>i.feito).length}/${itens.length} feito`:''}</p>}
            progresso={pct}
            onVer={canEdit ? ()=>abrirEdicao(e) : undefined}
            onEditar={canEdit ? ()=>abrirEdicao(e) : undefined}
            onFoto={()=>p?.photo_url && setFotoAmpliada(p.photo_url)}
          />
        )
      })}

      {canEdit && <button className="fab" onClick={abrirNovo}><span className="icon">add</span></button>}

      {/* ===== IMPRESSÃO — escala do dia (reflete a tela) ===== */}
      {imprimir && (
        <PrintOverlay titulo={`Escala — ${dataSel.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}`} onClose={()=>setImprimir(false)}>
          {escalasDia.length===0
            ? <p style={{fontSize:13,color:'#6b7280'}}>Nenhuma escala neste dia.</p>
            : escalasDia.map(e=>{
                const p = getPessoa(e.person_id); const eq = getEquipe(e.team_id)
                return (
                  <div key={e.id} style={{display:'flex',alignItems:'center',gap:12,border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden',marginBottom:8,breakInside:'avoid'}}>
                    <div style={{width:5,alignSelf:'stretch',background:eq?.color??'#00A99D',flexShrink:0}}/>
                    <div style={{width:42,height:42,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',margin:'8px 0'}}>
                      {p?.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontWeight:700,color:'#6b7280',fontSize:14}}>{getInitials(p?.name??'?')}</span>}
                    </div>
                    <div style={{flex:1,minWidth:0,padding:'8px 12px 8px 0'}}>
                      <p style={{fontSize:11,fontWeight:700,color:eq?.color??'#00A99D'}}>{fmtHora(e.start_time)} — {fmtHora(e.end_time)}{eq?` · ${eq.name}`:''}</p>
                      <p style={{fontWeight:700,fontSize:14}}>{p?.name}</p>
                      <p style={{fontSize:12,color:'#6b7280'}}>{e.title}{e.location?` · ${e.location}`:''}</p>
                    </div>
                  </div>
                )
              })}
        </PrintOverlay>
      )}

      {modal && canEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?'Editar escala':'Nova escala'}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
            {conflito && <div className="alert-box alert-warning mb-3"><strong>Conflito de horário:</strong> {conflito}</div>}
            <form onSubmit={salvar}>

              {/* 1. Equipe - usando mesmo padrão de PersonSelect */}
              <div className="form-group">
                <label className="form-label">1. Equipe</label>
                <div style={{position:'relative'}}>
                  {/* Dropdown de equipes no mesmo estilo de PersonSelect */}
                  <EquipeSelect
                    equipes={equipesDisponiveis}
                    value={formEquipeId}
                    onChange={(id)=>{ setFormEquipeId(id); setForm(f=>({...f,person_id:''})) }}
                  />
                </div>
                {formEquipeId && <p className="form-hint mt-1">{pessoasDaEquipe.length} pessoa(s) nesta equipe</p>}
              </div>

              {/* 2. Pessoa filtrada pela equipe */}
              <div className="form-group">
                <PersonSelect
                  label="2. Pessoa"
                  required
                  pessoas={pessoasDaEquipe}
                  value={form.person_id}
                  onChange={id=>setForm(f=>({...f,person_id:id}))}
                  placeholder={formEquipeId ? `Buscar em ${equipeAtual?.name??'equipe'}...` : 'Buscar pessoa...'}
                />
              </div>

              {/* Disponibilidade da pessoa (só orientação, até 22h) */}
              {!modoGrupo && form.person_id && (() => {
                const livres = livresNoDia(form.person_id, form.start_time)
                return (
                  <div className="alert-box alert-info mb-3" style={{fontSize:12,lineHeight:1.7}}>
                    <strong>Disponível para trabalho</strong> em {new Date(form.start_time).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} (até 22h):<br/>
                    {livres.length === 0
                      ? 'Sem horários livres neste dia entre 06h e 22h.'
                      : livres.map((l,i)=><span key={i}>{i>0?' · ':''}{fmtMs(l.ini)}–{fmtMs(l.fim)}</span>)}
                    <br/><span style={{color:'var(--muted)'}}>É só orientação — pode escalar a qualquer hora, desde que não haja outra atividade.</span>
                  </div>
                )
              })()}

              {/* 3. Local dos locais cadastrados */}
              <div className="form-group">
                <label className="form-label">3. Local</label>
                <Seletor titulo="Local" placeholder="Selecionar local..."
                  value={form.location} onChange={v=>setForm(f=>({...f,location:v}))}
                  opcoes={[{value:'',label:'Sem local'}, ...locais.map(l=>({value:l.nome, label:l.nome}))]}/>
              </div>

              {/* 4. Horário */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">4. Início <span className="req">*</span></label>
                  <DataHora modo="datetime" value={form.start_time} onChange={v=>setForm(f=>({...f,start_time:v}))} min={(evento as any)?.start_date} max={(evento as any)?.end_date}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Fim <span className="req">*</span></label>
                  <DataHora modo="datetime" value={form.end_time} onChange={v=>setForm(f=>({...f,end_time:v}))} min={(evento as any)?.start_date} max={(evento as any)?.end_date}/>
                </div>
              </div>

              {/* 5. Atividade */}
              <div className="form-group">
                <label className="form-label">5. Atividade <span className="req">*</span></label>
                <input className="form-input" placeholder="Ex: Recepção, Louvor, Apoio na cozinha..." value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required/>
              </div>

              {/* 6. Detalhes: texto OU checklist */}
              <div className="form-group">
                <label className="form-label">6. Detalhes da atividade</label>
                <Seletor titulo="Tipo dos detalhes" value={tipoAtiv} onChange={v=>setTipoAtiv(v as any)}
                  opcoes={[{value:'texto',label:'📝 Texto'},{value:'checklist',label:'✅ Checklist'}]}/>
              </div>
              {tipoAtiv==='texto' ? (
                <div className="form-group">
                  <textarea className="form-textarea" placeholder="Detalhes adicionais..." value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{minHeight:70}}/>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Itens do checklist</label>
                  {itensCheck.map((it,idx)=>(
                    <div key={idx} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                      <button type="button" onClick={()=>setItensCheck(prev=>prev.map((x,i)=>i===idx?{...x,feito:!x.feito}:x))}
                        style={{width:28,height:28,borderRadius:7,border:it.feito?'none':'1px solid var(--border)',background:it.feito?'var(--success)':'white',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}} title="Marcar como feito">
                        {it.feito && <span className="icon icon-sm" style={{color:'white'}}>check</span>}
                      </button>
                      <input className="form-input" style={{flex:1}} placeholder={`Item ${idx+1}`} value={it.texto} onChange={e=>setItensCheck(prev=>prev.map((x,i)=>i===idx?{...x,texto:e.target.value}:x))}/>
                      <button type="button" onClick={()=>setItensCheck(prev=>prev.filter((_,i)=>i!==idx))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-light)',flexShrink:0,fontFamily:'inherit',display:'flex'}} title="Remover"><span className="icon icon-sm">close</span></button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setItensCheck(prev=>[...prev,{texto:'',feito:false}])}>
                    <span className="icon icon-sm">add</span> Adicionar item
                  </button>
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Verificando e salvando...':editando?'Salvar':'Criar escala'}
              </button>
              {editando && (
                <button type="button" className="btn btn-ghost btn-full" style={{marginTop:8,color:'var(--danger)'}}
                  onClick={()=>{ const id=editando.id; setModal(false); excluirEscala(id) }}>
                  <span className="icon icon-sm">delete</span> Excluir escala
                </button>
              )}
            </form>
          </div>
        </div>
      )}
      <FotoAmpliada url={fotoAmpliada} onClose={()=>setFotoAmpliada(null)} />
    </div>
  )
}

// Componente EquipeSelect - mesmo padrão visual do PersonSelect
function EquipeSelect({ equipes, value, onChange }: { equipes:{id:string;name:string;color:string}[]; value:string; onChange:(id:string)=>void }) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca]   = useState('')
  const ref = useState<HTMLDivElement|null>(null)

  const selecionada = equipes.find(e => e.id === value)
  const filtradas   = equipes.filter(e => !busca || e.name.toLowerCase().includes(busca.toLowerCase()))

  // Close on outside click
  useEffect(() => {
    function handler(ev:MouseEvent) {
      const el = document.getElementById('equipe-select-dropdown')
      if (el && !el.contains(ev.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div id="equipe-select-dropdown" style={{position:'relative'}}>
      <button type="button" onClick={()=>setAberto(!aberto)} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:10,cursor:'pointer',border:`1.5px solid ${aberto?'var(--primary)':'var(--border)'}`,background:aberto?'white':'var(--bg)',fontFamily:'inherit',transition:'border-color 0.15s',boxShadow:aberto?'0 0 0 3px rgba(0,169,157,0.12)':'none'}}>
        {selecionada ? (
          <>
            <div style={{width:30,height:30,borderRadius:8,background:selecionada.color,flexShrink:0}}/>
            <span style={{flex:1,fontSize:14,fontWeight:500,color:'var(--text)',textAlign:'left'}}>{selecionada.name}</span>
            <button type="button" onClick={e=>{e.stopPropagation();onChange('');setAberto(false)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-light)',padding:0,fontFamily:'inherit'}}>
              <span className="icon icon-sm">close</span>
            </button>
          </>
        ) : (
          <>
            <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>shield</span>
            <span style={{flex:1,fontSize:14,color:'var(--muted-light)',textAlign:'left'}}>Todas as equipes</span>
            <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>expand_more</span>
          </>
        )}
      </button>
      {aberto && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'white',border:'1.5px solid var(--border)',borderRadius:12,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:500,overflow:'hidden'}}>
          <div style={{padding:'10px 12px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8}}>
            <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar equipe..." style={{border:'none',outline:'none',fontSize:14,color:'var(--text)',background:'transparent',width:'100%',fontFamily:'inherit'}}/>
          </div>
          <div style={{maxHeight:200,overflowY:'auto'}}>
            <button type="button" onClick={()=>{onChange('');setAberto(false);setBusca('')}} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:!value?'var(--primary-light)':'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
              <div style={{width:30,height:30,borderRadius:8,background:'var(--bg)',border:'1px solid var(--border)',flexShrink:0}}/>
              <span style={{fontSize:13,color:!value?'var(--primary-dark)':'var(--muted)'}}>Todas as equipes</span>
              {!value && <span className="icon icon-sm" style={{color:'var(--primary)',marginLeft:'auto'}}>check</span>}
            </button>
            {filtradas.map(eq=>(
              <button key={eq.id} type="button" onClick={()=>{onChange(eq.id);setAberto(false);setBusca('')}} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:value===eq.id?'var(--primary-light)':'none',border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                <div style={{width:30,height:30,borderRadius:8,background:eq.color,flexShrink:0}}/>
                <span style={{fontSize:14,fontWeight:value===eq.id?700:400,color:value===eq.id?'var(--primary-dark)':'var(--text)'}}>{eq.name}</span>
                {value===eq.id && <span className="icon icon-sm" style={{color:'var(--primary)',marginLeft:'auto'}}>check</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
