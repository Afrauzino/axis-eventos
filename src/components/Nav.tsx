import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getInitials, isAdmin } from '../utils'
import { usePermissao } from '../hooks/usePermissao'
import { supabase } from '../lib/supabase'
import type { Profile } from '../App'

type Override = { emoji?:string|null; label?:string|null; visivel?:boolean; ordem?:number|null }

type Sub = { label:string; rota:string }
type Item = { id:string; label:string; icon:string; emoji?:string; rota?:string; sub?:Sub[]; perm:string; cfg?:string }

function buildMenu(): Item[] {
  return [
    { id:'dash',    label:'Início',             icon:'home',            emoji:'🏠', rota:'/',                  perm:'menu_inicio'},
    { id:'ativ',    label:'Minhas Atividades',   icon:'checklist',       emoji:'✅', rota:'/minhas-atividades', perm:'menu_atividades'},
    { id:'cron',    label:'Cronograma',           icon:'calendar_month',  emoji:'📅', rota:'/cronograma',        perm:'menu_cronograma'},
    { id:'enc',     label:'Encontristas',         icon:'groups',          emoji:'👥', rota:'/encontristas',      perm:'menu_encontristas' },
    { id:'cad',     label:'Cadastros',            icon:'manage_accounts', emoji:'📝', rota:'/cadastros',         perm:'menu_cadastros' },
    { id:'min',     label:'Ministrações',         icon:'church',          emoji:'🎤', rota:'/ministracoes',      perm:'menu_ministracoes' },
    { id:'ranking', label:'Ranking',              icon:'leaderboard',     emoji:'🏆', rota:'/ranking',           perm:'menu_ranking' },
    { id:'correio', label:'Correio',              icon:'mail',            emoji:'📬', rota:'/correio',           perm:'menu_correio' },
    { id:'logistica',label:'Logística',           icon:'inventory',       emoji:'📦', rota:'/logistica',         perm:'menu_logistica' },
    { id:'midia',   label:'Mídia',                icon:'perm_media',      emoji:'🎬', rota:'/midia',             perm:'menu_midia' },
    { id:'impressao',label:'Impressão',           icon:'print',           emoji:'🖨️', rota:'/impressao',         perm:'menu_impressao' },
    { id:'alertlid',label:'Alertas',                icon:'campaign',       emoji:'📢', rota:'/alertas-lideres',   perm:'menu_alertas_lideres' },
    { id:'cozinha', label:'Cozinha',              icon:'restaurant',     emoji:'🍴', rota:'/cozinha',           perm:'menu_cozinha' },
    { id:'equipes', label:'Equipes',              icon:'shield',          emoji:'🛡️', rota:'/equipes',  perm:'menu_equipes' },
    { id:'escalas', label:'Escalas',              icon:'event_note',      emoji:'🗓️', rota:'/escalas',  perm:'menu_equipes', cfg:'menu_escalas' },
    { id:'teatro',  label:'Teatro',               icon:'theater_comedy',  emoji:'🎭', perm:'menu_teatro',
      sub:[ { label:'Teatros', rota:'/teatro' }, { label:'Atores', rota:'/teatro/atores' }, { label:'Personagens', rota:'/teatro/personagens' }, { label:'Objetos', rota:'/teatro/objetos' } ] },
    { id:'evento',  label:'Evento',               icon:'event',           emoji:'📍', perm:'menu_evento',
      sub:[ { label:'Locais', rota:'/locais' }, { label:'Ocorrências', rota:'/ocorrencias' } ] },
    { id:'saude',   label:'Saúde',                icon:'medical_services', emoji:'⚕️', perm:'menu_saude',
      sub:[ { label:'Medicamentos', rota:'/saude/medicamentos' }, { label:'Atendimentos', rota:'/saude' }, { label:'Fichas Médicas', rota:'/saude/ficha' } ] },
    { id:'fin',     label:'Financeiro',           icon:'account_balance_wallet', emoji:'💰', perm:'menu_financeiro',
      sub:[ { label:'Pagamentos', rota:'/financeiro' }, { label:'Doações', rota:'/doacoes' } ] },
    { id:'admin',   label:'Administração',        icon:'admin_panel_settings', emoji:'⚙️', perm:'menu_admin',
      sub:[ { label:'Usuários', rota:'/admin' }, { label:'Menus', rota:'/admin/menus' }, { label:'Notificações', rota:'/admin/notificacoes' }, { label:'Saúde do Sistema', rota:'/admin/saude-sistema' }, { label:'Relatórios', rota:'/relatorios' } ] },
  ]
}

