/**
 * Cadastros — Pré-cadastro simplificado
 * Admin/líder cadastra nome + tipo + informações básicas
 * Sistema gera código de acesso → pessoa usa no Primeiro Acesso para criar conta completa
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import PrintOverlay from '../components/PrintOverlay'
import UploadFoto from '../components/UploadFoto'
import PersonSelect from '../components/PersonSelect'
import CardItem from '../components/CardItem'
import FotoAmpliada from '../components/FotoAmpliada'
import { useRegistrarChrome } from '../lib/chrome'
import { formatName, getInitials, isAdmin, canEditPessoas } from '../utils'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import type { Profile } from '../App'

type Pessoa = {
  id:string; name:string; phone:string|null; church:string|null
  role_type:string; status:string; photo_url:string|null
  invite_code:string|null; user_id:string|null; conhecido_por_id:string|null
}

const ROLES = [
  { value:'encounterer', label:'Encontrista', cor:'#6B46C1', bg:'#F3F0FF' },
  { value:'worker',      label:'Encontreiro', cor:'#00A99D', bg:'#E6F8F7' },
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
  const [form, setForm]       = useState<{name:string;phone:string;church:string;role_type:string;photo_url:string|null;conhecido_por_id:string|null}>({ name:'', phone:'', church:'', role_type:'encounterer', photo_url:null, conhecido_por_id:null })
  const [editando, setEditando] = useState<Pessoa|null>(null)
  const [copiadoId, setCopiadoId] = useState<string|null>(null)
  const [imprimir, setImprimir] = useState(false)
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

    // Gerar código de acesso
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i=0; i<8; i++) code += chars[Math.floor(Math.random()*chars.length)]

    const dadosBase: any = {
      name: formatName(form.name),
      phone: form.phone || null,
      church: form.church || null,
      role_type: form.role_type,
      photo_url: form.photo_url || null,
    }
    const conhecido = form.role_type==='encounterer' ? (form.conhecido_por_id || null) : null

    async function gravar(comColuna: boolean) {
      const payload = comColuna ? { ...dadosBase, conhecido_por_id: conhecido } : { ...dadosBase }
      if (editando) return supabase.from('people').update(payload).eq('id', editando.id)
      return supabase.from('people').insert({ ...payload, status: 'inscrito', event_id: evento!.id, invite_code: code })
    }

    let r = await gravar(true)
    // se a coluna conhecido_por_id não existir (sql/28 não rodado), grava sem ela
    if (r.error && /conhecido_por_id/.test(r.error.message)) r = await gravar(false)
    if (r.error) { setErro('Erro: ' + r.error.message); setSalvando(false); return }
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
    if (!confirm(`Excluir "${p.name}"?\n\nSe ela tiver conta, a conta também será removida.`)) return

    // Excluir dados vinculados
    await supabase.from('saude_fichas').delete().eq('person_id', p.id)
    await supabase.from('escalas').delete().eq('person_id', p.id)
    await supabase.from('med_controlados').delete().eq('person_id', p.id)
    await supabase.from('people_teams').delete().eq('person_id', p.id)

    // Remover vínculo de conta (não deleta auth.user - precisa do Dashboard)
    if (p.user_id) {
      await supabase.from('profiles').update({ role_status:'rejected' }).eq('user_id', p.user_id)
    }

    await supabase.from('people').delete().eq('id', p.id)
    carregar()
  }

  const filtrados = lista.filter(p => {
    const q = busca.toLowerCase()
    const matchBusca = !q || p.name.toLowerCase().includes(q) || (p.phone??'').includes(q) || (p.church??'').toLowerCase().includes(q)
    const matchRole = filtroRole==='todos' || p.role_type===filtroRole
    return matchBusca && matchRole
  })

  // ⚙️ do topo: busca + filtro de tipo + opções de imprimir
  useRegistrarChrome({
    busca: { value: busca, onChange: setBusca, placeholder: 'Buscar por nome, celular ou igreja...' },
    grupos: [{ chave:'role', label:'Tipo', opcoes:[{value:'todos',label:'Todos'},{value:'encounterer',label:'Encontristas'},{value:'worker',label:'Encontreiros'}] }],
    valores: { role: filtroRole },
    onFiltro: (_,v)=>setFiltroRole(v),
    impressoes: canEdit ? [
      { label:'Imprimir lista atual (com fotos)', onClick:()=>setImprimir(true) },
    ] : undefined,
  }, [busca, filtroRole, canEdit])

  return (
    <div className="page">
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
              {/* Foto (opcional) — vale pra encontrista e encontreiro */}
              <div style={{display:'flex',justifyContent:'center',marginBottom:18}}>
                <UploadFoto
                  bucket="pessoas"
                  path={`pessoa-${editando?.id ?? Date.now()}`}
                  currentUrl={form.photo_url}
                  onUpload={url=>setForm(f=>({...f,photo_url:url}))}
                  label={form.photo_url ? 'Trocar foto' : 'Adicionar foto'}
                  size={96}
                  shape="circle"
                />
              </div>

              {/* Tipo */}
              <div className="form-group">
                <label className="form-label">Função no evento <span className="req">*</span></label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:4}}>
                  {ROLES.map(r=>(
                    <button key={r.value} type="button" onClick={()=>setForm(f=>({...f,role_type:r.value}))}
                      style={{padding:'10px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:13,fontFamily:'inherit',
                        border:`2px solid ${form.role_type===r.value?r.cor:'var(--border)'}`,
                        background:form.role_type===r.value?r.bg:'white',
                        color:form.role_type===r.value?r.cor:'var(--text2)'}}>
                      {r.label}
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
                  <input className="form-input" value={form.church} onChange={e=>setForm(f=>({...f,church:e.target.value}))} placeholder="Nome da igreja"/>
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
