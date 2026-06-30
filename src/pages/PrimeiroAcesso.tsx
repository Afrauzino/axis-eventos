import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PrimeiroAcesso() {
  const [etapa, setEtapa]   = useState<'codigo'|'conta'|'ok'>('codigo')
  const [codigo, setCodigo] = useState('')
  const [pessoa, setPessoa] = useState<{id:string;name:string}|null>(null)
  const [email, setEmail]   = useState('')
  const [senha, setSenha]   = useState('')
  const [conf, setConf]     = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro]     = useState('')

  async function verificarCodigo(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setLoading(true)
    const { data } = await supabase
      .from('people')
      .select('id,name,user_id')
      .eq('invite_code', codigo.toUpperCase().trim())
      .maybeSingle()

    if (!data) {
      setErro('Código não encontrado. Verifique e tente novamente.')
      setLoading(false); return
    }
    if (data.user_id) {
      setErro('Este código já foi utilizado. Faça login normalmente.')
      setLoading(false); return
    }
    setPessoa({ id: data.id, name: data.name })
    setEtapa('conta')
    setLoading(false)
  }

  async function criarConta(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setLoading(true)
    if (senha !== conf) { setErro('As senhas não coincidem.'); setLoading(false); return }
    if (senha.length < 6) { setErro('Senha mínima: 6 caracteres.'); setLoading(false); return }
    if (!pessoa) return

    // Criar conta no Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
      options: { data: { full_name: pessoa.name } }
    })

    if (authErr) {
      setErro('Erro ao criar conta: ' + authErr.message)
      setLoading(false); return
    }

    // Vincular conta à pessoa
    if (authData.user) {
      await supabase.from('people').update({
        user_id: authData.user.id,
        invite_code: null // invalida o código
      }).eq('id', pessoa.id)

      // Criar profile
      await supabase.from('profiles').upsert({
        user_id: authData.user.id,
        name: pessoa.name,
        user_role: 'encontreiro',
        role_status: 'approved'
      }, { onConflict: 'user_id' })
    }

    setEtapa('ok')
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'20px'}}>
      <div style={{width:'100%',maxWidth:380}}>
        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{width:64,height:64,borderRadius:16,background:'var(--primary)',margin:'0 auto 12px',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:34,color:'white',fontWeight:'normal',fontStyle:'normal',lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',userSelect:'none',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24"}}>church</span>
          </div>
          <h1 style={{fontSize:22,fontWeight:800,color:'var(--text)',marginBottom:4}}>AXIS Eventos</h1>
          <p style={{fontSize:14,color:'var(--muted)'}}>Primeiro acesso</p>
        </div>

        <div style={{background:'white',borderRadius:20,boxShadow:'0 4px 24px rgba(0,0,0,0.08)',padding:'28px 24px'}}>

          {etapa === 'codigo' && (
            <>
              <h2 style={{fontSize:18,fontWeight:700,marginBottom:6}}>Seu código de acesso</h2>
              <p style={{fontSize:13,color:'var(--muted)',marginBottom:20,lineHeight:1.6}}>
                Digite o código de 8 letras que você recebeu do coordenador.
              </p>
              {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
              <form onSubmit={verificarCodigo}>
                <div className="form-group">
                  <input
                    className="form-input"
                    value={codigo}
                    onChange={e=>setCodigo(e.target.value.toUpperCase())}
                    placeholder="Ex: ABCD1234"
                    required
                    maxLength={8}
                    style={{textAlign:'center',fontSize:22,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase'}}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={loading||codigo.length<6}>
                  {loading ? 'Verificando...' : 'Continuar'}
                </button>
              </form>
              <p style={{fontSize:12,color:'var(--muted)',textAlign:'center',marginTop:16}}>
                Já tem conta?{' '}
                <a href="/" style={{color:'var(--primary)',fontWeight:600}}>Fazer login</a>
              </p>
            </>
          )}

          {etapa === 'conta' && pessoa && (
            <>
              <div style={{background:'var(--primary-light)',borderRadius:12,padding:'12px 14px',marginBottom:20,display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:24}}>👋</span>
                <div>
                  <p style={{fontWeight:700,fontSize:14,color:'var(--primary-dark)'}}>Olá, {pessoa.name.split(' ')[0]}!</p>
                  <p style={{fontSize:12,color:'var(--primary)'}}>Crie seu email e senha de acesso</p>
                </div>
              </div>
              {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
              <form onSubmit={criarConta}>
                <div className="form-group">
                  <label className="form-label">Seu email <span className="req">*</span></label>
                  <input className="form-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required/>
                </div>
                <div className="form-group">
                  <label className="form-label">Criar senha <span className="req">*</span></label>
                  <input className="form-input" type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Confirmar senha <span className="req">*</span></label>
                  <input className="form-input" type="password" value={conf} onChange={e=>setConf(e.target.value)} placeholder="Repita a senha" required/>
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? 'Criando conta...' : 'Criar minha conta'}
                </button>
              </form>
            </>
          )}

          {etapa === 'ok' && (
            <div style={{textAlign:'center',padding:'20px 0'}}>
              <div style={{fontSize:48,marginBottom:12}}>🎉</div>
              <h2 style={{fontSize:20,fontWeight:800,marginBottom:8}}>Conta criada!</h2>
              <p style={{fontSize:14,color:'var(--muted)',marginBottom:20,lineHeight:1.6}}>
                Sua conta foi criada com sucesso. Você já pode fazer login com seu email e senha.
              </p>
              <a href="/" className="btn btn-primary btn-full" style={{textDecoration:'none',display:'block',textAlign:'center'}}>
                Fazer login
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
