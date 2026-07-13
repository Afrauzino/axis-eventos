/**
 * Cadastros — Pré-cadastro simplificado
 * Admin/líder cadastra nome + tipo + informações básicas
 * Sistema gera código de acesso → pessoa usa no Primeiro Acesso para criar conta completa
 */
import { useEffect, useState } from 'react'
import { confirmar } from '../components/Confirmar'
import { supabase } from '../lib/supabase'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import PrintOverlay from '../components/PrintOverlay'
import ImprimirCadastros from '../components/ImprimirCadastros'
import UploadFoto from '../components/UploadFoto'
import PersonSelect from '../components/PersonSelect'
import CardItem from '../components/CardItem'
import FotoAmpliada from '../components/FotoAmpliada'
import SeletorIgreja from '../components/SeletorIgreja'
import { useRegistrarChrome } from '../lib/chrome'
import { formatName, getInitials, isAdmin, canEditPessoas, normalizarNome } from '../utils'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import type { Profile } from '../App'

type Pessoa = {
  id:string; name:string; phone:string|null; church:string|null
  role_type:string; status:string; photo_url:string|null
  invite_code:string|null; user_id:string|null; conhecido_por_id:string|null
}

const ROLES = [
  { value:'encounterer', label:'Encontrista', desc:'Irá passar pelo encontro', cor:'#6B46C1', bg:'#F3F0FF' },
  { value:'worker',      label:'Encontreiro', desc:'Irá trabalhar / servir',   cor:'#00A99D', bg:'#E6F8F7' },
]

