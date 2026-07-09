import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatName, getInitials, ROLE_LABELS } from '../utils'
import { useEvento } from '../hooks/useEvento'
import RecortarFoto from '../components/RecortarFoto'
import type { Profile } from '../App'

export default function Perfil({ profile, onUpdate }: { profile: Profile; onUpdate: () => void }) {
  const { evento } = useEvento()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm]       = useState({ name: profile.full_name ?? '', phone: (profile as any).phone ?? '', church: (profile as any).church ?? '' })
  // Meu cadastro de PESSOA no evento (para ter crachá, entrar em equipe, etc.)
  const [meuP, setMeuP]       = useState<{id:string;role_type:string}|null>(null)
  const [carregandoP, setCarregandoP] = useState(true)
  const [criandoP, setCriandoP] = useState(false)

  useEffect(() => {
    if (!evento || !profile.user_id) { setCarregandoP(false); return }
    setCarregandoP(true)
    supabase.from('people').select('id,role_type').eq('event_id', evento.id).eq('user_id', profile.user_id).maybeSingle()
      .then(({ data }) => { setMeuP(data); setCarregandoP(false) })
  }, [evento, profile.user_id])

  async function criarMeuCadastro(role: 'worker'|'encounterer') {
    if (!evento || !profile.user_id) return
    setCriandoP(true)
    const foto = profile.avatar_url ? String(profile.avatar_url).split('?')[0] : null
    const { data, error } = await supabase.from('people').insert({
      event_id: evento.id, user_id: profile.user_id,
      name: formatName(form.name || profile.full_name || ''),
      church: form.church || (profile as any).church || null,
      phone: form.phone || (profile as any).phone || null,
      photo_url: foto, role_type: role, status: 'confirmado',
    }).select('id,role_type').single()
    setCriandoP(false)
    if (error) { setErro('Erro ao criar cadastro: ' + error.message); return }
    setMeuP(data); setOk('Seu cadastro no evento foi criado!')
  }
  const [senhaForm, setSenhaForm] = useState({ nova: '', conf: '' })
  const [emailForm, setEmailForm] = useState({ novo: '' })
  const [salvando, setSalvando]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro]           = useState('')
  const [ok, setOk]               = useState('')
  const [recorte, setRecorte]     = useState<{ src: string; remoto: boolean } | null>(null)

  // Escolheu um arquivo → abre o ENQUADRAMENTO (não envia direto)
  function aoEscolherFoto(file: File) { setErro(''); setOk(''); setRecorte({ src: URL.createObjectURL(file), remoto: false }) }
  function fecharRecorte() { if (recorte && !recorte.remoto) { try { URL.revokeObjectURL(recorte.src) } catch {} } setRecorte(null) }

  // Recebe o Blob já enquadrado (do RecortarFoto) e envia
  async function enviarFoto(blob: Blob) {
    setUploading(true); setErro(''); setOk('')
    // Usa timestamp para garantir URL única e quebrar cache do browser
    const path = `avatars/${profile.user_id}_${Date.now()}.jpg`
    // Remove fotos antigas deste usuário antes de enviar nova
    const { data: listData } = await supabase.storage.from('avatars').list('', { search: profile.user_id })
    if (listData && listData.length > 0) {
      const toDelete = listData.map(f => f.name)
      await supabase.storage.from('avatars').remove(toDelete)
    }
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: false, contentType: 'image/jpeg' })
    if (upErr) { setErro('Erro ao enviar foto: ' + upErr.message); setUploading(false); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    // Adiciona timestamp na URL para forçar refresh do browser
    const urlComCache = data.publicUrl + '?t=' + Date.now()
    const { error: upErr2 } = await supabase.from('profiles').update({ avatar_url: urlComCache }).eq('user_id', profile.user_id)
    if (upErr2) { setErro('Foto enviada mas erro ao salvar: ' + upErr2.message); setUploading(false); return }

    // Propaga a foto para TUDO que a pessoa está ligada (cadastro no evento, mural…).
    // Sem isso, Equipes/Escalas/Crachá/Impressão continuam com a foto velha (sql/50).
    const { error: syncErr } = await supabase.rpc('sincronizar_meu_perfil', { p_foto: urlComCache })
    if (syncErr) { setErro('Foto salva no perfil, mas não atualizou nas outras telas. O admin precisa rodar o sql/50_alertas_mural_foto.sql.'); setUploading(false); onUpdate(); return }

    setOk('Foto atualizada em todas as telas!'); setUploading(false); onUpdate()
  }

  async function salvarDados(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setErro(''); setOk('')
    const nome = formatName(form.name)
    if (!nome) { setErro('Nome obrigatório.'); setSalvando(false); return }
    const { error } = await supabase.from('profiles')
      .update({ name: nome, phone: form.phone || null, church: form.church || null })
      .eq('user_id', profile.user_id)
    if (error) { setErro('Erro ao salvar: ' + error.message) }
    else {
      await supabase.rpc('sincronizar_meu_perfil', { p_nome: nome })   // nome também é copiado no mural/cadastro
      setOk('Dados atualizados!'); onUpdate()
    }
    setSalvando(false)
  }

  async function alterarSenha(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setOk('')
    if (senhaForm.nova !== senhaForm.conf) { setErro('As senhas não coincidem.'); return }
    if (senhaForm.nova.length < 6) { setErro('Mínimo 6 caracteres.'); return }
    const { error } = await supabase.auth.updateUser({ password: senhaForm.nova })
    if (error) setErro('Erro ao alterar senha: ' + error.message)
    else { setOk('Senha alterada!'); setSenhaForm({ nova: '', conf: '' }) }
  }

  async function alterarEmail(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setOk('')
    const novo = emailForm.novo.trim().toLowerCase()
    if (!novo || !novo.includes('@')) { setErro('Digite um e-mail válido.'); return }
    const { error } = await supabase.auth.updateUser({ email: novo })
    if (error) { setErro('Erro ao alterar e-mail: ' + error.message); return }
    // Atualiza também na tabela profiles para manter consistência
    await supabase.from('profiles').update({ email: novo }).eq('user_id', profile.user_id)
    setOk('E-mail atualizado! Verifique sua caixa de entrada para confirmar a alteração.')
    setEmailForm({ novo: '' })
  }

  return (
    <div className="page">
      {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
      {ok  && <div className="alert-box alert-success mb-3">{ok}</div>}

      {/* Avatar */}
      <div style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',padding:'24px 20px',marginBottom:12,textAlign:'center'}}>
        <div
          onClick={()=>fileRef.current?.click()}
          style={{width:88,height:88,borderRadius:'50%',background:'var(--primary-light)',border:'3px solid var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',overflow:'hidden',cursor:'pointer',position:'relative'}}
        >
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            : <span style={{fontSize:30,fontWeight:700,color:'var(--primary)'}}>{getInitials(profile.full_name??'')}</span>
          }
          {uploading && (
            <div style={{position:'absolute',inset:0,background:'rgba(255,255,255,0.8)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div className="spinner" style={{width:24,height:24,borderWidth:2}}/>
            </div>
          )}
        </div>
        <p style={{fontSize:18,fontWeight:700,marginBottom:2}}>{profile.full_name ?? '—'}</p>
        <p style={{fontSize:13,color:'var(--muted)',marginBottom:14}}>{ROLE_LABELS[profile.user_role] ?? profile.user_role}</p>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}}>
          <button
            className="btn btn-outline btn-sm"
            onClick={()=>fileRef.current?.click()}
            disabled={uploading}
          >
            <span className="icon icon-sm">photo_camera</span>
            {uploading ? 'Enviando...' : 'Alterar foto'}
          </button>
          {profile.avatar_url && !uploading && (
            <button className="btn btn-ghost btn-sm" onClick={()=>setRecorte({ src: String(profile.avatar_url).split('?')[0], remoto: true })}>
              <span className="icon icon-sm">crop</span> Reposicionar
            </button>
          )}
        </div>
        <input
          ref={fileRef} type="file" accept="image/*"
          style={{display:'none'}}
          onChange={e=>{ if(e.target.files?.[0]) aoEscolherFoto(e.target.files[0]); e.target.value='' }}
        />

        {recorte && (
          <RecortarFoto
            src={recorte.src}
            crossOrigin={recorte.remoto}
            onCancel={fecharRecorte}
            onConfirm={(blob)=>{ fecharRecorte(); enviarFoto(blob) }}
          />
        )}
      </div>

      {/* Dados pessoais */}
      <form onSubmit={salvarDados}>
        <div style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',padding:'16px 20px',marginBottom:12}}>
          <p style={{fontSize:13,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>Dados pessoais</p>
          <div className="form-group">
            <label className="form-label">Nome completo <span className="req">*</span></label>
            <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/>
          </div>
          <div className="form-group">
            <label className="form-label">Telefone</label>
            <input className="form-input" type="tel" placeholder="(11) 99999-9999" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/>
          </div>
          <div className="form-group">
            <label className="form-label">Igreja</label>
            <input className="form-input" placeholder="Nome da sua igreja" value={form.church} onChange={e=>setForm(f=>({...f,church:e.target.value}))}/>
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar dados'}
          </button>
        </div>
      </form>

      {/* Meu cadastro de pessoa no evento (crachá, equipe, escala) */}
      <div style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',padding:'16px 20px',marginBottom:12}}>
        <p style={{fontSize:13,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>Meu cadastro no evento</p>
        {!evento ? (
          <p style={{fontSize:13,color:'var(--muted)'}}>Nenhum evento ativo.</p>
        ) : carregandoP ? (
          <p style={{fontSize:13,color:'var(--muted)'}}>Carregando...</p>
        ) : meuP ? (
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span className="badge badge-success">✓ Cadastrado como {meuP.role_type==='worker'?'Encontreiro':'Encontrista'}</span>
            <span style={{fontSize:12,color:'var(--muted)'}}>Já aparece em Cadastros, pode entrar em equipe e ter crachá.</span>
          </div>
        ) : (
          <>
            <p style={{fontSize:13,color:'var(--muted)',marginBottom:12,lineHeight:1.5}}>Você tem conta mas ainda <strong>não é uma pessoa do evento</strong>. Crie seu cadastro para ter <strong>crachá</strong>, entrar em <strong>equipe</strong> e ser escalado. (Usa seu nome, foto e igreja do perfil.)</p>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-primary" style={{flex:1}} disabled={criandoP} onClick={()=>criarMeuCadastro('worker')}>
                {criandoP?'Criando...':'Sou Encontreiro'}
              </button>
              <button className="btn btn-outline" style={{flex:1}} disabled={criandoP} onClick={()=>criarMeuCadastro('encounterer')}>
                Sou Encontrista
              </button>
            </div>
          </>
        )}
      </div>

      {/* Alterar e-mail */}
      <form onSubmit={alterarEmail}>
        <div style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',padding:'16px 20px',marginBottom:12}}>
          <p style={{fontSize:13,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>Alterar e-mail</p>
          <div className="form-group">
            <label className="form-label">Novo e-mail <span className="req">*</span></label>
            <input className="form-input" type="email" placeholder="seu-novo@email.com" value={emailForm.novo} onChange={e=>setEmailForm({novo:e.target.value})} required/>
          </div>
          <button type="submit" className="btn btn-ghost btn-full">Alterar e-mail</button>
        </div>
      </form>

      {/* Alterar senha */}
      <form onSubmit={alterarSenha}>
        <div style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',padding:'16px 20px',marginBottom:12}}>
          <p style={{fontSize:13,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>Alterar senha</p>
          <div className="form-group">
            <label className="form-label">Nova senha <span className="req">*</span></label>
            <input className="form-input" type="password" placeholder="Mínimo 6 caracteres" value={senhaForm.nova} onChange={e=>setSenhaForm(f=>({...f,nova:e.target.value}))} required/>
          </div>
          <div className="form-group">
            <label className="form-label">Confirmar nova senha <span className="req">*</span></label>
            <input className="form-input" type="password" placeholder="Repita a nova senha" value={senhaForm.conf} onChange={e=>setSenhaForm(f=>({...f,conf:e.target.value}))} required/>
          </div>
          <button type="submit" className="btn btn-ghost btn-full">Alterar senha</button>
        </div>
      </form>

      {/* Info da conta */}
      <div style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',padding:'16px 20px'}}>
        <p style={{fontSize:13,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>Informações da conta</p>
        <div className="info-row"><span className="info-label">Nível de acesso</span><span className="info-value">{ROLE_LABELS[profile.user_role] ?? profile.user_role}</span></div>
        <div className="info-row"><span className="info-label">Status</span><span className="badge badge-success">Aprovado</span></div>
      </div>
    </div>
  )
}
