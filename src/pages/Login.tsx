import { useState } from 'react'
import { supabase } from '../lib/supabase'
import CadastroPessoa, { FORM_VAZIO, MED_VAZIO, type PessoaForm, type MedCtrl } from '../components/CadastroPessoa'

type Modo = 'login' | 'codigo' | 'cadastro' | 'recuperar'

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

  // Formulário unificado
  const [form, setForm]   = useState<PessoaForm>({...FORM_VAZIO})
  const [usaMed, setUsaMed] = useState(false)
  const [meds, setMeds]   = useState<MedCtrl[]>([])
  const [saudeOk, setSaudeOk] = useState(false)

  function reset(m: Modo) {
    setModo(m); setErro(''); setOk('')
    setEmail(''); setSenha(''); setConf('')
    setForm({...FORM_VAZIO}); setUsaMed(false); setMeds([]); setSaudeOk(false)
  }

  // LOGIN
  async function fazerLogin(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro('Email ou senha incorretos.')
    setLoading(false)
  }

  // VERIFICAR CÓDIGO
  async function verificarCodigo(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setLoading(true)
    const { data, error } = await supabase
      .from('people')
      .select('id,name,user_id,event_id,phone,church,role_type,sexo,birth_date,cpf,rg,cidade,estado,endereco,bairro,cep,contact_phone,photo_url,notes')
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

  // CRIAR CONTA COMPLETA
  async function criarConta(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setLoading(true)
    if (!pessoa) return

    // Validações
    if (!form.photo_url) { setErro('A foto é obrigatória.'); setLoading(false); return }
    if (!form.name.trim()) { setErro('Nome é obrigatório.'); setLoading(false); return }
    if (!form.phone.trim()) { setErro('Celular é obrigatório.'); setLoading(false); return }
    if (!email.trim()) { setErro('Email é obrigatório.'); setLoading(false); return }
    if (senha.length < 6) { setErro('Senha mínima: 6 caracteres.'); setLoading(false); return }
    if (senha !== conf) { setErro('As senhas não coincidem.'); setLoading(false); return }
    if (!saudeOk) {
      setErro('Você precisa visitar a aba Saúde antes de concluir. Toque em "🩺 Saúde" acima.')
      setLoading(false); return
    }
    if (usaMed && meds.some(m=>!m.nome.trim())) { setErro('Preencha o nome de todos os medicamentos.'); setLoading(false); return }

    // Criar conta Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
      options: { data: { full_name: form.name } }
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
      name: form.name,
      phone: telefoneLimpo,
      contact_phone: form.contact_phone || null,
      church: form.church || null,
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
      name: form.name,
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
    const ehEncontrista = form.role_type === 'encounterer'
    if (usaMed && meds.length > 0 && ehEncontrista) {
      try {
        const { data: ev } = await supabase.from('events')
          .select('start_date,end_date').eq('id', pessoa.event_id).single()

        for (const med of meds.filter(m=>m.nome.trim())) {
          const { data: newMed, error: medErr } = await supabase.from('med_controlados').insert({
            person_id: pessoa.id, event_id: pessoa.event_id,
            nome: med.nome, tipo: med.tipo,
            dosagem: med.dosagem || null,
            horario_ini: med.horario_ini,
            intervalo_h: med.intervalo_h,
            vezes_dia: Math.round(24 / med.intervalo_h),
          }).select('id').single()

          const intervalo = Number(med.intervalo_h) > 0 ? Number(med.intervalo_h) : 8
          if (!medErr && newMed && ev?.start_date && ev?.end_date) {
            const [h, m] = med.horario_ini.split(':').map(Number)
            const start = new Date(ev.start_date + 'T00:00:00')
            const end   = new Date(ev.end_date + 'T23:59:59')
            const items: any[] = []
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
              const cursor = new Date(start)
              cursor.setHours(h || 8, m || 0, 0, 0)
              let guard = 0
              while (cursor <= end && guard < 500) {
                items.push({
                  med_ctrl_id: newMed.id, person_id: pessoa.id,
                  event_id: pessoa.event_id, nome: med.nome,
                  dosagem: med.dosagem || null,
                  horario: cursor.toISOString(), entregue: false,
                })
                cursor.setTime(cursor.getTime() + intervalo * 3600000)
                guard++
              }
            }
            if (items.length) await supabase.from('med_agenda').insert(items)
          }
        }
      } catch (medError) {
        console.warn('Aviso medicamentos:', medError)
      }
    }

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
          <div className="auth-logo-icon">ECD</div>
          <div>
            <div className="auth-logo-text">AXIS Eventos</div>
            <div className="auth-logo-sub">Gestão de Eventos</div>
          </div>
        </div>
        <h1 className="auth-headline">
          {modo==='login'    ? 'Acesso ao sistema'
          :modo==='codigo'   ? 'Primeiro acesso'
          :modo==='cadastro' ? `Olá, ${pessoa?.name.split(' ')[0]}!`
          :                    'Recuperar senha'}
        </h1>
        <p className="auth-sub-text">
          {modo==='cadastro'
            ? 'Preencha todos os dados para concluir seu cadastro'
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
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading} style={{marginTop:8}}>
              {loading?'Entrando...':'Entrar'}
            </button>
            <div style={{textAlign:'center',marginTop:16}}>
              <button type="button" onClick={()=>reset('recuperar')}
                style={{background:'none',border:'none',color:'var(--primary)',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>
                Esqueci minha senha
              </button>
            </div>
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
              usaMed={usaMed}
              onUsaMedChange={setUsaMed}
              meds={meds}
              onMedsChange={setMeds}
              onSaudeVisit={()=>setSaudeOk(true)}
            />

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
