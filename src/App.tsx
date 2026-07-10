import { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { carregarCorSalva, carregarConfig, aplicarIconesApp } from './lib/tema'
import { formatName, isAdmin } from './utils'
import { usePermissao } from './hooks/usePermissao'
import Nav from './components/Nav'
import CriticalAlert from './components/CriticalAlert'
import NotificacoesCenter, { sincronizarPushLocal } from './components/NotificacoesCenter'
import { ativarPush } from './lib/push'
import InstallPWA from './components/InstallPWA'
import { ToastHost } from './components/Toast'
import BotaoConfig from './components/BotaoConfig'
import { ChromeProvider } from './lib/chrome'
import { useEvento } from './hooks/useEvento'
import Login from './pages/Login'
import Pending from './pages/Pending'
import Dashboard from './pages/Dashboard'
import CriticoWatcher from './components/CriticoWatcher'
import ParabensAniversario from './components/ParabensAniversario'
import AtivarNotificacoes from './components/AtivarNotificacoes'
import AberturaGate from './components/AberturaGate'
import BloqueioBiometrico from './components/BloqueioBiometrico'
import { biometriaAtiva } from './lib/biometria'
// #perf — telas carregadas SOB DEMANDA (lazy): a inicial abre bem mais rápido, sem perder nada
const MinhasAtividades = lazy(() => import('./pages/MinhasAtividades'))
const Cronograma       = lazy(() => import('./pages/Cronograma'))
const Encontristas     = lazy(() => import('./pages/Encontristas'))
const Cadastros        = lazy(() => import('./pages/Cadastros'))
const Equipes          = lazy(() => import('./pages/Equipes'))
const Correio          = lazy(() => import('./pages/Correio'))
const SaudeSistema     = lazy(() => import('./pages/SaudeSistema'))
const AlertasLideres   = lazy(() => import('./pages/AlertasLideres'))
const Cozinha          = lazy(() => import('./pages/Cozinha'))
const Ministracoes     = lazy(() => import('./pages/Ministracoes'))
const Logistica        = lazy(() => import('./pages/Logistica'))
const Midia            = lazy(() => import('./pages/Midia'))
const Impressao        = lazy(() => import('./pages/Impressao'))
const TeatroLista      = lazy(() => import('./pages/TeatroLista'))
const TeatroDetalhe    = lazy(() => import('./pages/TeatroDetalhe'))
const TeatroAtores     = lazy(() => import('./pages/TeatroAtores'))
const TeatroObjetos    = lazy(() => import('./pages/TeatroObjetos'))
const TeatroPersonagens= lazy(() => import('./pages/TeatroPersonagens'))
const Locais           = lazy(() => import('./pages/Locais'))
const Saude            = lazy(() => import('./pages/Saude'))
const SaudeFicha       = lazy(() => import('./pages/SaudeFicha'))
const Medicamentos     = lazy(() => import('./pages/Medicamentos'))
const SaudeConfig      = lazy(() => import('./pages/SaudeConfig'))
const Alertas          = lazy(() => import('./pages/Alertas'))
const Ocorrencias      = lazy(() => import('./pages/Ocorrencias'))
const Financeiro       = lazy(() => import('./pages/Financeiro'))
const Escalas          = lazy(() => import('./pages/Escalas'))
const Relatorios       = lazy(() => import('./pages/Relatorios'))
const Doacoes          = lazy(() => import('./pages/Doacoes'))
const MenusAdmin       = lazy(() => import('./pages/MenusAdmin'))
const ConfigNotificacoes = lazy(() => import('./pages/ConfigNotificacoes'))
const Ranking          = lazy(() => import('./pages/Ranking'))
const Admin            = lazy(() => import('./pages/Admin'))
const Perfil           = lazy(() => import('./pages/Perfil'))

export type Profile = {
  id: string
  user_id: string
  full_name: string | null  // mapped from DB 'name' column in loadProfile
  avatar_url: string | null
  user_role: string
  is_admin?: boolean
  role_status?: string
  phone?: string | null
  church?: string | null
}

// Permissão (menu) exigida por rota. Rotas livres (Início/Perfil) retornam null.
const ROTA_PERM = ([
  ['/minhas-atividades','menu_atividades'],
  ['/cronograma','menu_cronograma'],
  ['/encontristas','menu_encontristas'],
  ['/cadastros','menu_cadastros'],
  ['/equipes','menu_equipes'],
  ['/escalas','menu_equipes'],
  ['/correio','menu_correio'],
  ['/logistica','menu_logistica'],
  ['/midia','menu_midia'],
  ['/impressao','menu_impressao'],
  ['/alertas-lideres','menu_alertas_lideres'],
  ['/alertas','menu_alertas_lideres'],
  ['/cozinha','menu_cozinha'],
  ['/ministracoes','menu_ministracoes'],
  ['/ministrantes','menu_ministracoes'],
  ['/teatro','menu_teatro'],
  ['/locais','menu_evento'],
  ['/ocorrencias','menu_evento'],
  ['/saude','menu_saude'],
  ['/financeiro','menu_financeiro'],
  ['/doacoes','menu_financeiro'],
  ['/relatorios','menu_admin'],
  ['/ranking','menu_ranking'],
  ['/admin','menu_admin'],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length) // mais específico primeiro

function permDaRota(path: string): string | null {
  if (path === '/' || path === '/perfil') return null
  // Link direto a UMA ministração (/ministracoes/:id): a própria tela controla o acesso
  // (o ministrante vê a sua com acesso total; quem não é dono só vê a info básica).
  // Assim o ministrante chega pela "Minhas Atividades" sem precisar do menu Ministrações.
  if (/^\/ministracoes\/[^/]+$/.test(path)) return null
  for (const [pref, perm] of ROTA_PERM) {
    if (path === pref || path.startsWith(pref + '/')) return perm
  }
  return null
}

function SemAcesso() {
  const navigate = useNavigate()
  return (
    <div className="page" style={{ textAlign:'center', padding:'56px 20px' }}>
      <div style={{ fontSize:46, marginBottom:12 }}>🔒</div>
      <p style={{ fontSize:18, fontWeight:800, marginBottom:6 }}>Sem acesso</p>
      <p style={{ fontSize:14, color:'var(--muted)', marginBottom:22 }}>Você não tem permissão para abrir esta tela.</p>
      <button className="btn btn-primary" onClick={()=>navigate('/')}>Ir para o início</button>
    </div>
  )
}

function AppRoutes({ profile, onProfileUpdate, versaoFotos }: { profile: Profile; onProfileUpdate: () => void; versaoFotos: number }) {
  const loc = useLocation()
  const { pode, carregado } = usePermissao(profile)
  const admin = isAdmin(profile.user_role) || profile.is_admin
  const perm = permDaRota(loc.pathname)
  // Cadeado: sem permissão → tela "Sem acesso" (admin passa sempre)
  if (perm && !admin) {
    if (!carregado) return <div className="page">{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:10,borderRadius:14}}/>)}</div>
    if (!pode(perm)) return <SemAcesso />
  }
  return (
    <Suspense fallback={<div className="page">{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:10,borderRadius:14}}/>)}</div>}>
    {/* key muda quando ALGUÉM troca a foto → a tela aberta recarrega sozinha */}
    <Routes key={versaoFotos}>
      <Route path="/"                      element={<Dashboard profile={profile} />} />
      <Route path="/minhas-atividades"     element={<MinhasAtividades profile={profile} />} />
      <Route path="/cronograma"            element={<Cronograma profile={profile} />} />
      <Route path="/encontristas"          element={<Encontristas profile={profile} />} />
      <Route path="/cadastros"             element={<Cadastros profile={profile} />} />
      <Route path="/equipes"               element={<Equipes profile={profile} />} />
      <Route path="/correio"               element={<Correio profile={profile} />} />
      <Route path="/logistica"             element={<Logistica profile={profile} />} />
      <Route path="/midia"                 element={<Midia profile={profile} />} />
      <Route path="/impressao"             element={<Impressao profile={profile} />} />
      <Route path="/admin/saude-sistema"   element={<SaudeSistema profile={profile} />} />
      <Route path="/alertas-lideres"       element={<AlertasLideres profile={profile} />} />
      <Route path="/cozinha"               element={<Cozinha profile={profile} />} />
      <Route path="/escalas"               element={<Escalas profile={profile} />} />
      <Route path="/ministracoes"          element={<Ministracoes profile={profile} />} />
      <Route path="/ministracoes/:id"       element={<Ministracoes profile={profile} />} />
      <Route path="/ministrantes"          element={<Navigate to="/ministracoes" replace />} />
      <Route path="/teatro"                element={<TeatroLista profile={profile} />} />
      <Route path="/teatro/atores"         element={<TeatroAtores profile={profile} />} />
      <Route path="/teatro/objetos"        element={<TeatroObjetos profile={profile} />} />
      <Route path="/teatro/personagens"    element={<TeatroPersonagens profile={profile} />} />
      <Route path="/teatro/:id"            element={<TeatroDetalhe profile={profile} />} />
      <Route path="/locais"                element={<Locais profile={profile} />} />
      <Route path="/saude"                 element={<Saude profile={profile} />} />
      <Route path="/saude/ficha"           element={<SaudeFicha profile={profile} />} />
      <Route path="/saude/medicamentos"    element={<Medicamentos profile={profile} />} />
      <Route path="/saude/config"          element={<SaudeConfig profile={profile} />} />
      <Route path="/alertas"               element={<Alertas profile={profile} />} />
      <Route path="/ocorrencias"           element={<Ocorrencias profile={profile} />} />
      <Route path="/financeiro"            element={<Financeiro profile={profile} />} />
      <Route path="/relatorios"            element={<Relatorios profile={profile} />} />
      <Route path="/doacoes"               element={<Doacoes profile={profile} />} />
      <Route path="/admin/menus"           element={<MenusAdmin profile={profile} />} />
      <Route path="/admin/notificacoes"    element={<ConfigNotificacoes profile={profile} />} />
      <Route path="/ranking"               element={<Ranking profile={profile} />} />
      <Route path="/admin"                 element={<Admin profile={profile} />} />
      <Route path="/perfil"                element={<Perfil profile={profile} onUpdate={onProfileUpdate} />} />
      <Route path="*"                      element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}


