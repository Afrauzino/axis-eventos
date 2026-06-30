import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getInitials, isAdmin } from '../utils'
import { usePermissao } from '../hooks/usePermissao'
import { supabase } from '../lib/supabase'
import type { Profile } from '../App'

type Sub = { label:string; rota:string }
type Item = { id:string; label:string; icon:string; rota?:string; sub?:Sub[]; perm:string }

function buildMenu(): Item[] {
  return [
    { id:'dash',    label:'Início',             icon:'home',            rota:'/',                  perm:'menu_inicio'},
    { id:'ativ',    label:'Minhas Atividades',   icon:'checklist',       rota:'/minhas-atividades', perm:'menu_atividades'},
    { id:'cron',    label:'Cronograma',           icon:'calendar_month',  rota:'/cronograma',        perm:'menu_cronograma'},
    { id:'enc',     label:'Encontristas',         icon:'groups',          rota:'/encontristas',      perm:'menu_encontristas' },
    { id:'cad',     label:'Cadastros',            icon:'manage_accounts', rota:'/cadastros',         perm:'menu_cadastros' },
    { id:'min',     label:'Ministrações',         icon:'church',          rota:'/ministracoes',      perm:'menu_ministracoes' },
    { id:'ranking', label:'Ranking',              icon:'leaderboard',     rota:'/ranking',           perm:'menu_ranking' },
    { id:'correio', label:'Correio',              icon:'mail',            rota:'/correio',           perm:'menu_correio' },
    { id:'alertlid',label:'Alertas',                icon:'campaign',       rota:'/alertas-lideres',   perm:'menu_alertas_lideres' },
    { id:'cozinha', label:'Cozinha',              icon:'restaurant',     rota:'/cozinha',           perm:'menu_cozinha' },
    { id:'equipes', label:'Equipes & Escalas',    icon:'shield',          perm:'menu_equipes',
      sub:[ { label:'Equipes', rota:'/equipes' }, { label:'Escalas', rota:'/escalas' } ] },
    { id:'teatro',  label:'Teatro',               icon:'theater_comedy',  perm:'menu_teatro',
      sub:[ { label:'Teatros', rota:'/teatro' }, { label:'Atores', rota:'/teatro/atores' }, { label:'Personagens', rota:'/teatro/personagens' }, { label:'Objetos', rota:'/teatro/objetos' } ] },
    { id:'evento',  label:'Evento',               icon:'event',           perm:'menu_evento',
      sub:[ { label:'Locais', rota:'/locais' }, { label:'Ocorrências', rota:'/ocorrencias' } ] },
    { id:'saude',   label:'Saúde',                icon:'medical_services', perm:'menu_saude',
      sub:[ { label:'Atendimentos', rota:'/saude' }, { label:'Fichas Médicas', rota:'/saude/ficha' }, { label:'Medicamentos', rota:'/saude/medicamentos' } ] },
    { id:'fin',     label:'Financeiro',           icon:'account_balance_wallet', perm:'menu_financeiro',
      sub:[ { label:'Pagamentos', rota:'/financeiro' }, { label:'Doações', rota:'/doacoes' } ] },
    { id:'admin',   label:'Administração',        icon:'admin_panel_settings', perm:'menu_admin',
      sub:[ { label:'Usuários', rota:'/admin' }, { label:'Menus', rota:'/admin/menus' }, { label:'Saúde do Sistema', rota:'/admin/saude-sistema' }, { label:'Relatórios', rota:'/relatorios' } ] },
  ]
}

