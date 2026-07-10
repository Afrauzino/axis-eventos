import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { carregarConfig } from '../lib/tema'
import { enviarPush } from '../lib/push'
import { biometriaSuportada, ativarBiometria } from '../lib/biometria'
import CadastroPessoa, { FORM_VAZIO, MED_VAZIO, type PessoaForm, type MedCtrl } from '../components/CadastroPessoa'
import InstallPWA from '../components/InstallPWA'
import { toast } from '../components/Toast'
import { formatName } from '../utils'

type Modo = 'login' | 'codigo' | 'cadastro' | 'recuperar' | 'inscrever'

export default function Login() {
  const [modo, setModo]   = useState<Modo>('login')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [conf, setConf]   = useState('')
  const [codigo, setCodigo] = useState('')
  const [pessoa, setPessoa] = useState<{id:string;name:string;event_id:string}|null>(null)
  const [erro, setErro]   = useState('')
  const [ok, setOk]       = useState('')
  const [loading, setLoading] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string|null>(null)
  const [bioSuporta, setBioSuporta] = useState(false)
  const [querBio, setQuerBio] = useState(true)   // ativar digital ao entrar (marcado por padrão)
  useEffect(() => { biometriaSuportada().then(setBioSuporta) }, [])
  const [eventoAtivo, setEventoAtivo] = useState<{id:string;name:string}|null>(null)
  const [abertas, setAbertas] = useState(true)   // inscrições abertas/fechadas (admin controla)
  const [evLoad, setEvLoad] = useState(true)
  useEffect(() => { carregarConfig('logo_url').then(setLogoUrl) }, [])
  useEffect(() => { carregarConfig('inscricoes_abertas').then(v => setAbertas(v !== 'false')) }, [])

  // Evento ativo (para o link aberto de inscrição)
  useEffect(() => {
    supabase.from('events').select('id,name').eq('status','active').order('created_at',{ascending:false}).limit(1).maybeSingle()
      .then(({ data }) => { setEventoAtivo(data ? { id:data.id, name:data.name } : null); setEvLoad(false) })
  }, [])

  // Links: ?codigo=XXX abre "Primeiro acesso"; ?inscrever=1 abre a inscrição aberta
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const c = p.get('codigo')
    if (c) { setCodigo(c.toUpperCase()); setModo('codigo') }
    else if (p.get('acesso') === '1') { setModo('codigo') }
    else if (p.get('inscrever') === '1') { setModo('inscrever') }
  }, [])

  // Formulário unificado
  const [form, setForm]   = useState<PessoaForm>({...FORM_VAZIO})
  const [usaMed, setUsaMed] = useState(false)
  const [meds, setMeds]   = useState<MedCtrl[]>([])

  // Termos do evento (aceite obrigatório se o admin definiu um)
  const [termoEncontrista, setTermoEncontrista] = useState('')
  const [termoEncontreiro, setTermoEncontreiro] = useState('')
  const [aceito, setAceito] = useState(false)
  useEffect(() => {
    carregarConfig('termo_encontrista').then(v => setTermoEncontrista(v ?? ''))
    carregarConfig('termo_encontreiro').then(v => setTermoEncontreiro(v ?? ''))
  }, [])
  const termoAtual = (form.role_type === 'worker' ? termoEncontreiro : termoEncontrista).trim()
  useEffect(() => { setAceito(false) }, [form.role_type])  // troca de tipo → reaceitar
  const blocoTermos = termoAtual ? (
    <div style={{ border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px', margin:'10px 0 4px', background:'var(--bg)' }}>
      <p style={{ fontSize:12, fontWeight:800, marginBottom:6 }}>📜 Termos do evento</p>
      <div style={{ maxHeight:170, overflowY:'auto', fontSize:13, color:'var(--text2)', lineHeight:1.6, whiteSpace:'pre-wrap', marginBottom:10, paddingRight:4 }}>{termoAtual}</div>
      <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14, fontWeight:700 }}>
        <input type="checkbox" checked={aceito} onChange={e=>setAceito(e.target.checked)} style={{ width:18, height:18 }}/>
        Li e aceito os termos
      </label>
    </div>
  ) : null

  function reset(m: Modo) {
    setModo(m); setErro(''); setOk('')
    setEmail(''); setSenha(''); setConf('')
    setForm({...FORM_VAZIO}); setUsaMed(false); setMeds([])
  }

  // LOGIN
  async function fazerLogin(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) { setErro('Email ou senha incorretos.'); setLoading(false); return }
    // Ativa a digital deste aparelho (se a pessoa deixou marcado e o celular suporta)
    if (bioSuporta && querBio && data.user) {
      const okBio = await ativarBiometria(data.user.id, (data.user.user_metadata as any)?.name)
      if (okBio) { try { sessionStorage.setItem('axis_bio_unlocked', '1') } catch {} }
    }
    setLoading(false)
  }

  // VERIFICAR CÓDIGO
  async function verificarCodigo(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setLoading(true)
    const { data, error } = await supabase
      .from('people')
      .select('id,name,user_id,event_id,phone,church,role_type,sexo,birth_date,cpf,rg,cidade,estado,endereco,bairro,cep,contact_phone,photo_url,notes,ano_encontro')
      .eq('invite_code', codigo.toUpperCase().trim())
      .maybeSingle()

    if (error || !data) {
      setErro('Código não encontrado. Confirme o código com a pessoa responsável.')
      setLoading(false); return
    }
    if (data.user_id) {
      setErro('Este código já foi usado. Faça login normalmente.')
      setLoading(false); return
    }
    setPessoa({ id:data.id, name:data.name, event_id:data.event_id })
    // Pré-preenche o formulário com dados do pré-cadastro
    setForm(f => ({
      ...f,
      name:         data.name         ?? '',
      phone:        (data.phone && data.phone.toLowerCase()!=='a cadastrar') ? data.phone : '',
      contact_phone:data.contact_phone?? '',
      church:       data.church       ?? '',
      ano_encontro: data.ano_encontro ? String(data.ano_encontro) : '',
      role_type:    data.role_type    ?? 'encounterer',
      sexo:         data.sexo         ?? '',
      birth_date:   data.birth_date   ?? '',
      cpf:          data.cpf          ?? '',
      rg:           data.rg           ?? '',
      cidade:       data.cidade       ?? '',
      estado:       data.estado       ?? '',
      endereco:     data.endereco     ?? '',
      bairro:       data.bairro       ?? '',
      cep:          data.cep          ?? '',
      notes:        data.notes        ?? '',
      photo_url:    data.photo_url    ?? null,
    }))
    setModo('cadastro')
    setLoading(false)
  }

  // Gera a agenda de doses dos medicamentos contínuos (reutilizado por código e inscrição)
  async function gerarAgendaMeds(personId: string, eventId: string) {
    if (!(usaMed && meds.length > 0)) return
    try {
      const { data: ev } = await supabase.from('events').select('start_date,end_date').eq('id', eventId).single()
      for (const med of meds.filter(m => m.nome.trim())) {
        const { data: newMed, error: medErr } = await supabase.from('med_controlados').insert({
          person_id: personId, event_id: eventId, nome: med.nome, tipo: med.tipo,
          dosagem: med.dosagem || null, horario_ini: med.horario_ini,
          intervalo_h: med.intervalo_h, vezes_dia: Math.round(24 / med.intervalo_h),
        }).select('id').single()
        const intervalo = Number(med.intervalo_h) > 0 ? Number(med.intervalo_h) : 8
        if (!medErr && newMed && ev?.start_date && ev?.end_date) {
          const [h, m] = med.horario_ini.split(':').map(Number)
          const start = new Date(ev.start_date + 'T00:00:00')
          const end = new Date(ev.end_date + 'T23:59:59')
          const items: any[] = []
          if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
            const cursor = new Date(start); cursor.setHours(h || 8, m || 0, 0, 0); let guard = 0
            while (cursor <= end && guard < 500) {
              items.push({ med_ctrl_id: newMed.id, person_id: personId, event_id: eventId, nome: med.nome, dosagem: med.dosagem || null, horario: cursor.toISOString(), entregue: false })
              cursor.setTime(cursor.getTime() + intervalo * 3600000); guard++
            }
          }
          if (items.length) await supabase.from('med_agenda').insert(items)
        }
      }
    } catch (e) { console.warn('Aviso medicamentos:', e) }
  }

  // INSCRIÇÃO ABERTA (link público) — cria o próprio cadastro, pendente de aprovação
  async function inscreverConta(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setLoading(true)
    if (!eventoAtivo) { setErro('As inscrições estão fechadas no momento.'); setLoading(false); return }
    const erroValid =
      !form.photo_url ? 'A foto é obrigatória.' :
      !form.name.trim() ? 'Nome é obrigatório.' :
      !form.phone.trim() ? 'Celular é obrigatório.' :
      !email.trim() ? 'Email é obrigatório.' :
      senha.length < 6 ? 'Senha mínima: 6 caracteres.' :
      senha !== conf ? 'As senhas não coincidem.' :
      (usaMed && meds.some(m => !m.nome.trim())) ? 'Preencha o nome de todos os medicamentos.' : ''
    if (erroValid) {
      setErro(erroValid); toast.aviso(erroValid); setLoading(false)
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); document.querySelector('.auth-body,.auth-wrap,main')?.scrollTo({ top: 0, behavior: 'smooth' }) } catch {}
      return
    }

    // Nome sempre gravado na norma do português (MARIA DA SILVA → Maria da Silva)
    const nome = formatName(form.name)

    // Anti-duplicidade por NOME COMPLETO (checagem no servidor — sql/49)
    try {
      const { data: existe } = await supabase.rpc('nome_ja_existe', { p_event: eventoAtivo.id, p_nome: nome })
      if (existe === true) {
        const m = 'Já existe um cadastro com esse nome. Se for você, use o CÓDIGO de primeiro acesso que te enviaram (ou faça login). Se você não tem código, fale com a liderança. Se for outra pessoa com o mesmo nome, acrescente um sobrenome.'
        setErro(m); toast.aviso(m); setLoading(false); return
      }
    } catch {}

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password: senha, options: { data: { full_name: nome } },
    })
    if (authErr) {
      const msg = authErr.message || ''
      setErro(msg.includes('already') ? 'Este email já foi cadastrado. Faça login.' : 'Erro ao criar conta: ' + msg)
      setLoading(false); return
    }
    const uid = authData?.user?.id
    if (!uid) { setErro('Verifique seu email para confirmar o cadastro, depois faça login.'); setLoading(false); return }

    const tel = form.phone.trim()
    // Cria o próprio registro de pessoa (fica pendente de aprovação do admin)
    const { data: nova, error: pErr } = await supabase.from('people').insert({
      event_id: eventoAtivo.id, user_id: uid, name: nome, phone: tel,
      // church e role_type sao NOT NULL no banco — nunca mandar null
      contact_phone: form.contact_phone || null, church: (form.church || '').trim(),
      role_type: form.role_type || 'encounterer',
      ano_encontro: form.ano_encontro ? Number(form.ano_encontro) : null, sexo: form.sexo || null,
      birth_date: form.birth_date || null, cpf: form.cpf || null, rg: form.rg || null,
      cidade: form.cidade || null, estado: form.estado || null, endereco: form.endereco || null,
      bairro: form.bairro || null, cep: form.cep || null, notes: form.notes || null,
      photo_url: form.photo_url || null, team_pref: form.team_pref || null,
    }).select('id').single()
    if (pErr) { setErro('Erro ao salvar inscrição: ' + pErr.message + ' (o admin precisa rodar sql/41_inscricao_aberta.sql)'); setLoading(false); return }
    const personId = nova.id

    const r2 = await supabase.from('profiles').upsert({
      user_id: uid, name: nome, phone: tel, user_role: 'visitante', role_status: 'pending',
    }, { onConflict: 'user_id' })
    if (r2.error) { setErro('Erro ao criar perfil: ' + r2.error.message); setLoading(false); return }

    // Web Push: avisa os admins (mesmo com o app fechado) que tem gente aguardando
    enviarPush({ notify_admins: true, title: '🙋 Nova inscrição', body: `${nome} se inscreveu — toque para aprovar`, url: '/admin', tag: 'aprov' })

    const r3 = await supabase.from('saude_fichas').upsert({
      person_id: personId, event_id: eventoAtivo.id,
      diabetes: form.diabetes, hipertensao: form.hipertensao, cardiopatia: form.cardiopatia,
      epilepsia: form.epilepsia, ansiedade: form.ansiedade, tipo_sanguineo: form.tipo_sanguineo || null,
      alergias: form.alergias || null, restricoes_alimentares: form.restricoes_alimentares || null,
      observacoes: form.observacoes_saude || null,
      contato_emergencia_nome: form.responsavel_nome || '', contato_emergencia_telefone: form.contact_phone || form.responsavel_tel || '',
    }, { onConflict: 'person_id,event_id' })
    if (r3.error) console.warn('Aviso ficha médica:', r3.error.message)

    if (form.role_type === 'encounterer') await gerarAgendaMeds(personId, eventoAtivo.id)

    setLoading(false)
    setOk('Inscrição enviada! Aguardando aprovação do administrador.')
    try { await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha }) } catch {}
  }

  // CRIAR CONTA COMPLETA
  async function criarConta(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setLoading(true)
    if (!pessoa) return

    // Validações
    // Validação: mostra um TOAST (visível em qualquer posição da tela) + rola pro topo,
    // pra pessoa não achar que o botão "não faz nada" quando está rolada lá embaixo.
    const erroValid =
      !form.photo_url ? 'A foto é obrigatória.' :
      !form.name.trim() ? 'Nome é obrigatório.' :
      !form.phone.trim() ? 'Celular é obrigatório.' :
      !email.trim() ? 'Email é obrigatório.' :
      senha.length < 6 ? 'Senha mínima: 6 caracteres.' :
      senha !== conf ? 'As senhas não coincidem.' :
      (usaMed && meds.some(m=>!m.nome.trim())) ? 'Preencha o nome de todos os medicamentos.' :
      (termoAtual && !aceito) ? 'Você precisa ler e aceitar os termos do evento.' : ''
    if (erroValid) {
      setErro(erroValid); toast.aviso(erroValid); setLoading(false)
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); document.querySelector('.auth-body,.auth-wrap,main')?.scrollTo({ top: 0, behavior: 'smooth' }) } catch {}
      return
    }

    // Nome sempre gravado na norma do português (MARIA DA SILVA → Maria da Silva)
    const nome = formatName(form.name)

    // Anti-duplicidade por NOME COMPLETO (ignora o próprio pré-cadastro) — sql/49
    try {
      const { data: existe } = await supabase.rpc('nome_ja_existe', { p_event: pessoa.event_id, p_nome: nome, p_exceto: pessoa.id })
      if (existe === true) {
        const m = 'Já existe outra pessoa com esse nome neste evento. Acrescente um sobrenome para diferenciar.'
        setErro(m); toast.aviso(m); setLoading(false); return
      }
    } catch {}

    // Criar conta Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
      options: { data: { full_name: nome } }
    })

    if (authErr) {
      const msg = authErr.message || (authErr as any).error_description || 'Verifique os dados e tente novamente.'
      if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('already exists')) {
        setErro('Este email já foi cadastrado. Use outro email ou faça login.')
      } else {
        setErro('Erro ao criar conta: ' + msg)
      }
      setLoading(false); return
    }

    const uid = authData?.user?.id
    if (!uid) {
      setErro('Verifique seu email para confirmar o cadastro, depois faça login.')
      setLoading(false); return
    }

    // Limpar placeholder "a cadastrar" se ainda estiver no telefone
    const telefoneLimpo = (form.phone && form.phone.toLowerCase()!=='a cadastrar') ? form.phone.trim() : form.phone.trim()

    // ETAPA 1 — Atualizar people
    const r1 = await supabase.from('people').update({
      user_id: uid,
      invite_code: null,
      name: nome,
      phone: telefoneLimpo,
      contact_phone: form.contact_phone || null,
      church: (form.church || '').trim(),  // igreja opcional
      ano_encontro: form.ano_encontro ? Number(form.ano_encontro) : null,
      sexo: form.sexo || null,
      birth_date: form.birth_date || null,
      cpf: form.cpf || null,
      rg: form.rg || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      endereco: form.endereco || null,
      bairro: form.bairro || null,
      cep: form.cep || null,
      notes: form.notes || null,
      photo_url: form.photo_url || null,
      role_type: form.role_type,
      team_pref: form.team_pref || null,
    }).eq('id', pessoa.id)
    if (r1.error) { setErro('Erro ao salvar dados pessoais: ' + r1.error.message); setLoading(false); return }

    // ETAPA 2 — Profile
    const r2 = await supabase.from('profiles').upsert({
      user_id: uid,
      name: nome,
      phone: telefoneLimpo,
      user_role: 'visitante',
      role_status: 'pending',
    }, { onConflict: 'user_id' })
    if (r2.error) { setErro('Erro ao criar perfil: ' + r2.error.message); setLoading(false); return }

    // ETAPA 3 — Ficha médica
    const r3 = await supabase.from('saude_fichas').upsert({
      person_id:                   pessoa.id,
      event_id:                    pessoa.event_id,
      diabetes:                    form.diabetes,
      hipertensao:                 form.hipertensao,
      cardiopatia:                 form.cardiopatia,
      epilepsia:                   form.epilepsia,
      ansiedade:                   form.ansiedade,
      tipo_sanguineo:              form.tipo_sanguineo || null,
      alergias:                    form.alergias || null,
      restricoes_alimentares:      form.restricoes_alimentares || null,
      observacoes:                 form.observacoes_saude || null,
      contato_emergencia_nome:     form.responsavel_nome || '',
      contato_emergencia_telefone: form.contact_phone || form.responsavel_tel || '',
    }, { onConflict: 'person_id,event_id' })
    // Ficha médica não bloqueia o cadastro se falhar (pode ser preenchida depois)
    if (r3.error) console.warn('Aviso ficha médica:', r3.error.message)

    // ETAPA 4 — Medicamentos (só encontristas geram agenda de entrega)
    if (form.role_type === 'encounterer') await gerarAgendaMeds(pessoa.id, pessoa.event_id)

    // Sucesso garantido — mostrar mensagem ANTES de qualquer login
    setLoading(false)
    setOk('Cadastro concluído! Aguardando aprovação do administrador.')
    // Login automático em background (não bloqueia o feedback)
    try {
      await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha })
    } catch (loginErr) {
      console.warn('Login automático falhou, faça login manual:', loginErr)
    }
  }

  // RECUPERAR SENHA
  async function recuperarSenha(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (error) setErro('Erro ao enviar email.')
    else setOk('Email enviado. Verifique sua caixa de entrada.')
    setLoading(false)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-top">
        <div className="auth-logo">
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="auth-logo-icon" style={{objectFit:'cover',padding:0}}/>
            : <div className="auth-logo-icon">ECD</div>}
          <div>
            <div className="auth-logo-text">AXIS Eventos</div>
            <div className="auth-logo-sub">Gestão de Eventos</div>
          </div>
        </div>
        <h1 className="auth-headline">
          {modo==='login'    ? 'Acesso ao sistema'
          :modo==='codigo'   ? 'Primeiro acesso'
          :modo==='cadastro' ? `Olá, ${pessoa?.name.split(' ')[0]}!`
          :modo==='inscrever'? 'Inscrição'
          :                    'Recuperar senha'}
        </h1>
        <p className="auth-sub-text">
          {(modo==='cadastro'||modo==='inscrever')
            ? 'Preencha seus dados para concluir'
            : 'Sistema de gestão de eventos religiosos'}
        </p>
      </div>

      <div className="auth-body">
        {(modo==='login'||modo==='codigo') && (
          <div className="tabs mb-4">
            <button className={`tab ${modo==='login'?'active':''}`} onClick={()=>reset('login')}>Entrar</button>
            <button className={`tab ${modo==='codigo'?'active':''}`} onClick={()=>reset('codigo')}>Primeiro acesso</button>
          </div>
        )}

        {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
        {ok   && <div className="alert-box alert-success mb-3">{ok}</div>}

        {/* LOGIN */}
        {modo==='login' && (
          <form onSubmit={fazerLogin}>
            <div className="form-group">
              <label className="form-label">Email <span className="req">*</span></label>
              <input className="form-input" type="email" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
            </div>
            <div className="form-group">
              <label className="form-label">Senha <span className="req">*</span></label>
              <input className="form-input" type="password" placeholder="Mínimo 6 caracteres" value={senha} onChange={e=>setSenha(e.target.value)} required/>
            </div>
            {bioSuporta && (
              <button type="button" onClick={()=>setQuerBio(v=>!v)}
                style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',marginTop:4,borderRadius:10,cursor:'pointer',fontFamily:'inherit',textAlign:'left',border:`2px solid ${querBio?'var(--primary)':'var(--border)'}`,background:querBio?'var(--primary-light)':'white'}}>
                <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:22,color:querBio?'var(--primary)':'var(--muted)',lineHeight:1,fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24"}}>fingerprint</span>
                <span style={{flex:1,fontSize:13,fontWeight:600,color:querBio?'var(--primary-dark)':'var(--text2)'}}>Entrar com digital nas próximas vezes</span>
                <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${querBio?'var(--primary)':'var(--border)'}`,background:querBio?'var(--primary)':'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {querBio && <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:14,color:'white',lineHeight:1}}>check</span>}
                </div>
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading} style={{marginTop:8}}>
              {loading?'Entrando...':'Entrar'}
            </button>
            <div style={{textAlign:'center',marginTop:16}}>
              <button type="button" onClick={()=>reset('recuperar')}
                style={{background:'none',border:'none',color:'var(--primary)',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>
                Esqueci minha senha
              </button>
            </div>
            <div style={{textAlign:'center',marginTop:16,paddingTop:16,borderTop:'1px solid var(--border)'}}>
              <p style={{fontSize:13,color:'var(--muted)',marginBottom:8}}>Ainda não tem cadastro?</p>
              <button type="button" onClick={()=>reset('inscrever')}
                style={{background:'none',border:'1.5px solid var(--primary)',color:'var(--primary)',borderRadius:10,padding:'10px 20px',fontSize:14,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>
                Fazer minha inscrição
              </button>
            </div>
            <InstallPWA variant="inline" />
          </form>
        )}

        {/* CÓDIGO */}
        {modo==='codigo' && (
          <form onSubmit={verificarCodigo}>
            <p style={{fontSize:13,color:'var(--muted)',marginBottom:16,lineHeight:1.6}}>
              Digite o código de acesso que você recebeu para criar sua conta.
            </p>
            <div className="form-group">
              <label className="form-label">Código de acesso <span className="req">*</span></label>
              <input className="form-input" value={codigo}
                onChange={e=>setCodigo(e.target.value.toUpperCase())}
                placeholder="Ex: ABCD1234" maxLength={8} required
                style={{textAlign:'center',fontSize:22,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase'}}/>
            </div>
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading||codigo.length<6}>
              {loading?'Verificando...':'Continuar'}
            </button>
          </form>
        )}

        {/* CADASTRO COMPLETO */}
        {modo==='cadastro' && pessoa && (
          <form onSubmit={criarConta}>
            {/* 1. EMAIL E SENHA — primeiros campos */}
            <p className="section-label mb-2">🔑 Dados de acesso</p>
            <div className="form-group">
              <label className="form-label">Email <span className="req">*</span></label>
              <input className="form-input" type="email" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Senha <span className="req">*</span></label>
                <input className="form-input" type="password" placeholder="Mín. 6 caracteres" value={senha} onChange={e=>setSenha(e.target.value)} required minLength={6}/>
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar senha <span className="req">*</span></label>
                <input className="form-input" type="password" placeholder="Repita" value={conf} onChange={e=>setConf(e.target.value)} required/>
              </div>
            </div>

            {/* 2. FORMULÁRIO UNIFICADO — foto, dados pessoais, saúde + meds */}
            <CadastroPessoa
              form={form}
              onChange={setForm}
              eventoId={pessoa.event_id}
              showRole={true}
              showStatus={false}
              showTeam={true}
              showReferencia={form.role_type==='encounterer'}
              fotoObrigatoria={true}
            />

            {blocoTermos}

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading} style={{marginTop:16}}>
              {loading?'Salvando cadastro...':'Concluir cadastro'}
            </button>
            <div style={{textAlign:'center',marginTop:12}}>
              <button type="button" onClick={()=>{reset('codigo');setPessoa(null)}}
                style={{background:'none',border:'none',color:'var(--muted)',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
                ← Voltar
              </button>
            </div>
          </form>
        )}

        {/* INSCRIÇÃO ABERTA (link público) */}
        {modo==='inscrever' && (
          evLoad ? (
            <p style={{textAlign:'center',color:'var(--muted)',fontSize:13,padding:'20px 0'}}>Carregando...</p>
          ) : (!eventoAtivo || !abertas) ? (
            <>
              <div className="alert-box alert-info mb-3">As inscrições estão fechadas no momento.</div>
              <button type="button" className="btn btn-ghost btn-full" onClick={()=>reset('login')}>← Voltar</button>
            </>
          ) : (
            <form onSubmit={inscreverConta}>
              <div className="alert-box alert-info mb-3" style={{fontSize:13}}>
                Inscrição para <b>{eventoAtivo.name}</b>. Depois de enviar, o administrador aprova o seu acesso.
              </div>
              <p className="section-label mb-2">🔑 Dados de acesso</p>
              <div className="form-group">
                <label className="form-label">Email <span className="req">*</span></label>
                <input className="form-input" type="email" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Senha <span className="req">*</span></label>
                  <input className="form-input" type="password" placeholder="Mín. 6 caracteres" value={senha} onChange={e=>setSenha(e.target.value)} required minLength={6}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Confirmar senha <span className="req">*</span></label>
                  <input className="form-input" type="password" placeholder="Repita" value={conf} onChange={e=>setConf(e.target.value)} required/>
                </div>
              </div>

              <CadastroPessoa
                form={form}
                onChange={setForm}
                eventoId={eventoAtivo.id}
                showRole={true}
                showStatus={false}
                showTeam={true}
                showReferencia={form.role_type==='encounterer'}
                fotoObrigatoria={true}
              />

              {blocoTermos}

              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading} style={{marginTop:16}}>
                {loading?'Enviando inscrição...':'Enviar inscrição'}
              </button>
              <div style={{textAlign:'center',marginTop:12}}>
                <button type="button" onClick={()=>reset('login')}
                  style={{background:'none',border:'none',color:'var(--muted)',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
                  ← Voltar
                </button>
              </div>
            </form>
          )
        )}

        {/* RECUPERAR SENHA */}
        {modo==='recuperar' && (
          <form onSubmit={recuperarSenha}>
            <div className="form-group">
              <label className="form-label">Seu email</label>
              <input className="form-input" type="email" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading?'Enviando...':'Enviar link de recuperação'}
            </button>
            <div style={{textAlign:'center',marginTop:12}}>
              <button type="button" onClick={()=>reset('login')}
                style={{background:'none',border:'none',color:'var(--primary)',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>
                ← Voltar para o login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
