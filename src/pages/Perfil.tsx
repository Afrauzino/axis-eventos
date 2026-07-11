import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatName, getInitials, ROLE_LABELS } from '../utils'
import { useEvento } from '../hooks/useEvento'
import RecortarFoto from '../components/RecortarFoto'
import CadastroPessoa, { FORM_VAZIO, type PessoaForm } from '../components/CadastroPessoa'
import { toast } from '../components/Toast'
import { pathOriginal, urlOriginal, imagemCarrega, baixarImagem } from '../lib/foto'
import { biometriaSuportada, biometriaAtiva, ativarBiometria, desativarBiometria } from '../lib/biometria'
import { testarPush } from '../lib/push'
import { validarCadastroFaltando } from '../lib/cadastroCfg'
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
      church: (form.church || (profile as any).church || '').trim(),
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
  const [baixandoFoto, setBaixandoFoto] = useState(false)
  // Editar TODO o meu cadastro (dados pessoais) — salva via função no banco
  const [cadAberto, setCadAberto] = useState(false)
  const [cadForm, setCadForm] = useState<PessoaForm>(FORM_VAZIO)
  const [salvandoCad, setSalvandoCad] = useState(false)

  async function abrirMeuCadastro() {
    if (!meuP) return
    const { data } = await supabase.from('people').select('*').eq('id', meuP.id).maybeSingle()
    const d: any = data ?? {}
    setCadForm({ ...FORM_VAZIO,
      name: d.name ?? '', phone: d.phone ?? '', contact_phone: d.contact_phone ?? '',
      church: d.church ?? '', ano_encontro: d.ano_encontro ? String(d.ano_encontro) : '',
      sexo: d.sexo ?? '', birth_date: d.birth_date ?? '', cpf: d.cpf ?? '', rg: d.rg ?? '',
      cidade: d.cidade ?? '', estado: d.estado ?? '', endereco: d.endereco ?? '', bairro: d.bairro ?? '', cep: d.cep ?? '',
      role_type: d.role_type ?? 'encounterer', status: d.status ?? 'inscrito',
      team_pref: d.team_pref ?? '', referencia_id: d.referencia_id ?? '', cargo: d.cargo ?? '', notes: d.notes ?? '',
      responsavel_nome: d.responsavel_nome ?? '', responsavel_tel: d.responsavel_tel ?? '',
      photo_url: d.photo_url ?? null,
    })
    setCadAberto(true)
  }

  async function salvarMeuCadastro() {
    if (!cadForm.name.trim()) { toast.aviso('O nome é obrigatório.'); return }
    { const faltam = await validarCadastroFaltando(cadForm); if (faltam.length) { toast.aviso('Preencha: ' + faltam.join(', ') + '.'); return } }
    setSalvandoCad(true)
    const payload = {
      name: formatName(cadForm.name),
      phone: (cadForm.phone || '').replace(/\D/g, '') || cadForm.phone || '',
      contact_phone: cadForm.contact_phone || '',
      church: (cadForm.church || '').trim(),
      ano_encontro: cadForm.ano_encontro || '',
      sexo: cadForm.sexo || '', birth_date: cadForm.birth_date || '',
      cpf: cadForm.cpf || '', rg: cadForm.rg || '',
      cidade: cadForm.cidade || '', estado: cadForm.estado || '', endereco: cadForm.endereco || '', bairro: cadForm.bairro || '', cep: cadForm.cep || '',
      cargo: cadForm.cargo || '',
      team_pref: cadForm.team_pref || '', responsavel_nome: cadForm.responsavel_nome || '', responsavel_tel: cadForm.responsavel_tel || '',
      notes: cadForm.notes || '', photo_url: cadForm.photo_url || null,
    }
    const { error } = await supabase.rpc('atualizar_meu_cadastro', { p: payload })
    setSalvandoCad(false)
    if (error) {
      const semFuncao = /atualizar_meu_cadastro|function|does not exist|schema cache/i.test(error.message || '')
      toast.falha(semFuncao ? 'Falta rodar o sql/59_meu_cadastro.sql no Supabase.' : ('Não foi possível salvar: ' + (error.message || 'erro')), error)
      return
    }
    toast.sucesso('Seus dados foram atualizados!')
    setCadAberto(false); onUpdate()
  }
  const [testandoPush, setTestandoPush] = useState(false)

  async function testarNotificacao() {
    setErro(''); setOk(''); setTestandoPush(true)
    const r = await testarPush(profile.user_id)
    setTestandoPush(false)
    if (r.etapa === 'suporte') { setErro('Este aparelho/navegador não suporta notificações.'); return }
    if (r.etapa === 'assinar') { setErro('❌ Não consegui ativar. Vá em Configurações do Android → Apps → AXIS → Notificações e PERMITA. Depois teste de novo.'); return }
    if (r.ok) setOk(r.localOk ? '✅ Tudo certo! As duas notificações (local + servidor) foram enviadas — devem aparecer na bandeja.' : '✅ O push do servidor foi enviado. Deve aparecer na bandeja.')
    else if (!r.localOk) setErro('❌ Nem a notificação LOCAL apareceu. É permissão do app: Config. do Android → Apps → AXIS → Notificações → Permitir.')
    else if (r.detalhe?.semAlvos) setErro('⚠️ A notificação LOCAL funcionou (o aparelho exibe!), mas o SERVIDOR não achou a assinatura. Falta REPUBLICAR a Edge Function enviar-push (código final).')
    else setErro('⚠️ A LOCAL funcionou, mas o servidor não entregou. Confira a função enviar-push e as chaves VAPID. (' + JSON.stringify(r.detalhe ?? {}) + ')')
  }
  // Entrar com digital (desbloqueio biométrico deste aparelho)
  const [bioSuporta, setBioSuporta] = useState(false)
  const [bioOn, setBioOn] = useState<boolean>(() => biometriaAtiva(profile.user_id))
  const [bioBusy, setBioBusy] = useState(false)
  useEffect(() => { biometriaSuportada().then(setBioSuporta) }, [])

  async function toggleBio() {
    setErro(''); setOk(''); setBioBusy(true)
    if (bioOn) {
      desativarBiometria(profile.user_id); setBioOn(false); setOk('Entrada por digital desativada.')
    } else {
      const okBio = await ativarBiometria(profile.user_id, profile.full_name ?? undefined)
      setBioOn(okBio)
      if (okBio) { try { sessionStorage.setItem('axis_bio_unlocked', '1') } catch {} ; setOk('Pronto! Agora você entra com a digital.') }
      else setErro('Não foi possível ativar a digital neste aparelho.')
    }
    setBioBusy(false)
  }

  // Escolheu um arquivo → abre o ENQUADRAMENTO (não envia direto)
  function aoEscolherFoto(file: File) { setErro(''); setOk(''); setRecorte({ src: URL.createObjectURL(file), remoto: false }) }
  function fecharRecorte() { if (recorte && !recorte.remoto) { try { URL.revokeObjectURL(recorte.src) } catch {} } setRecorte(null) }

  // Reenquadrar: abre a ORIGINAL (não o recorte). Fotos antigas caem na de exibição.
  async function reenquadrarFoto() {
    setErro(''); setOk('')
    const disp = String(profile.avatar_url).split('?')[0]
    const orig = urlOriginal(disp)
    const temOrig = orig !== disp && await imagemCarrega(orig + '?t=' + Date.now())
    setRecorte({ src: (temOrig ? orig : disp) + '?t=' + Date.now(), remoto: true })
  }

  async function baixarFotoOriginal() {
    if (!profile.avatar_url) return
    setBaixandoFoto(true)
    const disp = String(profile.avatar_url).split('?')[0]
    const orig = urlOriginal(disp)
    const temOrig = orig !== disp && await imagemCarrega(orig + '?t=' + Date.now())
    await baixarImagem((temOrig ? orig : disp) + '?t=' + Date.now(), 'minha-foto-original.jpg')
    setBaixandoFoto(false)
  }

  // Recebe o recorte (exibição) + a original inteira e envia (guarda as duas).
  async function enviarFoto(blob: Blob, original: Blob | null) {
    setUploading(true); setErro(''); setOk('')
    // Usa timestamp para garantir URL única e quebrar cache do browser
    const path = `avatars/${profile.user_id}_${Date.now()}.jpg`
    // Remove fotos antigas deste usuário antes de enviar nova (recorte + original)
    const { data: listData } = await supabase.storage.from('avatars').list('', { search: profile.user_id })
    if (listData && listData.length > 0) {
      const toDelete = listData.map(f => f.name)
      await supabase.storage.from('avatars').remove(toDelete)
    }
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: false, contentType: 'image/jpeg' })
    if (upErr) { setErro('Erro ao enviar foto: ' + upErr.message); setUploading(false); return }
    // Guarda a ORIGINAL inteira ao lado (pra reenquadrar/baixar depois)
    if (original) { await supabase.storage.from('avatars').upload(pathOriginal(path), original, { upsert: true, contentType: 'image/jpeg' }) }
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
      .update({ name: nome, phone: form.phone || null, church: (form.church || '').trim() })
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
    // O e-mail mora só no login (auth.users) — `profiles` não tem essa coluna.
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
            <button className="btn btn-ghost btn-sm" onClick={reenquadrarFoto}>
              <span className="icon icon-sm">crop</span> Reenquadrar
            </button>
          )}
          {profile.avatar_url && !uploading && (
            <button className="btn btn-ghost btn-sm" onClick={baixarFotoOriginal} disabled={baixandoFoto}>
              <span className="icon icon-sm">download</span> {baixandoFoto ? 'Baixando...' : 'Baixar original'}
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
            onConfirm={(blob, original)=>{ fecharRecorte(); enviarFoto(blob, original) }}
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
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <span className="badge badge-success">✓ Cadastrado como {meuP.role_type==='worker'?'Encontreiro':'Encontrista'}</span>
              <span style={{fontSize:12,color:'var(--muted)'}}>Já aparece em Cadastros, pode entrar em equipe e ter crachá.</span>
            </div>
            <button className="btn btn-primary btn-sm" style={{alignSelf:'flex-start'}} onClick={abrirMeuCadastro}>
              <span className="icon icon-sm">edit</span> Editar todos os meus dados
            </button>
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

      {/* Segurança — entrar com digital */}
      {bioSuporta && (
        <div style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',padding:'16px 20px',marginBottom:12}}>
          <p style={{fontSize:13,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>Segurança</p>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:26,lineHeight:1}}>🔐</span>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:14,fontWeight:700}}>Entrar com digital</p>
              <p style={{fontSize:12,color:'var(--muted)'}}>Abra o app com a digital do celular, sem digitar senha.</p>
            </div>
            <button type="button" onClick={toggleBio} disabled={bioBusy} aria-label="Ativar entrada por digital"
              style={{flexShrink:0,width:52,height:30,borderRadius:99,border:'none',cursor:'pointer',position:'relative',background:bioOn?'var(--success)':'var(--border)',transition:'background 0.2s',fontFamily:'inherit'}}>
              <span style={{position:'absolute',top:3,left:bioOn?25:3,width:24,height:24,borderRadius:'50%',background:'white',boxShadow:'0 1px 3px rgba(0,0,0,0.3)',transition:'left 0.2s'}}/>
            </button>
          </div>
        </div>
      )}

      {/* Notificações */}
      <div style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',padding:'16px 20px',marginBottom:12}}>
        <p style={{fontSize:13,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Notificações</p>
        <p style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>Toque para ativar e enviar um teste para este aparelho.</p>
        <button type="button" className="btn btn-primary btn-full" onClick={testarNotificacao} disabled={testandoPush}>
          <span className="icon icon-sm" style={{color:'white'}}>notifications_active</span> {testandoPush ? 'Testando...' : 'Testar notificação neste celular'}
        </button>
      </div>

      {/* Info da conta */}
      <div style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',padding:'16px 20px'}}>
        <p style={{fontSize:13,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>Informações da conta</p>
        <div className="info-row"><span className="info-label">Nível de acesso</span><span className="info-value">{ROLE_LABELS[profile.user_role] ?? profile.user_role}</span></div>
        <div className="info-row"><span className="info-label">Status</span><span className="badge badge-success">Aprovado</span></div>
      </div>

      {/* Editar TODO o meu cadastro (dados pessoais) — tela cheia */}
      {cadAberto && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',flexDirection:'column'}} onClick={e=>e.target===e.currentTarget&&setCadAberto(false)}>
          <div style={{background:'white',height:'100dvh',maxHeight:'100dvh',overflowY:'auto',width:'100%',padding:'0 20px 32px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20,position:'sticky',top:0,background:'white',zIndex:1}}>
              <button onClick={()=>setCadAberto(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontFamily:'inherit',fontWeight:700,fontSize:13}}><span className="icon icon-sm">arrow_back</span> Voltar</button>
              <span style={{fontSize:16,fontWeight:800}}>Meus dados</span>
              <span style={{width:74}}/>
            </div>
            <CadastroPessoa
              form={cadForm}
              onChange={setCadForm}
              eventoId={evento?.id}
              showRole={false}
              showStatus={false}
              showTeam={false}
              showReferencia={false}
              fotoObrigatoria={false}
            />
            <div style={{display:'flex',gap:8,marginTop:18}}>
              <button className="btn btn-primary" style={{flex:1}} onClick={salvarMeuCadastro} disabled={salvandoCad}>{salvandoCad?'Salvando...':'Salvar meus dados'}</button>
              <button className="btn btn-ghost" onClick={()=>setCadAberto(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
