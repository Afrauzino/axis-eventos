import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { carregarCorSalva } from './lib/tema'
import { formatName } from './utils'
import Nav from './components/Nav'
import CriticalAlert from './components/CriticalAlert'
import Login from './pages/Login'
import Pending from './pages/Pending'
import Dashboard from './pages/Dashboard'
import MinhasAtividades from './pages/MinhasAtividades'
import Cronograma from './pages/Cronograma'
import Encontristas from './pages/Encontristas'
import Cadastros from './pages/Cadastros'
import Equipes from './pages/Equipes'
import Correio from './pages/Correio'
import SaudeSistema from './pages/SaudeSistema'
import AlertasLideres from './pages/AlertasLideres'
import Cozinha from './pages/Cozinha'
import CriticoWatcher from './components/CriticoWatcher'
import Ministracoes from './pages/Ministracoes'
import Logistica from './pages/Logistica'
import Midia from './pages/Midia'
import Cracha from './pages/Cracha'
import TeatroLista from './pages/TeatroLista'
import TeatroDetalhe from './pages/TeatroDetalhe'
import TeatroAtores from './pages/TeatroAtores'
import TeatroObjetos from './pages/TeatroObjetos'
import TeatroPersonagens from './pages/TeatroPersonagens'
import Locais from './pages/Locais'
import Saude from './pages/Saude'
import SaudeFicha from './pages/SaudeFicha'
import Medicamentos from './pages/Medicamentos'
import SaudeConfig from './pages/SaudeConfig'
import Alertas from './pages/Alertas'
import Ocorrencias from './pages/Ocorrencias'
import Financeiro from './pages/Financeiro'
import Escalas from './pages/Escalas'
import Relatorios from './pages/Relatorios'
import Doacoes from './pages/Doacoes'
import MenusAdmin from './pages/MenusAdmin'
import Ranking from './pages/Ranking'
import PermissoesAdmin from './pages/PermissoesAdmin'
import Admin from './pages/Admin'
import Perfil from './pages/Perfil'

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

function AppRoutes({ profile, onProfileUpdate }: { profile: Profile; onProfileUpdate: () => void }) {
  return (
    <Routes>
      <Route path="/"                      element={<Dashboard profile={profile} />} />
      <Route path="/minhas-atividades"     element={<MinhasAtividades profile={profile} />} />
      <Route path="/cronograma"            element={<Cronograma profile={profile} />} />
      <Route path="/encontristas"          element={<Encontristas profile={profile} />} />
      <Route path="/cadastros"             element={<Cadastros profile={profile} />} />
      <Route path="/equipes"               element={<Equipes profile={profile} />} />
      <Route path="/correio"               element={<Correio profile={profile} />} />
      <Route path="/logistica"             element={<Logistica profile={profile} />} />
      <Route path="/midia"                 element={<Midia profile={profile} />} />
      <Route path="/cracha"                element={<Cracha profile={profile} />} />
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
      <Route path="/ranking"               element={<Ranking profile={profile} />} />
      <Route path="/admin/permissoes"      element={<PermissoesAdmin profile={profile} />} />
      <Route path="/admin"                 element={<Admin profile={profile} />} />
      <Route path="/perfil"                element={<Perfil profile={profile} onUpdate={onProfileUpdate} />} />
      <Route path="*"                      element={<Navigate to="/" replace />} />
    </Routes>
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
  '/relatorios': 'Relatórios',
  '/locais': 'Locais',
  '/admin': 'Administração',
  '/admin/menus': 'Administração',
  '/admin/permissoes': 'Permissões',
  '/correio': 'Correio',
  '/logistica': 'Logística',
  '/midia': 'Mídia',
  '/cracha': 'Crachá',
  '/admin/saude-sistema': 'Saúde do Sistema',
  '/alertas-lideres': 'Alertas',
  '/cozinha': 'Cozinha',
}
function HeaderTitle() {
  const loc = useLocation()
  const titulo = TITULOS_ROTA[loc.pathname] ?? 'AXIS Eventos'
  return <span style={{flex:1,fontSize:16,fontWeight:700,color:'white'}}>{titulo}</span>
}

export default function App() {
  const [session, setSession]   = useState<any>(null)
  const [profile, setProfile]   = useState<Profile|null>(null)
  const [loading, setLoading]   = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    carregarCorSalva()
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
  if (profile.role_status === 'pending' || profile.role_status === 'rejected' || profile.user_role === 'visitante') return <Pending profile={profile}/>

  return (
    <BrowserRouter>
      <div className="app-root">
        {/* Header */}
        <header style={{height:56,background:'var(--primary)',display:'flex',alignItems:'center',padding:'0 16px',gap:12,flexShrink:0,zIndex:100,boxShadow:'0 2px 8px rgba(0,169,157,0.2)'}}>
          <button onClick={()=>setMenuOpen(true)} style={{background:'none',border:'none',cursor:'pointer',color:'white',display:'flex',alignItems:'center',justifyContent:'center',width:36,height:36,borderRadius:8,fontFamily:'inherit'}}>
            <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:22,color:'white',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",fontWeight:'normal',fontStyle:'normal',lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',userSelect:'none'}}>menu</span>
          </button>
          <HeaderTitle />
          <button onClick={()=>window.location.href = pendingCount>0 ? '/admin' : '/alertas-lideres'} style={{background:'none',border:'none',cursor:'pointer',color:'white',display:'flex',alignItems:'center',justifyContent:'center',width:36,height:36,borderRadius:8,fontFamily:'inherit',position:'relative'}}>
            <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:22,color:'white',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",fontWeight:'normal',fontStyle:'normal',lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',userSelect:'none'}}>notifications</span>
            {(pendingCount+alertCount) > 0 && (
              <span style={{position:'absolute',top:2,right:2,minWidth:16,height:16,background:'#E53E3E',borderRadius:99,fontSize:10,fontWeight:800,color:'white',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px',border:'2px solid var(--primary)'}}>{pendingCount+alertCount}</span>
            )}
          </button>
          <button onClick={()=>window.location.href='/perfil'} style={{background:'rgba(255,255,255,0.2)',border:'none',cursor:'pointer',borderRadius:'50%',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',fontFamily:'inherit'}}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : <span style={{fontSize:13,fontWeight:700,color:'white'}}>{(profile.full_name??'?').split(' ').map((n:string)=>n[0]).slice(0,2).join('')}</span>
            }
          </button>
        </header>

        {/* Main content */}
        <main style={{flex:1,overflowY:'auto',position:'relative'}}>
          <CriticoWatcher profile={profile} />
          <AppRoutes profile={profile} onProfileUpdate={()=>loadProfile(profile.user_id)} />
        </main>

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
      </div>
    </BrowserRouter>
  )
}