// Título da página atual no header (regra AXIS: nome da página, nunca do evento)
const TITULOS_ROTA: Record<string,string> = {
  '/': 'Início',
  '/minhas-atividades': 'Minhas Atividades',
  '/cronograma': 'Cronograma',
  '/encontristas': 'Encontristas',
  '/cadastros': 'Cadastros',
  '/equipes': 'Equipes',
  '/escalas': 'Escalas',
  '/ministracoes': 'Ministrações',
  '/ranking': 'Ranking',
  '/teatro': 'Teatro',
  '/teatro/atores': 'Teatro',
  '/teatro/personagens': 'Teatro',
  '/teatro/objetos': 'Teatro',
  '/alertas': 'Alertas',
  '/saude': 'Saúde',
  '/saude/ficha': 'Saúde',
  '/saude/medicamentos': 'Medicamentos',
  '/saude/config': 'Configuração',
  '/ocorrencias': 'Ocorrências',
  '/financeiro': 'Financeiro',
  '/doacoes': 'Doações',
  '/relatorios': 'Comparativo',
  '/locais': 'Locais',
  '/admin': 'Administração',
  '/admin/menus': 'Administração',
  '/admin/notificacoes': 'Notificações',
  '/correio': 'Correio',
  '/logistica': 'Logística',
  '/midia': 'Mídia',
  '/impressao': 'Impressão',
  '/admin/saude-sistema': 'Saúde do Sistema',
  '/alertas-lideres': 'Alertas',
  '/cozinha': 'Cozinha',
}
function HeaderTitle() {
  const loc = useLocation()
  const titulo = TITULOS_ROTA[loc.pathname] ?? 'AXIS Eventos'
  return <span style={{flex:1,fontSize:16,fontWeight:700,color:'white'}}>{titulo}</span>
}
// Botão de voltar universal — aparece em todas as telas (menos a inicial) e volta de onde veio
function BotaoVoltar() {
  const loc = useLocation()
  const navigate = useNavigate()
  if (loc.pathname === '/' || loc.pathname === '') return null
  return (
    <button onClick={()=>{ if (window.history.length > 1) navigate(-1); else navigate('/') }} aria-label="Voltar"
      style={{background:'rgba(255,255,255,0.15)',border:'none',cursor:'pointer',color:'white',display:'flex',alignItems:'center',justifyContent:'center',width:36,height:36,borderRadius:8,fontFamily:'inherit',flexShrink:0}}>
      <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:22,color:'white',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",lineHeight:1}}>arrow_back</span>
    </button>
  )
}

