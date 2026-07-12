import { useEffect, useState } from 'react'
import { confirmar } from '../components/Confirmar'
import { supabase } from '../lib/supabase'
import { useRegistrarChromeAdmin } from '../lib/chrome'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { isAdmin } from '../utils'
import type { Profile } from '../App'

type Orfao = { categoria:string; tabela:string; quantidade:number }
type Removido = { categoria:string; tabela:string; removidos:number }

type Limites = {
  limite_arquivos_gb: number
  limite_uso_mensal: number
  limite_usuarios: number
  uso_mensal_atual: number
}

export default function SaudeSistema({ profile }: { profile?: Profile }) {
  useRegistrarChromeAdmin()
  const [limites, setLimites] = useState<Limites>({ limite_arquivos_gb:4, limite_uso_mensal:100, limite_usuarios:100, uso_mensal_atual:0 })
  const [arquivosGb, setArquivosGb] = useState(0)
  const [usuariosAtivos, setUsuariosAtivos] = useState(0)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [ok, setOk] = useState('')
  const [erro, setErro] = useState('')

  const admin = isAdmin(profile?.user_role) || profile?.is_admin

  // Faxina de dados mortos (registros órfãos)
  const [limpezaOpen, setLimpezaOpen] = useState(false)
  const [orfaos, setOrfaos] = useState<Orfao[]>([])
  const [analisando, setAnalisando] = useState(false)
  const [limpando, setLimpando] = useState(false)
  const [resultado, setResultado] = useState<Removido[]|null>(null)
  const [erroLimpeza, setErroLimpeza] = useState('')
  useVoltarFecha(limpezaOpen, () => setLimpezaOpen(false))

  async function abrirLimpeza() {
    setLimpezaOpen(true); setResultado(null); setErroLimpeza(''); setOrfaos([]); setAnalisando(true)
    const { data, error } = await supabase.rpc('analisar_orfaos')
    setAnalisando(false)
    if (error) { setErroLimpeza(error.message); return }
    setOrfaos((data as any) ?? [])
  }
  async function limparAgora() {
    const total = orfaos.reduce((s,o)=>s+o.quantidade,0)
    if (!total) return
    if (!(await confirmar({ titulo: `Apagar ${total} registro(s) morto(s)?`, mensagem: 'Remove SÓ o que aponta pra algo que não existe mais. Dados vivos não são tocados. Não dá pra desfazer.', confirmar: 'Apagar', perigo: true }))) return
    setLimpando(true); setErroLimpeza('')
    const { data, error } = await supabase.rpc('limpar_orfaos')
    setLimpando(false)
    if (error) { setErroLimpeza(error.message); return }
    setResultado((data as any) ?? [])
    const { data: d2 } = await supabase.rpc('analisar_orfaos')
    setOrfaos((d2 as any) ?? [])
  }

  useEffect(() => { if (admin) carregar() }, [])

  async function carregar() {
    setLoading(true)
    // Limites manuais
    const { data: lim } = await supabase.from('saude_sistema_limites').select('*').eq('id',1).maybeSingle()
    if (lim) setLimites(lim)

    // MEDIÇÃO REAL — Espaço de arquivos: soma tamanho dos arquivos registrados
    let totalBytes = 0
    const [corr, mods] = await Promise.all([
      supabase.from('correio_arquivos').select('tamanho'),
      supabase.from('arquivos_modulo').select('tamanho'),
    ])
    ;(corr.data ?? []).forEach(a => totalBytes += (a.tamanho ?? 0))
    ;(mods.data ?? []).forEach(a => totalBytes += (a.tamanho ?? 0))
    setArquivosGb(totalBytes / (1024*1024*1024))

    // MEDIÇÃO REAL — Pessoas usando: usuários com conta (user_id preenchido)
    const { count } = await supabase.from('people').select('id',{count:'exact',head:true}).not('user_id','is',null)
    setUsuariosAtivos(count ?? 0)

    setLoading(false)
  }

  async function salvarLimites() {
    setSalvando(true); setOk(''); setErro('')
    // upsert (não update): grava mesmo que a linha id=1 ainda não exista.
    const { error } = await supabase.from('saude_sistema_limites').upsert({
      id: 1,
      limite_arquivos_gb: limites.limite_arquivos_gb,
      limite_uso_mensal: limites.limite_uso_mensal,
      limite_usuarios: limites.limite_usuarios,
      uso_mensal_atual: limites.uso_mensal_atual,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    setSalvando(false)
    if (error) { setErro('Não foi possível salvar: ' + error.message); return }
    setOk('Limites salvos!')
    setTimeout(()=>setOk(''), 2500)
  }

  if (!admin) return <div className="page"><div className="empty"><p className="empty-title">Acesso restrito</p><p className="empty-sub">Apenas administradores.</p></div></div>
  if (loading) return <div className="page">{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:90,marginBottom:12,borderRadius:14}}/>)}</div>

  const pctArquivos = limites.limite_arquivos_gb>0 ? Math.round((arquivosGb/limites.limite_arquivos_gb)*100) : 0
  const pctUso      = limites.limite_uso_mensal>0 ? Math.round((limites.uso_mensal_atual/limites.limite_uso_mensal)*100) : 0
  const pctUsuarios = limites.limite_usuarios>0 ? Math.round((usuariosAtivos/limites.limite_usuarios)*100) : 0
  const maiorPct = Math.max(pctArquivos, pctUso, pctUsuarios)
  const statusVerde = maiorPct < 95

  return (
    <div className="page slide-up">
      {/* Status geral */}
      <div style={{background: statusVerde?'var(--success)':'#D69E2E', borderRadius:16, padding:'18px 20px', marginBottom:16, color:'white', boxShadow:'0 4px 14px rgba(0,0,0,0.15)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span className="icon" style={{fontSize:32,color:'white'}}>{statusVerde?'check_circle':'warning'}</span>
          <div>
            <p style={{fontSize:16,fontWeight:800}}>{statusVerde?'Sistema saudável':'Atenção: próximo do limite'}</p>
            <p style={{fontSize:12,opacity:0.9}}>{statusVerde?'Tudo funcionando com folga.':'Ainda está seguro, mas perto do limite. Nada foi bloqueado.'}</p>
          </div>
        </div>
      </div>

      <Medidor titulo="Espaço de Arquivos" descricao={`${arquivosGb.toFixed(2)} GB de ${limites.limite_arquivos_gb} GB`} pct={pctArquivos} />
      <Medidor titulo="Uso do Sistema no Mês" descricao={`${limites.uso_mensal_atual} de ${limites.limite_uso_mensal} (${pctUso}%)`} pct={pctUso} />
      <Medidor titulo="Pessoas Usando o App" descricao={`${usuariosAtivos} de ${limites.limite_usuarios} permitidos`} pct={pctUsuarios} />

      {/* Faxina de dados mortos */}
      <button onClick={abrirLimpeza} style={{width:'100%',display:'flex',alignItems:'center',gap:12,background:'white',border:'1px solid var(--border)',borderRadius:14,padding:'16px 18px',marginBottom:12,cursor:'pointer',fontFamily:'inherit',textAlign:'left',boxShadow:'var(--shadow-sm)'}}>
        <span style={{fontSize:26,flexShrink:0}}>🧹</span>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:15,fontWeight:800}}>Limpeza do sistema</p>
          <p style={{fontSize:12,color:'var(--muted)',marginTop:2}}>Procura dados mortos (sobras de exclusões) e remove com segurança</p>
        </div>
        <span className="icon" style={{color:'var(--muted)',flexShrink:0}}>chevron_right</span>
      </button>

      {/* Configurar limites manuais */}
      <div style={{background:'white',borderRadius:14,padding:'16px 18px',marginTop:8,boxShadow:'var(--shadow-sm)'}}>
        <p style={{fontSize:13,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Definir limites</p>
        <p style={{fontSize:11,color:'var(--muted)',marginBottom:14}}>Veja os limites no painel do Supabase e digite aqui. O sistema mede o uso real automaticamente.</p>

        <Campo label="Limite de arquivos (GB)" value={limites.limite_arquivos_gb} onChange={v=>setLimites(l=>({...l,limite_arquivos_gb:v}))} />
        <Campo label="Limite de uso mensal" value={limites.limite_uso_mensal} onChange={v=>setLimites(l=>({...l,limite_uso_mensal:v}))} />
        <Campo label="Uso mensal atual (do painel)" value={limites.uso_mensal_atual} onChange={v=>setLimites(l=>({...l,uso_mensal_atual:v}))} />
        <Campo label="Limite de usuários" value={limites.limite_usuarios} onChange={v=>setLimites(l=>({...l,limite_usuarios:v}))} />

        <button className="btn btn-primary btn-full" onClick={salvarLimites} disabled={salvando} style={{marginTop:8}}>{salvando?'Salvando...':'Salvar limites'}</button>
        {ok && <p style={{fontSize:12,color:'var(--success)',fontWeight:700,textAlign:'center',marginTop:8}}>{ok}</p>}
        {erro && <p style={{fontSize:12,color:'var(--danger)',fontWeight:700,textAlign:'center',marginTop:8}}>{erro}</p>}
      </div>

      {limpezaOpen && (() => {
        const total = orfaos.reduce((s,o)=>s+o.quantidade,0)
        const totalRemovido = (resultado ?? []).reduce((s,o)=>s+o.removidos,0)
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setLimpezaOpen(false)}>
            <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 28px',maxWidth:480,width:'100%',margin:'0 auto',maxHeight:'86vh',overflowY:'auto'}}>
              <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 14px'}}/>
              <p style={{fontSize:18,fontWeight:800,marginBottom:4}}>🧹 Limpeza do sistema</p>
              <p style={{fontSize:12,color:'var(--muted)',marginBottom:16}}>Só remove o que aponta pra algo que <b>não existe mais</b> (sobra de exclusão). Dados vivos nunca são tocados.</p>

              {analisando ? (
                <div style={{textAlign:'center',padding:'28px 0'}}><p style={{fontSize:14,color:'var(--muted)'}}>Procurando dados mortos…</p></div>
              ) : erroLimpeza ? (
                <div style={{background:'var(--danger-bg)',borderRadius:10,padding:'12px 14px',marginBottom:14}}>
                  <p style={{fontSize:13,fontWeight:700,color:'var(--danger)'}}>Não deu certo</p>
                  <p style={{fontSize:12,color:'var(--text2)',marginTop:2}}>{erroLimpeza}</p>
                  <p style={{fontSize:11,color:'var(--muted)',marginTop:6}}>Rodou o <b>sql/64_limpeza_sistema.sql</b> no Supabase? Ele cria essa função.</p>
                </div>
              ) : resultado ? (
                <div style={{background:'var(--success-bg)',borderRadius:12,padding:'16px',textAlign:'center',marginBottom:8}}>
                  <p style={{fontSize:34,marginBottom:6}}>✨</p>
                  <p style={{fontSize:16,fontWeight:800,color:'var(--success)'}}>{totalRemovido>0?`${totalRemovido} registro(s) morto(s) removido(s)!`:'Nada pra remover'}</p>
                  {resultado.length>0 && <div style={{marginTop:12,textAlign:'left'}}>{resultado.map((r,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'4px 0'}}><span>{r.categoria}</span><b style={{color:'var(--success)'}}>{r.removidos}</b></div>
                  ))}</div>}
                  <p style={{fontSize:12,color:'var(--muted)',marginTop:12}}>{total>0?`Ainda restam ${total} — rode de novo se quiser.`:'Sistema limpo. 👍'}</p>
                </div>
              ) : total === 0 ? (
                <div style={{textAlign:'center',padding:'26px 0'}}>
                  <p style={{fontSize:34,marginBottom:8}}>✅</p>
                  <p style={{fontSize:15,fontWeight:700}}>Nenhum dado morto encontrado</p>
                  <p style={{fontSize:13,color:'var(--muted)',marginTop:4}}>Está tudo limpo.</p>
                </div>
              ) : (
                <>
                  <div style={{background:'var(--warning-bg,#FFFBEB)',border:'1px solid #F6E05E',borderRadius:10,padding:'10px 14px',marginBottom:12}}>
                    <p style={{fontSize:14,fontWeight:800,color:'#B7791F'}}>{total} registro(s) morto(s) encontrado(s)</p>
                  </div>
                  {orfaos.map((o,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 4px',borderBottom:'1px solid var(--border)'}}>
                      <div style={{minWidth:0,paddingRight:10}}>
                        <p style={{fontSize:14,fontWeight:600}}>{o.categoria}</p>
                        <p style={{fontSize:11,color:'var(--muted)'}}>tabela: {o.tabela}</p>
                      </div>
                      <span style={{flexShrink:0,fontSize:15,fontWeight:800,color:'#E8821A',background:'#FFF7ED',borderRadius:8,padding:'4px 10px'}}>{o.quantidade}</span>
                    </div>
                  ))}
                  <button onClick={limparAgora} disabled={limpando} style={{width:'100%',marginTop:16,background:'var(--danger)',color:'white',border:'none',borderRadius:12,padding:'14px',fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
                    {limpando ? 'Limpando…' : `🧹 Limpar ${total} registro(s) morto(s)`}
                  </button>
                </>
              )}
              <button className="btn btn-ghost btn-full" style={{marginTop:10}} onClick={()=>setLimpezaOpen(false)}>Fechar</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function Medidor({ titulo, descricao, pct }: { titulo:string; descricao:string; pct:number }) {
  const alerta = pct >= 95
  const cor = alerta ? '#D69E2E' : 'var(--primary)'
  return (
    <div style={{background:'white',borderRadius:14,padding:'14px 18px',marginBottom:12,boxShadow:'var(--shadow-sm)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <p style={{fontSize:14,fontWeight:700}}>{titulo}</p>
        <p style={{fontSize:15,fontWeight:800,color:cor}}>{pct}%</p>
      </div>
      <div style={{height:12,background:'var(--bg)',borderRadius:99,overflow:'hidden',marginBottom:6}}>
        <div style={{height:'100%',width:`${Math.min(100,pct)}%`,background:cor,borderRadius:99,transition:'width 0.5s ease'}}/>
      </div>
      <p style={{fontSize:12,color:'var(--muted)'}}>{descricao}</p>
      {alerta && <p style={{fontSize:11,color:'#D69E2E',fontWeight:700,marginTop:4}}>⚠️ Atenção: o sistema ainda está seguro, mas está próximo do limite.</p>}
    </div>
  )
}

function Campo({ label, value, onChange }: { label:string; value:number; onChange:(v:number)=>void }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type="number" value={value} onChange={e=>onChange(Number(e.target.value))} />
    </div>
  )
}
