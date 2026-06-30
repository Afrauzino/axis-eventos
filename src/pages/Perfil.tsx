import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { formatName, getInitials, ROLE_LABELS } from '../utils'
import type { Profile } from '../App'

export default function Perfil({ profile, onUpdate }: { profile: Profile; onUpdate: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm]       = useState({ name: profile.full_name ?? '', phone: (profile as any).phone ?? '', church: (profile as any).church ?? '' })
  const [senhaForm, setSenhaForm] = useState({ nova: '', conf: '' })
  const [emailForm, setEmailForm] = useState({ novo: '' })
  const [salvando, setSalvando]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro]           = useState('')
  const [ok, setOk]               = useState('')

  async function uploadFoto(file: File) {
    setUploading(true); setErro(''); setOk('')
    const ext  = file.name.split('.').pop()
    // Usa timestamp para garantir URL única e quebrar cache do browser
    const path = `avatars/${profile.user_id}_${Date.now()}.${ext}`
    // Remove fotos antigas deste usuário antes de enviar nova
    const { data: listData } = await supabase.storage.from('avatars').list('', { search: profile.user_id })
    if (listData && listData.length > 0) {
      const toDelete = listData.map(f => f.name)
      await supabase.storage.from('avatars').remove(toDelete)
    }
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: false })
    if (upErr) { setErro('Erro ao enviar foto: ' + upErr.message); setUploading(false); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    // Adiciona timestamp na URL para forçar refresh do browser
    const urlComCache = data.publicUrl + '?t=' + Date.now()
    const { error: upErr2 } = await supabase.from('profiles').update({ avatar_url: urlComCache }).eq('user_id', profile.user_id)
    if (upErr2) { setErro('Foto enviada mas erro ao salvar: ' + upErr2.message); setUploading(false); return }
    setOk('Foto atualizada!'); setUploading(false); onUpdate()
  }

  async function salvarDados(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setErro(''); setOk('')
    const nome = formatName(form.name)
    if (!nome) { setErro('Nome obrigatório.'); setSalvando(false); return }
    const { error } = await supabase.from('profiles')
      .update({ name: nome, phone: form.phone || null, church: form.church || null })
      .eq('user_id', profile.user_id)
    if (error) { setErro('Erro ao salvar: ' + error.message) }
    else { setOk('Dados atualizados!'); onUpdate() }
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
        <button
          className="btn btn-outline btn-sm"
          onClick={()=>fileRef.current?.click()}
          disabled={uploading}
        >
          <span className="icon icon-sm">photo_camera</span>
          {uploading ? 'Enviando...' : 'Alterar foto'}
        </button>
        <input
          ref={fileRef} type="file" accept="image/*"
          style={{display:'none'}}
          onChange={e=>e.target.files?.[0] && uploadFoto(e.target.files[0])}
        />
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