export default function Nav({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { pode, carregado } = usePermissao(profile)
  const admin = isAdmin(profile.user_role) || profile.is_admin

  // Personalização do menu (emoji/nome/ordem/visível) vinda de menu_config.
  // Fallback seguro: se não carregar, usa os padrões do código.
  const [ovr, setOvr] = useState<Record<string, Override>>({})
  useEffect(() => {
    let ativo = true
    supabase.from('menu_config').select('key,label,emoji,visivel,ordem').then(({ data }) => {
      if (!ativo || !data) return
      const m: Record<string, Override> = {}
      data.forEach((r:any) => { m[r.key] = { emoji:r.emoji, label:r.label, visivel:r.visivel, ordem:r.ordem } })
      setOvr(m)
    })
    return () => { ativo = false }
  }, [])

  // cada menu só aparece se admin OU a permissão liberar; menu_config pode ocultar/renomear/reordenar
  const menu = buildMenu()
    .filter(item => admin || pode(item.perm))
    .filter(item => ovr[item.cfg ?? item.perm]?.visivel !== false)
    .map(item => {
      const o = ovr[item.cfg ?? item.perm]
      return o ? { ...item, emoji:o.emoji || item.emoji, label:o.label || item.label, _ordem:o.ordem ?? undefined } : item
    })
    .sort((a:any, b:any) => (a._ordem ?? 999) - (b._ordem ?? 999))

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  function navegar(rota: string) {
    onClose()
    // MENU = recomeço: abrir uma tela pelo menu faz o "voltar" ir pra Início (não pra tela anterior).
    // Links DENTRO do app continuam empurrando normal (voltar volta pra tela de origem).
    if (rota === '/') { navigate('/'); return }
    navigate('/', { replace: true })  // troca a tela atual pela Início no histórico
    navigate(rota)                    // e abre a escolhida por cima → voltar vai pra Início
  }

  function ativo(item: Item): boolean {
    if (item.rota) return location.pathname === item.rota
    return item.sub?.some(s => location.pathname.startsWith(s.rota)) ?? false
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'white'}}>
      {/* Header do menu */}
      <div style={{padding:'24px 20px 16px',background:'var(--primary-dark)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'2px solid rgba(255,255,255,0.3)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : <span style={{fontSize:16,fontWeight:700,color:'white'}}>{getInitials(profile.full_name??'?')}</span>
            }
          </div>
          <div>
            <p style={{fontSize:14,fontWeight:700,color:'white',lineHeight:1.2}}>{profile.full_name?.split(' ').slice(0,2).join(' ')}</p>
            <p style={{fontSize:11,color:'rgba(255,255,255,0.75)',marginTop:2,textTransform:'capitalize'}}>{profile.user_role}</p>
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div style={{flex:1,overflowY:'auto',padding:'8px 0',background:'white'}}>
        {menu.map(item => {
          const at = ativo(item)
          return (
          <div key={item.id}>
            <button
              onClick={()=>navegar(item.rota ?? item.sub![0].rota)}
              style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 20px',background:at?'var(--primary-light)':'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left',borderLeft:at?'3px solid var(--primary)':'3px solid transparent',transition:'all 0.15s'}}
            >
              <span style={{fontSize:20,width:24,textAlign:'center',flexShrink:0}}>{item.emoji}</span>
              <span style={{flex:1,fontSize:14,fontWeight:at?700:500,color:at?'var(--primary-dark)':'var(--text)'}}>{item.label}</span>
              {item.sub && <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:18,color:'var(--muted)',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",lineHeight:1,display:'inline-block',userSelect:'none'}}>chevron_right</span>}
            </button>
          </div>
          )
        })}
      </div>

      {/* Perfil e logout */}
      <div style={{borderTop:'1px solid var(--border)',padding:'8px 0',background:'white'}}>
        <button onClick={()=>navegar('/perfil')} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 20px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
          <span style={{fontSize:20,width:24,textAlign:'center'}}>👤</span>
          <span style={{fontSize:14,color:'var(--text)',fontWeight:500}}>Meu Perfil</span>
        </button>
        <button onClick={logout} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'10px 20px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
          <span style={{fontSize:20,width:24,textAlign:'center'}}>🚪</span>
          <span style={{fontSize:14,color:'var(--danger)',fontWeight:600}}>Sair</span>
        </button>
      </div>
    </div>
  )
}