export default function App() {
  const [session, setSession]   = useState<any>(null)
  const [profile, setProfile]   = useState<Profile|null>(null)
  const [loading, setLoading]   = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [alertCount, setAlertCount] = useState(0)
  // #6 — central de notificações
  const [notifOpen, setNotifOpen] = useState(false)
  const [bioUnlocked, setBioUnlocked] = useState<boolean>(() => { try { return sessionStorage.getItem('axis_bio_unlocked') === '1' } catch { return false } })  // digital: destrava por sessão (re-trava a cada abertura do app)
  const [notifUnread, setNotifUnread] = useState(0)
  const [versaoFotos, setVersaoFotos] = useState(0)
  const { evento: eventoAtivo } = useEvento()

  // Troca de foto em tempo real: quando qualquer pessoa muda a foto, a tela
  // aberta recarrega. Só reage à FOTO (o banco manda o valor antigo junto —
  // REPLICA IDENTITY FULL no sql/50), senão qualquer salvamento recarregaria tudo.
  useEffect(() => {
    if (!session) return
    const mudouFoto = (payload: any) => {
      const n = payload.new ?? {}, v = payload.old ?? {}
      const antes = v.photo_url ?? v.avatar_url
      const depois = n.photo_url ?? n.avatar_url
      return depois !== undefined && antes !== depois
    }
    const meu = (p: any) => (p.new as any)?.user_id === session.user.id
    const canal = supabase.channel('fotos-globais')
      // Foto de OUTRA pessoa: recarrega a tela aberta (Equipes, Escalas, Crachá…).
      // A minha própria eu já atualizo na tela de Perfil — remontar aqui apagaria o aviso de sucesso.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'people' },
        p => { if (mudouFoto(p) && !meu(p)) setVersaoFotos(v => v + 1) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' },
        p => { if (!mudouFoto(p)) return
               if (meu(p)) loadProfile(session.user.id); else setVersaoFotos(v => v + 1) })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [session])

  useEffect(() => {
    carregarCorSalva()
    carregarConfig('logo_url').then(url => aplicarIconesApp(url))
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
      if (data) {
        // Fallback da foto: se profiles.avatar_url estiver vazio, usa a foto do cadastro (people.photo_url)
        let avatar = data.avatar_url
        if (!avatar) {
          // A pessoa pode ter vários registros em people (um por evento) — maybeSingle() falharia.
          // Pegamos o primeiro registro que tenha foto.
          const { data: pessoas } = await supabase.from('people')
            .select('photo_url').eq('user_id', userId).not('photo_url','is',null).limit(1)
          if (pessoas && pessoas[0]?.photo_url) avatar = pessoas[0].photo_url
        }
        setProfile({ ...data, full_name: data.name ?? data.full_name ?? null, avatar_url: avatar })
      }
    } catch (err) {
      console.warn('Erro ao carregar perfil:', err)
    } finally {
      setLoading(false)
    }
  }

  // Contagem de pendentes de aprovação (só para admin) — DEVE vir antes de qualquer return
  useEffect(() => {
    if (!profile || !profile.is_admin) { setPendingCount(0); return }
    let ativo = true
    async function contarPendentes() {
      const { count } = await supabase.from('profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('role_status', 'pending')
      if (ativo) setPendingCount(count ?? 0)
    }
    contarPendentes()
    const t = setInterval(contarPendentes, 30000)
    return () => { ativo = false; clearInterval(t) }
  }, [profile])

  // #6 — contagem de notificações NÃO lidas (pro badge do sininho)
  useEffect(() => {
    if (!profile?.user_id) { setNotifUnread(0); return }
    let ativo = true
    const calc = () => sincronizarPushLocal(profile, eventoAtivo?.id ?? null).then(n => { if (ativo) setNotifUnread(n) }).catch(()=>{})
    if (!notifOpen) calc()
    const t = setInterval(() => { if (!notifOpen) calc() }, 60000)
    return () => { ativo = false; clearInterval(t) }
  }, [profile, eventoAtivo?.id, notifOpen])

  // Web Push — ao entrar: se já permitiu, assina; se ainda não decidiu, PEDE a permissão
  // (no APK isso dispara o pedido do Android já na 1ª abertura).
  useEffect(() => {
    if (!profile?.user_id || typeof Notification === 'undefined') return
    if (Notification.permission === 'granted') { ativarPush(profile.user_id); return }
    if (Notification.permission === 'default') {
      try { Notification.requestPermission().then(p => { if (p === 'granted' && profile?.user_id) ativarPush(profile.user_id) }) } catch {}
    }
  }, [profile?.user_id])

  // Contagem de alertas não lidos (tempo real, todos os usuários)
  useEffect(() => {
    if (!profile?.user_id) { setAlertCount(0); return }
    let ativo = true
    async function contarAlertas() {
      const { data: p } = await supabase.from('people').select('id').eq('user_id', profile!.user_id).maybeSingle()
      if (!p) { if (ativo) setAlertCount(0); return }
      const { data } = await supabase.from('alertas_lideres_dest')
        .select('id').eq('destinatario_id', p.id).eq('lido', false)
      if (ativo) setAlertCount((data ?? []).length)
    }
    contarAlertas()
    const t = setInterval(contarAlertas, 10000)
    return () => { ativo = false; clearInterval(t) }
  }, [profile])

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg)'}}>
      <div className="spinner"/>
    </div>
  )
  if (!session) return <Login />
  if (!profile) return <Login />
  // Show pending screen for anyone awaiting admin approval
  if (profile.role_status === 'pending' || profile.role_status === 'rejected' || profile.role_status === 'blocked' || profile.role_status === 'suspended' || profile.user_role === 'visitante') return <Pending profile={profile}/>
  // Desbloqueio por digital: se ativo neste aparelho, trava até passar a digital
  const bioDestravado = bioUnlocked || (() => { try { return sessionStorage.getItem('axis_bio_unlocked') === '1' } catch { return false } })()
  if (biometriaAtiva(profile.user_id) && !bioDestravado) return <BloqueioBiometrico profile={profile} onUnlock={()=>{ try { sessionStorage.setItem('axis_bio_unlocked','1') } catch {} ; setBioUnlocked(true) }} />

  return (
    <BrowserRouter>
     <ChromeProvider>
      <div className="app-root">
        {/* Portão de abertura do dia do evento (bloqueia tudo até a cerimônia) */}
        <AberturaGate />
        {/* Header */}
        <header style={{height:56,background:'var(--primary)',display:'flex',alignItems:'center',padding:'0 16px',gap:12,flexShrink:0,zIndex:100,boxShadow:'0 2px 8px rgba(0,169,157,0.2)'}}>
          <button onClick={()=>setMenuOpen(true)} style={{background:'none',border:'none',cursor:'pointer',color:'white',display:'flex',alignItems:'center',justifyContent:'center',width:36,height:36,borderRadius:8,fontFamily:'inherit'}}>
            <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:22,color:'white',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",fontWeight:'normal',fontStyle:'normal',lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',userSelect:'none'}}>menu</span>
          </button>
          <BotaoVoltar />
          <HeaderTitle />
          <BotaoConfig />
          <button onClick={()=>{ try { if ('Notification' in window && Notification.permission==='default') Notification.requestPermission().then(p=>{ if(p==='granted' && profile?.user_id) ativarPush(profile.user_id) }) } catch {} ; setNotifOpen(true) }} style={{background:'none',border:'none',cursor:'pointer',color:'white',display:'flex',alignItems:'center',justifyContent:'center',width:36,height:36,borderRadius:8,fontFamily:'inherit',position:'relative'}}>
            <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:22,color:'white',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",fontWeight:'normal',fontStyle:'normal',lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',userSelect:'none'}}>notifications</span>
            {notifUnread > 0 && (
              <span style={{position:'absolute',top:2,right:2,minWidth:16,height:16,background:'#E53E3E',borderRadius:99,fontSize:10,fontWeight:800,color:'white',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px',border:'2px solid var(--primary)'}}>{notifUnread}</span>
            )}
          </button>
          <button onClick={()=>window.location.href='/perfil'} style={{background:'rgba(255,255,255,0.2)',border:'none',cursor:'pointer',borderRadius:'50%',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',fontFamily:'inherit'}}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : <span style={{fontSize:13,fontWeight:700,color:'white'}}>{(profile.full_name??'?').split(' ').map((n:string)=>n[0]).slice(0,2).join('')}</span>
            }
          </button>
        </header>

        {/* Main content — scroller principal (sem transform: senao FAB/modais position:fixed grudam no main em vez da tela) */}
        <main style={{flex:1,overflowY:'auto',position:'relative',WebkitOverflowScrolling:'touch'}}>
          <CriticoWatcher profile={profile} />
          <ParabensAniversario profile={profile} />
          <div style={{paddingTop:12}}><AtivarNotificacoes profile={profile} /></div>
          <AppRoutes profile={profile} onProfileUpdate={()=>loadProfile(profile.user_id)} versaoFotos={versaoFotos} />
          {/* #2 — Botão de instalar SEMPRE no final de tudo (aparece sozinho quando dá pra instalar) */}
          <div style={{padding:'0 16px 24px'}}><InstallPWA autoShow /></div>
        </main>

        {/* #6 — Central de notificações */}
        {notifOpen && <NotificacoesCenter profile={profile} onClose={()=>setNotifOpen(false)} onUnread={setNotifUnread} />}

        {/* Drawer overlay */}
        {menuOpen && (
          <>
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200}} onClick={()=>setMenuOpen(false)}/>
            <div style={{position:'fixed',top:0,left:0,bottom:0,width:280,zIndex:201,boxShadow:'4px 0 20px rgba(0,0,0,0.2)'}}>
              <Nav profile={profile} onClose={()=>setMenuOpen(false)}/>
            </div>
          </>
        )}

        <CriticalAlert profile={profile}/>
        <ToastHost />
      </div>
     </ChromeProvider>
    </BrowserRouter>
  )
}