export default function Nav({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [aberto, setAberto]   = useState<string|null>(null)
  const { pode, carregado } = usePermissao(profile)
  const admin = isAdmin(profile.user_role) || profile.is_admin
  // Opção B: cada menu só aparece se admin OU se a permissão (equipe/individual) liberar
  const menu = buildMenu().filter(item => admin || pode(item.perm))

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  function navegar(rota: string) {
    navigate(rota)
    onClose()
  }

  function ativo(item: Item): boolean {
    if (item.rota) return location.pathname === item.rota
    return item.sub?.some(s => location.pathname.startsWith(s.rota)) ?? false
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#00635C'}}>
      {/* Header do menu */}
      <div style={{padding:'24px 20px 16px',borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'2px solid rgba(255,255,255,0.3)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : <span style={{fontSize:16,fontWeight:700,color:'white'}}>{getInitials(profile.full_name??'?')}</span>
            }
          </div>
          <div>
            <p style={{fontSize:14,fontWeight:700,color:'white',lineHeight:1.2}}>{profile.full_name?.split(' ').slice(0,2).join(' ')}</p>
            <p style={{fontSize:11,color:'rgba(255,255,255,0.65)',marginTop:2,textTransform:'capitalize'}}>{profile.user_role}</p>
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
        {menu.map(item => (
          <div key={item.id}>
            {item.rota ? (
              <button
                onClick={()=>navegar(item.rota!)}
                style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 20px',background:ativo(item)?'rgba(255,255,255,0.15)':'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left',borderLeft:ativo(item)?'3px solid white':'3px solid transparent',transition:'all 0.15s'}}
              >
                <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:20,color:'rgba(255,255,255,0.85)',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",fontWeight:'normal',fontStyle:'normal',lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',direction:'ltr',userSelect:'none'}}>
                  {item.icon}
                </span>
                <span style={{fontSize:14,fontWeight:ativo(item)?700:400,color:'white'}}>{item.label}</span>
              </button>
            ) : (
              <>
                <button
                  onClick={()=>setAberto(aberto===item.id?null:item.id)}
                  style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 20px',background:ativo(item)?'rgba(255,255,255,0.1)':'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left',borderLeft:ativo(item)?'3px solid rgba(255,255,255,0.5)':'3px solid transparent'}}
                >
                  <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:20,color:'rgba(255,255,255,0.85)',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",fontWeight:'normal',fontStyle:'normal',lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',direction:'ltr',userSelect:'none'}}>
                    {item.icon}
                  </span>
                  <span style={{flex:1,fontSize:14,fontWeight:ativo(item)?700:400,color:'white'}}>{item.label}</span>
                  <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:16,color:'rgba(255,255,255,0.5)',transform:aberto===item.id?'rotate(180deg)':'none',transition:'transform 0.2s',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",fontWeight:'normal',fontStyle:'normal',lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',userSelect:'none'}}>
                    expand_more
                  </span>
                </button>
                {aberto===item.id && (
                  <div style={{background:'rgba(0,0,0,0.15)'}}>
                    {item.sub?.map(s=>(
                      <button key={s.rota} onClick={()=>navegar(s.rota)} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'10px 20px 10px 52px',background:location.pathname===s.rota?'rgba(255,255,255,0.12)':'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left',borderLeft:location.pathname===s.rota?'3px solid white':'3px solid transparent'}}>
                        <span style={{fontSize:13,color:location.pathname===s.rota?'white':'rgba(255,255,255,0.7)',fontWeight:location.pathname===s.rota?700:400}}>{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Perfil e logout */}
      <div style={{borderTop:'1px solid rgba(255,255,255,0.1)',padding:'8px 0'}}>
        <button onClick={()=>navegar('/perfil')} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 20px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
          <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:20,color:'rgba(255,255,255,0.7)',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",fontWeight:'normal',fontStyle:'normal',lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',userSelect:'none'}}>account_circle</span>
          <span style={{fontSize:14,color:'rgba(255,255,255,0.7)'}}>Meu Perfil</span>
        </button>
        <button onClick={logout} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'10px 20px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
          <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:20,color:'rgba(255,100,100,0.8)',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",fontWeight:'normal',fontStyle:'normal',lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',userSelect:'none'}}>logout</span>
          <span style={{fontSize:14,color:'rgba(255,100,100,0.8)',fontWeight:600}}>Sair</span>
        </button>
      </div>
    </div>
  )
}