export default function Cadastros({ profile }: { profile: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [lista, setLista]     = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  useVoltarFecha(modal, () => setModal(false))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]       = useState('')
  const [busca, setBusca]     = useState('')
  const [filtroRole, setFiltroRole] = useState('todos')
  const [filtroSit, setFiltroSit] = useState('todas')   // todas | com_conta | so_codigo | sem_codigo
  const [modalFiltros, setModalFiltros] = useState(false)
  useVoltarFecha(modalFiltros, () => setModalFiltros(false))
  const nFiltros = (filtroRole!=='todos'?1:0) + (filtroSit!=='todas'?1:0)
  const [form, setForm]       = useState<{name:string;phone:string;church:string;role_type:string;photo_url:string|null;conhecido_por_id:string|null}>({ name:'', phone:'', church:'', role_type:'encounterer', photo_url:null, conhecido_por_id:null })
  const [editando, setEditando] = useState<Pessoa|null>(null)
  const [copiadoId, setCopiadoId] = useState<string|null>(null)
  const [imprimir, setImprimir] = useState(false)
  const [imprimirCad, setImprimirCad] = useState(false)
  const [fotoAmpliada, setFotoAmpliada] = useState<string|null>(null)

  async function copiarCodigo(p: Pessoa) {
    if (!p.invite_code) return
    try { await navigator.clipboard.writeText(p.invite_code) } catch {}
    setCopiadoId(p.id)
    setTimeout(() => setCopiadoId(c => c===p.id ? null : c), 1500)
  }

  const { pode } = usePermissao(profile)
  // Cargo (admin/pastor/secretaria) OU permissão individual/equipe "ver e editar Cadastro"
  const canEdit = isAdmin(profile.user_role) || canEditPessoas(profile.user_role) || pode('cadastros','editar')

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const base = 'id,name,phone,church,role_type,status,photo_url,invite_code,user_id'
    let res: any = await supabase.from('people').select(base + ',conhecido_por_id').eq('event_id', evento.id).order('name')
    if (res.error) {
      // coluna conhecido_por_id ainda não existe (sql/28 não rodado) — busca sem ela p/ não sumir a lista
      const r = await supabase.from('people').select(base).eq('event_id', evento.id).order('name')
      res = { data: (r.data ?? []).map((p:any)=>({ ...p, conhecido_por_id: null })) }
    }
    setLista(res.data ?? [])
    setLoading(false)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true)
    if (!evento || !form.name.trim()) { setErro('Nome é obrigatório.'); setSalvando(false); return }
    if (!form.photo_url) { setErro('A foto é obrigatória. Adicione uma foto para cadastrar.'); setSalvando(false); return }
    // Anti-duplicidade: mesmo NOME COMPLETO (ignora acento/maiúscula) já existe neste evento
    const norm = (s:string) => (s||'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ')
    const dup = lista.find(p => p.id !== editando?.id && norm(p.name) === norm(form.name))
    if (dup) { setErro(`Essa pessoa já foi cadastrada: "${dup.name}". Se for outra pessoa com o mesmo nome, acrescente um sobrenome.`); setSalvando(false); return }

    // Gerar código de acesso
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i=0; i<8; i++) code += chars[Math.floor(Math.random()*chars.length)]

    const dadosBase: any = {
      name: formatName(form.name),
      phone: form.phone || null,
      church: (form.church || '').trim(),  // igreja OPCIONAL — vazio em vez de null (não exige no banco)
      role_type: form.role_type,
      photo_url: form.photo_url || null,
    }
    const conhecido = form.role_type==='encounterer' ? (form.conhecido_por_id || null) : null

    async function gravar(comColuna: boolean) {
      const payload = comColuna ? { ...dadosBase, conhecido_por_id: conhecido } : { ...dadosBase }
      // .select('id').single() é ESSENCIAL: sem ele o supabase responde "ok" mesmo
      // quando NADA foi gravado (0 linhas) → a tela achava que salvou e não salvava.
      if (editando) return supabase.from('people').update(payload).eq('id', editando.id).select('id').single()
      return supabase.from('people').insert({ ...payload, status: 'inscrito', event_id: evento!.id, invite_code: code }).select('id').single()
    }

    let r = await gravar(true)
    // se a coluna conhecido_por_id não existir (sql/28 não rodado), grava sem ela
    if (r.error && /conhecido_por_id/.test(r.error.message)) r = await gravar(false)
    if (r.error || !r.data) { setErro('NÃO SALVOU: ' + (r.error?.message || 'o banco não gravou a linha (algo está descartando o cadastro — provável trigger/regra criado direto no Supabase). Me mande este texto.')); setSalvando(false); return }
    setModal(false); setSalvando(false); setEditando(null)
    setForm({ name:'', phone:'', church:'', role_type:'encounterer', photo_url:null, conhecido_por_id:null })
    carregar()
  }

  async function compartilharCodigo(p: Pessoa) {
    if (!p.invite_code) return
    const link = `${window.location.origin}/?codigo=${p.invite_code}`
    const msg = `Olá ${p.name.split(' ')[0]}! Seu código de acesso para o Encontro com Deus é: ${p.invite_code}\n\nAcesse pelo link (já abre no "Primeiro acesso" com o código preenchido):\n${link}\n\nOu abra o app, toque em "Primeiro acesso" e digite o código para criar sua conta.`
    // copia o código também (garante que a pessoa consiga colar)
    try { await navigator.clipboard.writeText(p.invite_code) } catch {}
    // abre o WhatsApp direto com a mensagem (mais confiável que navigator.share no PC)
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  async function excluirPessoa(p: Pessoa) {
    if (!(await confirmar({ titulo: `Excluir "${p.name}"?`, mensagem: 'Se ela tiver conta, a conta também será removida.', perigo: true }))) return

    // Excluir dados vinculados
    await supabase.from('saude_fichas').delete().eq('person_id', p.id)
    await supabase.from('escalas').delete().eq('person_id', p.id)
    await supabase.from('med_controlados').delete().eq('person_id', p.id)
    await supabase.from('people_teams').delete().eq('person_id', p.id)

    await supabase.from('people').delete().eq('id', p.id)

    // Apaga a CONTA de verdade (perfil + login auth) via Edge Function — libera o email
    if (p.user_id) {
      const { error: fnErr } = await supabase.functions.invoke('admin-delete-user', { body: { target_user_id: p.user_id } })
      if (fnErr) {
        await supabase.from('profiles').update({ role_status:'rejected', user_role:'visitante' }).eq('user_id', p.user_id)
      }
    }
    carregar()
  }

  function situacaoDe(p: Pessoa): string {
    if (p.user_id) return 'com_conta'
    return p.invite_code ? 'so_codigo' : 'sem_codigo'
  }
  const filtrados = lista.filter(p => {
    const q = normalizarNome(busca)
    const matchBusca = !busca || normalizarNome(p.name).includes(q) || (p.phone??'').includes(busca) || normalizarNome(p.church??'').includes(q)
    const matchRole = filtroRole==='todos' || p.role_type===filtroRole
    const matchSit  = filtroSit==='todas' || situacaoDe(p)===filtroSit
    return matchBusca && matchRole && matchSit
  })

  // ⚙️ do topo agora serve SÓ pra imprimir (busca e filtros ficam na tela).
  useRegistrarChrome({
    impressoes: canEdit ? [
      { label:'Imprimir lista atual (com fotos)', onClick:()=>setImprimir(true) },
      { label:'Imprimir cadastros (escolher campos)', onClick:()=>setImprimirCad(true) },
    ] : undefined,
  }, [canEdit])

  const SITUACOES = [
    { value:'todas',      label:'Todas',      emoji:'📋' },
    { value:'com_conta',  label:'Com conta',  emoji:'✅' },
    { value:'so_codigo',  label:'Só código',  emoji:'🔑' },
    { value:'sem_codigo', label:'Sem código', emoji:'⚪' },
  ]

  return (
    <div className="page">
      {/* Busca + botão de filtros (igual Administração) */}
      <div style={{display:'flex',gap:8,marginBottom:14}}>
        <div className="search-bar" style={{flex:1,marginBottom:0}}>
          <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
          <input placeholder="Buscar pessoa..." value={busca} onChange={e=>setBusca(e.target.value)}/>
          {busca && <button onClick={()=>setBusca('')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-light)',padding:0,fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>}
        </div>
        <button onClick={()=>setModalFiltros(true)} aria-label="Filtros"
          style={{position:'relative',flexShrink:0,width:44,height:44,borderRadius:12,border:`1px solid ${nFiltros>0?'var(--primary)':'var(--border)'}`,background:nFiltros>0?'var(--primary-light)':'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>
          <span className="icon" style={{color:nFiltros>0?'var(--primary)':'var(--text2)'}}>tune</span>
          {nFiltros>0 && <span style={{position:'absolute',top:-5,right:-5,minWidth:18,height:18,background:'var(--primary)',borderRadius:99,fontSize:10,fontWeight:800,color:'white',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px'}}>{nFiltros}</span>}
        </button>
      </div>

      {/* Chips dos filtros ativos */}
      {nFiltros>0 && (
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
          {filtroRole!=='todos' && (
            <span style={{display:'inline-flex',alignItems:'center',gap:4,background:'var(--primary-light)',color:'var(--primary-dark)',borderRadius:99,padding:'4px 6px 4px 12px',fontSize:12,fontWeight:700}}>
              {filtroRole==='worker'?'Encontreiros':'Encontristas'}
              <button onClick={()=>setFiltroRole('todos')} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',display:'flex',padding:0}}><span className="icon" style={{fontSize:15}}>close</span></button>
            </span>
          )}
          {filtroSit!=='todas' && (
            <span style={{display:'inline-flex',alignItems:'center',gap:4,background:'var(--primary-light)',color:'var(--primary-dark)',borderRadius:99,padding:'4px 6px 4px 12px',fontSize:12,fontWeight:700}}>
              {SITUACOES.find(s=>s.value===filtroSit)?.label}
              <button onClick={()=>setFiltroSit('todas')} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',display:'flex',padding:0}}><span className="icon" style={{fontSize:15}}>close</span></button>
            </span>
          )}
        </div>
      )}

      {/* Modal de filtros */}
      {modalFiltros && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModalFiltros(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 28px',maxWidth:480,width:'100%',margin:'0 auto',maxHeight:'85vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 14px'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
              <span style={{fontSize:17,fontWeight:800}}>Filtros</span>
              {nFiltros>0 && <button onClick={()=>{setFiltroRole('todos');setFiltroSit('todas')}} style={{background:'none',border:'none',color:'var(--primary)',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Limpar tudo</button>}
            </div>
            <p style={{fontSize:12,color:'var(--muted)',fontWeight:700,marginBottom:8}}>Tipo</p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>
              {[{value:'todos',label:'Todos'},{value:'encounterer',label:'Encontristas'},{value:'worker',label:'Encontreiros'}].map(o=>{
                const sel = filtroRole===o.value
                return <button key={o.value} onClick={()=>setFiltroRole(o.value)}
                  style={{padding:'9px 16px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:14,fontWeight:700,border:sel?'2px solid var(--primary)':'1px solid var(--border)',background:sel?'var(--primary-light)':'white',color:sel?'var(--primary-dark)':'var(--text2)'}}>{o.label}</button>
              })}
            </div>
            <p style={{fontSize:12,color:'var(--muted)',fontWeight:700,marginBottom:8}}>Situação</p>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
              {SITUACOES.map(o=>{
                const sel = filtroSit===o.value
                return <button key={o.value} onClick={()=>setFiltroSit(o.value)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',textAlign:'left',border:sel?'2px solid var(--primary)':'1px solid var(--border)',background:sel?'var(--primary-light)':'white'}}>
                  <span style={{fontSize:20}}>{o.emoji}</span>
                  <span style={{flex:1,fontSize:14,fontWeight:sel?800:600,color:sel?'var(--primary-dark)':'var(--text)'}}>{o.label}</span>
                  {sel && <span className="icon icon-sm" style={{color:'var(--primary)'}}>check</span>}
                </button>
              })}
            </div>
            <button className="btn btn-primary btn-full" onClick={()=>setModalFiltros(false)}>Ver resultados</button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? [1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:72,marginBottom:8,borderRadius:14}}/>) :
      filtrados.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>person_search</span></div>
          <p className="empty-title">Nenhum resultado</p>
        </div>
      ) : filtrados.map(p => {
        const role = ROLES.find(r=>r.value===p.role_type)
        const statusRow = (
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            {p.user_id
              ? <span className="badge badge-success" style={{fontSize:10}}>✓ Conta criada</span>
              : p.invite_code
                ? <>
                    <button onClick={()=>copiarCodigo(p)} title="Toque para copiar"
                      style={{fontFamily:'monospace',fontSize:11,fontWeight:800,letterSpacing:'0.08em',color:copiadoId===p.id?'var(--success)':'var(--primary)',background:copiadoId===p.id?'var(--success-bg)':'var(--primary-light)',padding:'3px 9px',borderRadius:6,border:'none',cursor:'pointer'}}>
                      {copiadoId===p.id ? '✓ Copiado!' : p.invite_code}
                    </button>
                    <button onClick={()=>compartilharCodigo(p)}
                      style={{background:'transparent',border:'1px solid var(--border)',borderRadius:6,padding:'3px 9px',cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:4,color:'#128C7E',fontSize:11,fontWeight:600}}
                      title="Enviar por WhatsApp (também copia o código)">
                      <span className="icon icon-sm" style={{color:'#128C7E'}}>share</span>
                      Enviar
                    </button>
                  </>
                : <span className="badge badge-neutral" style={{fontSize:10}}>Sem código</span>
            }
          </div>
        )
        return (
          <CardItem
            key={p.id}
            cor={role?.cor ?? 'var(--primary)'}
            ehPessoa
            fotoUrl={p.photo_url}
            iniciais={getInitials(p.name)}
            titulo={p.name}
            subtitulo={`${role?.label ?? ''}${p.church ? ' · ' + p.church : ''}`}
            extra={statusRow}
            onFoto={()=>p.photo_url && setFotoAmpliada(p.photo_url)}
            onEditar={canEdit ? ()=>{setErro('');setEditando(p);setForm({name:p.name,phone:p.phone??'',church:(p as any).church??'',role_type:p.role_type,photo_url:p.photo_url??null,conhecido_por_id:p.conhecido_por_id??null});setModal(true)} : undefined}
            onExcluir={canEdit ? ()=>excluirPessoa(p) : undefined}
          />
        )
      })}

      <FotoAmpliada url={fotoAmpliada} onClose={()=>setFotoAmpliada(null)} />

      {/* FAB */}
      {canEdit && <button className="fab" onClick={()=>{setErro('');setEditando(null);setForm({name:'',phone:'',church:'',role_type:'encounterer',photo_url:null,conhecido_por_id:null});setModal(true)}}><span className="icon">add</span></button>}

      {/* Modal pré-cadastro */}
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}
          onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?"Editar cadastro":"Pré-cadastro"}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>
                <span className="icon icon-sm">close</span>
              </button>
            </div>
            <p style={{fontSize:13,color:'var(--muted)',marginBottom:16,lineHeight:1.6}}>
              Cadastre o nome e tipo da pessoa. Um código de acesso será gerado automaticamente para ela criar a conta completa.
            </p>
            {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
            <form onSubmit={salvar}>
              {/* Foto (OBRIGATÓRIA) — vale pra encontrista e encontreiro */}
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:18,gap:4}}>
                <UploadFoto
                  bucket="pessoas"
                  path={`pessoa-${editando?.id ?? Date.now()}`}
                  currentUrl={form.photo_url}
                  onUpload={url=>setForm(f=>({...f,photo_url:url}))}
                  label={form.photo_url ? 'Trocar foto' : 'Adicionar foto'}
                  size={96}
                  shape="circle"
                />
                {!form.photo_url && <span style={{fontSize:11,fontWeight:700,color:'var(--danger)'}}>Foto obrigatória</span>}
              </div>

              {/* Tipo */}
              <div className="form-group">
                <label className="form-label">Função no evento <span className="req">*</span></label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:4}}>
                  {ROLES.map(r=>(
                    <button key={r.value} type="button" onClick={()=>setForm(f=>({...f,role_type:r.value}))}
                      style={{padding:'10px 8px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',display:'flex',flexDirection:'column',alignItems:'center',gap:2,
                        border:`2px solid ${form.role_type===r.value?r.cor:'var(--border)'}`,
                        background:form.role_type===r.value?r.bg:'white',
                        color:form.role_type===r.value?r.cor:'var(--text2)'}}>
                      <span style={{fontWeight:700,fontSize:13}}>{r.label}</span>
                      <span style={{fontSize:11,fontWeight:600,opacity:0.85}}>{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nome completo <span className="req">*</span></label>
                <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required placeholder="Nome como no documento"/>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Celular</label>
                  <input className="form-input" type="tel" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="(11) 99999-9999"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Igreja</label>
                  <SeletorIgreja value={form.church} onChange={v=>setForm(f=>({...f,church:v}))}/>
                </div>
              </div>

              {/* Encontreiro que conhece o encontrista (só p/ encontrista) */}
              {form.role_type==='encounterer' && (
                <div className="form-group">
                  <PersonSelect
                    label="Encontreiro que conhece"
                    pessoas={lista.filter(p=>p.role_type==='worker' && p.id!==editando?.id)}
                    value={form.conhecido_por_id ?? ''}
                    onChange={id=>setForm(f=>({...f,conhecido_por_id:id||null}))}
                    placeholder="Selecionar encontreiro..."
                  />
                  <p className="form-hint" style={{marginTop:6}}>Opcional. Um encontreiro que já conhece este encontrista.</p>
                </div>
              )}

              <div style={{background:'var(--primary-light)',borderRadius:10,padding:'10px 12px',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                <span className="icon icon-sm" style={{color:'var(--primary)'}}>key</span>
                <p style={{fontSize:12,color:'var(--primary)',fontWeight:600}}>Um código de 8 letras será gerado automaticamente. Envie para a pessoa criar a conta.</p>
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando ? 'Cadastrando...' : (editando ? 'Salvar' : 'Cadastrar e gerar código')}
              </button>
              {editando && (
                <button type="button" className="btn btn-ghost btn-full" style={{marginTop:8,color:'var(--danger)'}}
                  onClick={()=>{ const p=editando; setModal(false); excluirPessoa(p) }}>
                  <span className="icon icon-sm">delete</span> Excluir cadastro
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {imprimirCad && <ImprimirCadastros onClose={()=>setImprimirCad(false)} />}
      {imprimir && (
        <PrintOverlay titulo="Lista com fotos" onClose={()=>setImprimir(false)}>
          {([['Encontristas','encounterer'],['Encontreiros','worker']] as const).map(([tit,rt])=>{
            const arr = filtrados.filter(p=>p.role_type===rt)   // imprime exatamente o que está no filtro/busca
            if (arr.length===0) return null
            return (
              <div key={rt} className="print-break" style={{marginBottom:24}}>
                <h2 style={{fontSize:18,fontWeight:800,marginBottom:12,borderBottom:'2px solid #111827',paddingBottom:4}}>{tit} ({arr.length})</h2>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:12}}>
                  {arr.map(p=>(
                    <div key={p.id} style={{border:'1px solid #e5e7eb',borderRadius:8,padding:'10px 6px',textAlign:'center'}}>
                      <div style={{width:78,height:78,borderRadius:'50%',margin:'0 auto 6px',overflow:'hidden',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {p.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontWeight:700,color:'#6b7280',fontSize:20}}>{getInitials(p.name)}</span>}
                      </div>
                      <p style={{fontSize:12,fontWeight:600,lineHeight:1.2}}>{formatName(p.name)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </PrintOverlay>
      )}
    </div>
  )
}
