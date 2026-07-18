// Painel de análises (Administração) — apresentação (TV/notebook), modular
// (liga/desliga por card), tempo real (recarrega a cada 30s). Acesso: admin OU
// liberação 'painel' (ver), escolhida DENTRO desta tela. Números 100% reais.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { isAdmin, getInitials, formatName, fmtBRL, normalizarNome } from '../utils'
import { toast } from '../components/Toast'
import type { Profile } from '../App'

type Pessoa = { id:string; name:string; photo_url:string|null; role_type:string|null; user_id:string|null; created_at:string|null; birth_date:string|null }
type Team = { id:string; name:string; color:string }
type Fin = { person_id:string|null; valor:number; status:string; forma_pagamento:string|null; data_pagamento:string|null }

// Cards disponíveis (liga/desliga fica no aparelho). Agrupados por seção.
const CARDS = [
  { key:'acessos',    nome:'Acessos (online/hoje)' },
  { key:'cadastros',  nome:'Cadastros (tipos/foto)' },
  { key:'fin_kpi',    nome:'Financeiro — resumo' },
  { key:'fin_receber',nome:'Financeiro — pago × a receber' },
  { key:'fin_dia',    nome:'Financeiro — por dia' },
  { key:'fin_formas', nome:'Financeiro — formas de pagamento' },
  { key:'fin_doadores',nome:'Financeiro — maiores doadores' },
  { key:'equipes',    nome:'Escalas por equipe' },
  { key:'correio',    nome:'Correio' },
  { key:'saude',      nome:'Saúde e cozinha' },
  { key:'ocorr',      nome:'Ocorrências' },
  { key:'grafcad',    nome:'Gráfico: cadastros/dia' },
  { key:'tipos',      nome:'Gráfico: tipos' },
  { key:'fichas',     nome:'Fichas médicas' },
  { key:'aniver',     nome:'Aniversariantes no evento' },
  { key:'engaj',      nome:'Engajamento (carrossel)' },
  { key:'compare',    nome:'Comparar com evento anterior' },
]
const CHAVE_OFF = 'painel_cards_off'
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

export default function PainelAnalises({ profile }: { profile?: Profile }) {
  const nav = useNavigate()
  const { evento, loading: evLoading } = useEvento()
  const { pode, carregado } = usePermissao(profile ?? null)
  const admin = (!!profile && isAdmin(profile.user_role)) || !!profile?.is_admin
  const podeVer = admin || pode('painel','ver')

  const raizRef = useRef<HTMLDivElement>(null)
  const [cheia, setCheia] = useState(false)
  const [tvMode, setTvMode] = useState(false)
  useEffect(() => {
    const h = () => { setCheia(!!document.fullscreenElement); if (!document.fullscreenElement) setTvMode(false) }
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])
  function telaCheia() {
    const el = raizRef.current as any
    if (document.fullscreenElement) { document.exitFullscreen?.(); return }
    ;(el?.requestFullscreen || el?.webkitRequestFullscreen)?.call(el)
  }
  function modoTV() {
    if (!document.fullscreenElement) telaCheia()
    setTvMode(v => !v)
  }
  // Modo TV: rola a tela sozinha (vai e volta), pra "girar" os cards no telão.
  useEffect(() => {
    if (!cheia || !tvMode) return
    const el = raizRef.current
    if (!el) return
    let dir = 1, pausa = 0
    const id = setInterval(() => {
      if (pausa > 0) { pausa--; return }
      el.scrollTop += dir * 2
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) { dir = -1; pausa = 60 }
      else if (el.scrollTop <= 0) { dir = 1; pausa = 60 }
    }, 40)
    return () => clearInterval(id)
  }, [cheia, tvMode])

  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [lastSeen, setLastSeen] = useState<Record<string, string|null>>({})
  const [fin, setFin] = useState<Fin[]>([])
  const [doacoes, setDoacoes] = useState<{person_id:string|null;valor:number;anonima:boolean}[]>([])
  const [escalas, setEscalas] = useState<{team_id:string|null;status:string}[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [ocorr, setOcorr] = useState<{status:string;severity:string}[]>([])
  const [fichas, setFichas] = useState<any[]>([])
  const [med, setMed] = useState<{entregue:boolean}[]>([])
  const [correioChk, setCorreioChk] = useState<{concluido:boolean}[]>([])
  const [correioAfi, setCorreioAfi] = useState<{status:string}[]>([])
  const [curtidas, setCurtidas] = useState(0)
  const [comentarios, setComentarios] = useState(0)
  const [anterior, setAnterior] = useState<{name:string;cadastros:number;arrecadado:number}|null>(null)
  const [loading, setLoading] = useState(true)
  const [acessosDia, setAcessosDia] = useState<{dia:string;pessoas:number;acessos:number}[]>([])

  const [off, setOff] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem(CHAVE_OFF) || '[]')) } catch { return new Set() } })
  const [modalCards, setModalCards] = useState(false)
  const [modalAcesso, setModalAcesso] = useState(false)
  useVoltarFecha(modalCards, () => setModalCards(false))
  useVoltarFecha(modalAcesso, () => setModalAcesso(false))

  useEffect(() => { if (evLoading || !podeVer) return; carregar(); const t = setInterval(carregar, 30000); return () => clearInterval(t) }, [evento?.id, evLoading, podeVer])

  // Histórico real de acessos por dia (tabela acessos_log). Cada linha = 1 conta num dia.
  useEffect(() => {
    if (!evento?.id || !podeVer) return
    const d = new Date(); d.setDate(d.getDate() - 30); const desde = d.toISOString().slice(0, 10)
    supabase.from('acessos_log').select('dia,qtd').eq('event_id', evento.id).gte('dia', desde).then(({ data }) => {
      const map: Record<string, { pessoas: number; acessos: number }> = {}
      ;(data ?? []).forEach((r: any) => {
        if (!map[r.dia]) map[r.dia] = { pessoas: 0, acessos: 0 }
        map[r.dia].pessoas += 1
        map[r.dia].acessos += (r.qtd || 1)
      })
      setAcessosDia(Object.entries(map).map(([dia, v]) => ({ dia, ...v })).sort((a, b) => a.dia < b.dia ? -1 : 1))
    }, () => {})
  }, [evento?.id, podeVer, loading])

  async function carregar() {
    if (!evento) { setLoading(false); return }
    const eid = evento.id
    const q = (p:any) => p.then((r:any)=>r, ()=>({data:null}))  // nunca quebra por tabela ausente
    const [pe, fi, dc, es, tm, oc, fc, md, cc, ca, cu, co] = await Promise.all([
      q(supabase.from('people').select('id,name,photo_url,role_type,user_id,created_at,birth_date').eq('event_id', eid)),
      q(supabase.from('financeiro').select('person_id,valor,status,forma_pagamento,data_pagamento').eq('event_id', eid)),
      q(supabase.from('doacoes').select('person_id,valor,anonima').eq('event_id', eid)),
      q(supabase.from('escalas').select('team_id,status').eq('event_id', eid)),
      q(supabase.from('teams').select('id,name,color').eq('event_id', eid)),
      q(supabase.from('occurrences').select('status,severity').eq('event_id', eid)),
      q(supabase.from('saude_fichas').select('person_id,concluida,restricao_alimentar,alergia_medicamentos').eq('event_id', eid)),
      q(supabase.from('med_agenda').select('entregue').eq('event_id', eid)),
      q(supabase.from('correio_checklist_status').select('concluido').eq('event_id', eid)),
      q(supabase.from('correio_afiliado_status').select('status').eq('event_id', eid)),
      q(supabase.from('home_midias_curtidas').select('midia_id', { count:'exact', head:true })),
      q(supabase.from('home_midias_comentarios').select('id', { count:'exact', head:true })),
    ])
    const ps = pe.data ?? []
    setPessoas(ps)
    setFin((fi.data as any) ?? []); setDoacoes((dc.data as any) ?? []); setEscalas((es.data as any) ?? [])
    setTeams((tm.data as any) ?? []); setOcorr((oc.data as any) ?? []); setFichas((fc.data as any) ?? [])
    setMed((md.data as any) ?? []); setCorreioChk((cc.data as any) ?? []); setCorreioAfi((ca.data as any) ?? [])
    setCurtidas(cu.count ?? 0); setComentarios(co.count ?? 0)

    const uids = ps.map((p:Pessoa)=>p.user_id).filter(Boolean) as string[]
    if (uids.length) {
      const { data: pr } = await q(supabase.from('profiles').select('user_id,last_seen').in('user_id', uids))
      const map: Record<string,string|null> = {}; (pr ?? []).forEach((r:any)=>{ map[r.user_id]=r.last_seen })
      setLastSeen(map)
    }

    // Evento anterior (comparativo): o mais recente que começou antes deste.
    const meuIni = (evento as any).start_date
    if (meuIni) {
      const { data: evs } = await q(supabase.from('events').select('id,name,start_date').lt('start_date', meuIni).order('start_date',{ascending:false}).limit(1))
      const prev = (evs ?? [])[0]
      if (prev) {
        const [pc, pf] = await Promise.all([
          q(supabase.from('people').select('id',{count:'exact',head:true}).eq('event_id', prev.id)),
          q(supabase.from('financeiro').select('valor,status').eq('event_id', prev.id)),
        ])
        const arr = ((pf.data as any)??[]).filter((x:any)=>x.status==='pago').reduce((s:number,x:any)=>s+(x.valor||0),0)
        setAnterior({ name: prev.name, cadastros: pc.count ?? 0, arrecadado: arr })
      } else setAnterior(null)
    }
    setLoading(false)
  }

  function toggleCard(k: string) {
    setOff(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); try { localStorage.setItem(CHAVE_OFF, JSON.stringify([...n])) } catch {}; return n })
  }
  const mostra = (k: string) => !off.has(k)

  // ---- métricas ----
  const m = useMemo(() => {
    const valEnc = Number((evento as any)?.valor_encontrista) || 0
    const valTrab = Number((evento as any)?.valor_encontreiro) || 0
    const total = pessoas.length
    const comConta = pessoas.filter(p=>p.user_id).length
    const encontristas = pessoas.filter(p=>p.role_type==='encounterer').length
    const encontreiros = pessoas.filter(p=>p.role_type==='worker').length
    const comFoto = pessoas.filter(p=>p.photo_url).length
    const agora = Date.now(); const hojeIni = new Date(); hojeIni.setHours(0,0,0,0)
    let online = 0, hoje = 0
    for (const p of pessoas) {
      const ls = p.user_id ? lastSeen[p.user_id] : null
      if (!ls) continue
      const t = new Date(ls).getTime()
      if (agora - t < 5*60000) online++
      if (t >= hojeIni.getTime()) hoje++
    }

    // Financeiro
    const pagos = fin.filter(f=>f.status==='pago')
    const arrecadado = pagos.reduce((s,f)=>s+(f.valor||0),0)
    const pagoPorPessoa: Record<string,number> = {}
    for (const f of pagos) if (f.person_id) pagoPorPessoa[f.person_id] = (pagoPorPessoa[f.person_id]||0) + (f.valor||0)
    let aReceber = 0
    const inadimplentes: {name:string;falta:number}[] = []
    for (const p of pessoas) {
      const esperado = p.role_type==='encounterer' ? valEnc : valTrab
      if (esperado <= 0) continue
      const pg = pagoPorPessoa[p.id] || 0
      const falta = esperado - pg
      if (falta > 0.009) { aReceber += falta; inadimplentes.push({ name:p.name, falta }) }
    }
    inadimplentes.sort((a,b)=>b.falta-a.falta)
    // Formas de pagamento
    const formasMap: Record<string,number> = {}
    for (const f of pagos) { const k = f.forma_pagamento || 'outros'; formasMap[k] = (formasMap[k]||0) + (f.valor||0) }
    const formas = Object.entries(formasMap).map(([forma,valor])=>({ forma, valor, pct: arrecadado? Math.round(valor/arrecadado*100):0 })).sort((a,b)=>b.valor-a.valor)
    // Por dia (data_pagamento) — últimos dias com movimento
    const diaMap: Record<string,number> = {}
    for (const f of pagos) { const d = (f.data_pagamento||'').slice(0,10); if (d) diaMap[d] = (diaMap[d]||0) + (f.valor||0) }
    const finDias = Object.entries(diaMap).sort((a,b)=>a[0]<b[0]?-1:1).slice(-8).map(([d,v])=>({ label:`${d.slice(8,10)}/${d.slice(5,7)}`, v }))
    // Doações
    const doacoesTotal = doacoes.reduce((s,d)=>s+(d.valor||0),0)
    const doadorMap: Record<string,number> = {}
    for (const d of doacoes) if (d.person_id && !d.anonima) doadorMap[d.person_id] = (doadorMap[d.person_id]||0)+(d.valor||0)
    const nomePorId: Record<string,string> = {}; pessoas.forEach(p=>{ nomePorId[p.id]=p.name })
    const maioresDoadores = Object.entries(doadorMap).map(([id,v])=>({ name:nomePorId[id]||'—', v })).sort((a,b)=>b.v-a.v).slice(0,5)
    const doacoesAnon = doacoes.filter(d=>d.anonima).length

    // Escalas
    const escTotal = escalas.length
    const escConcl = escalas.filter(e=>e.status==='concluido').length
    const escPct = escTotal ? Math.round(escConcl/escTotal*100) : 0
    const porEq = teams.map(t => {
      const arr = escalas.filter(e=>e.team_id===t.id); const c = arr.filter(e=>e.status==='concluido').length
      return { team:t, total:arr.length, concl:c, pct: arr.length ? Math.round(c/arr.length*100) : 0 }
    }).filter(x=>x.total>0).sort((a,b)=>b.pct-a.pct)

    // Correio
    const chkTotal = correioChk.length, chkFeito = correioChk.filter(c=>c.concluido).length
    const correioPct = chkTotal ? Math.round(chkFeito/chkTotal*100) : 0
    const afiTotal = correioAfi.length, afiConcl = correioAfi.filter(a=>a.status==='concluido').length

    // Saúde / cozinha
    const medEntregues = med.filter(x=>x.entregue).length, medPendentes = med.filter(x=>!x.entregue).length
    const fichasFeitas = fichas.filter(f=>f.concluida).length
    const fichasFaltando = Math.max(0, encontristas - fichasFeitas)
    const restricoes = fichas.filter(f=>f.restricao_alimentar).length
    const alergias = fichas.filter(f=>f.alergia_medicamentos).length

    // Ocorrências
    const ocAbertas = ocorr.filter(o=>o.status!=='resolved').length
    const ocResolv = ocorr.filter(o=>o.status==='resolved').length
    const ocCriticas = ocorr.filter(o=>o.status!=='resolved' && (o.severity==='high'||o.severity==='critical')).length

    // Cadastros por dia (7)
    const dias: {label:string;n:number}[] = []
    for (let i=6;i>=0;i--) { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i); const key = d.toISOString().slice(0,10); const n = pessoas.filter(p=>(p.created_at||'').slice(0,10)===key).length; dias.push({ label:`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`, n }) }

    // Aniversariantes durante o evento
    const ini = (evento as any)?.start_date ? new Date((evento as any).start_date) : null
    const fim = (evento as any)?.end_date ? new Date((evento as any).end_date) : ini
    const aniversariantes: {name:string;dia:string}[] = []
    if (ini && fim) {
      for (const p of pessoas) {
        if (!p.birth_date) continue
        const b = new Date(p.birth_date + 'T12:00:00')
        for (let d = new Date(ini); d <= fim; d.setDate(d.getDate()+1)) {
          if (d.getMonth()===b.getMonth() && d.getDate()===b.getDate()) { aniversariantes.push({ name:p.name, dia:`${b.getDate()} ${MESES[b.getMonth()]}` }); break }
        }
      }
    }

    return { total, comConta, semConta: total-comConta, encontristas, encontreiros, comFoto, semFoto: total-comFoto,
      online, hoje, arrecadado, aReceber, inadimplentes, formas, finDias, doacoesTotal, maioresDoadores, doacoesAnon,
      escTotal, escConcl, escPct, porEq, correioPct, afiConcl, afiTotal, chkFeito, chkTotal,
      medEntregues, medPendentes, fichasFeitas, fichasFaltando, restricoes, alergias,
      ocAbertas, ocResolv, ocCriticas, dias, aniversariantes }
  }, [pessoas, lastSeen, fin, doacoes, escalas, teams, ocorr, fichas, med, correioChk, correioAfi, evento])

  if (evLoading || (loading && podeVer)) return <div className="page">{[1,2].map(i=><div key={i} className="skeleton" style={{height:120,marginBottom:12,borderRadius:14}}/>)}</div>
  if (!carregado) return <div className="page"><div className="skeleton" style={{height:120,borderRadius:14}}/></div>
  if (!podeVer) return <div className="page"><div className="empty"><p className="empty-title">Acesso restrito</p><p className="empty-desc">Só quem tem liberação do Painel entra aqui.</p></div></div>
  if (!evento) return <div className="page"><div className="empty"><p className="empty-title">Nenhum evento ativo</p></div></div>

  const maxCad = Math.max(1, ...m.dias.map(d=>d.n))
  const maxDia = Math.max(1, ...m.finDias.map(d=>d.v))

  return (
    <div ref={raizRef} style={{ padding:'14px 16px 60px', maxWidth: cheia ? '100%' : 1400, margin:'0 auto', background:'var(--bg)', minHeight: cheia ? '100vh' : undefined, overflowY: cheia ? 'auto' : undefined }}>
      {/* Cabeçalho */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={()=>{ if (document.fullscreenElement) document.exitFullscreen?.(); if (window.history.length > 1) nav(-1); else nav('/') }} aria-label="Voltar"
            style={{background:'white',border:'1px solid var(--border)',borderRadius:10,width:38,height:38,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'var(--shadow-sm)'}}>
            <span className="icon">arrow_back</span>
          </button>
          <div>
            <p style={{fontSize:20,fontWeight:800}}>Painel · {evento.name}</p>
            <p style={{fontSize:12,color:'var(--muted)'}}>atualiza sozinho a cada 30s</p>
          </div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,fontWeight:700,padding:'6px 12px',borderRadius:99,background:'var(--success-bg)',color:'var(--success)'}}><span style={{width:8,height:8,borderRadius:'50%',background:'var(--success)'}}/>{m.online} online</span>
          <button onClick={modoTV} className="btn btn-ghost btn-sm" style={tvMode?{color:'var(--primary)',fontWeight:800}:undefined}><span className="icon icon-sm">slideshow</span> Modo TV</button>
          <button onClick={telaCheia} className="btn btn-ghost btn-sm"><span className="icon icon-sm">{cheia?'fullscreen_exit':'fullscreen'}</span> {cheia?'Sair':'Tela cheia'}</button>
          <button onClick={()=>setModalCards(true)} className="btn btn-ghost btn-sm"><span className="icon icon-sm">tune</span> Cards</button>
          {admin && <button onClick={()=>setModalAcesso(true)} className="btn btn-ghost btn-sm"><span className="icon icon-sm">lock_open</span> Acesso</button>}
        </div>
      </div>

      {/* KPIs — Acessos */}
      {mostra('acessos') && (
        <div style={gridKpi}>
          <Kpi label="Online agora" valor={m.online} cor="var(--success)"/>
          <Kpi label="Acessaram hoje" valor={m.hoje} cor="var(--primary)"/>
          <Kpi label="Com conta" valor={m.comConta} sub={`de ${m.total}`} cor="#2F855A"/>
          <Kpi label="Sem conta" valor={m.semConta} cor="#E8821A"/>
        </div>
      )}
      {/* Acessos por dia (histórico real — acessos_log) */}
      {mostra('acessos') && acessosDia.length > 0 && (() => {
        const ultimos = acessosDia.slice(-14)
        const maxP = Math.max(1, ...ultimos.map(d => d.pessoas))
        return (
          <div style={{ background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>📅 Acessos por dia</p>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>pessoas diferentes que abriram · (entre parênteses: total de aberturas)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ultimos.map(d => (
                <div key={d.dia} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', width: 44, flexShrink: 0 }}>{d.dia.slice(8, 10)}/{d.dia.slice(5, 7)}</span>
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 6, height: 18, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round(d.pessoas / maxP * 100)}%`, height: '100%', background: 'var(--primary)', borderRadius: 6, minWidth: d.pessoas > 0 ? 4 : 0 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, width: 66, textAlign: 'right', flexShrink: 0 }}>{d.pessoas} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>({d.acessos})</span></span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* KPIs — Pessoas */}
      {mostra('cadastros') && (
        <div style={gridKpi}>
          <Kpi label="Encontristas" valor={m.encontristas} cor="#6B46C1"/>
          <Kpi label="Encontreiros" valor={m.encontreiros} cor="var(--primary)"/>
          <Kpi label="Com foto" valor={m.comFoto} sub={`de ${m.total}`} cor="#2B6CB0"/>
          <Kpi label="Sem foto" valor={m.semFoto} cor="#B83280"/>
        </div>
      )}
      {/* KPIs — Financeiro */}
      {mostra('fin_kpi') && (
        <div style={gridKpi}>
          <Kpi label="Arrecadado" valor={fmtBRL(m.arrecadado)} cor="#2F855A"/>
          <Kpi label="Ainda a receber" valor={fmtBRL(m.aReceber)} cor={m.aReceber>0?'#E8821A':'var(--muted)'}/>
          <Kpi label="Doações" valor={fmtBRL(m.doacoesTotal)} cor="#6B46C1"/>
          <Kpi label="Escalas concluídas" valor={`${m.escPct}%`} sub={`${m.escConcl}/${m.escTotal}`} cor="var(--primary)"/>
        </div>
      )}

      <div style={grid}>
        {/* Financeiro: pago × a receber + inadimplentes */}
        {mostra('fin_receber') && (m.arrecadado+m.aReceber)>0 && (() => {
          const tot = m.arrecadado+m.aReceber; const pct = Math.round(m.arrecadado/tot*100)
          return (
            <div style={box}>
              <p style={titulo}>Pago × a receber</p>
              <div style={{display:'flex',alignItems:'center',gap:18,marginBottom:12}}>
                <div style={{width:110,height:110,borderRadius:'50%',flexShrink:0,background:`conic-gradient(#2F855A 0 ${pct}%, #E8821A ${pct}% 100%)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div style={{width:66,height:66,borderRadius:'50%',background:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:800}}>{pct}%</div>
                </div>
                <div style={{fontSize:13}}>
                  <p style={{marginBottom:6}}><span style={ponto('#2F855A')}/>Pago · <b>{fmtBRL(m.arrecadado)}</b></p>
                  <p><span style={ponto('#E8821A')}/>A receber · <b>{fmtBRL(m.aReceber)}</b></p>
                </div>
              </div>
              {m.inadimplentes.length>0 && (
                <div style={{borderTop:'1px solid var(--border)',paddingTop:10}}>
                  <p style={{fontSize:12,fontWeight:700,color:'var(--muted)',marginBottom:6}}>{m.inadimplentes.length} devendo · falta pagar</p>
                  {m.inadimplentes.slice(0,6).map((x,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'3px 0'}}><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{formatName(x.name)}</span><b style={{color:'#E8821A',flexShrink:0,marginLeft:8}}>{fmtBRL(x.falta)}</b></div>
                  ))}
                  {m.inadimplentes.length>6 && <p style={{fontSize:12,color:'var(--muted)',marginTop:4}}>+{m.inadimplentes.length-6} pessoas</p>}
                </div>
              )}
            </div>
          )
        })()}

        {/* Financeiro por dia */}
        {mostra('fin_dia') && m.finDias.length>0 && (
          <div style={box}>
            <p style={titulo}>Arrecadação por dia</p>
            <div style={{display:'flex',alignItems:'flex-end',gap:8,height:130,paddingTop:8}}>
              {m.finDias.map((d,i)=>(
                <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,minWidth:0}}>
                  <span style={{fontSize:10,fontWeight:800,color:'var(--text2)',whiteSpace:'nowrap'}}>{d.v>=1000?`${(d.v/1000).toFixed(1)}k`:d.v}</span>
                  <div style={{width:'100%',height:`${Math.max(4,(d.v/maxDia)*90)}px`,background:'#2F855A',borderRadius:'4px 4px 0 0'}}/>
                  <span style={{fontSize:10,color:'var(--muted)'}}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formas de pagamento */}
        {mostra('fin_formas') && m.formas.length>0 && (
          <div style={box}>
            <p style={titulo}>Formas de pagamento</p>
            {m.formas.map((f,i)=>(
              <div key={i} style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                  <span style={{fontWeight:600,textTransform:'capitalize'}}>{f.forma}</span>
                  <span style={{fontWeight:800}}>{fmtBRL(f.valor)} <span style={{color:'var(--muted)',fontWeight:600}}>· {f.pct}%</span></span>
                </div>
                <div style={{height:8,background:'var(--bg)',borderRadius:99,overflow:'hidden'}}><div style={{height:'100%',width:`${f.pct}%`,background:'#6B46C1',borderRadius:99}}/></div>
              </div>
            ))}
          </div>
        )}

        {/* Maiores doadores */}
        {mostra('fin_doadores') && (m.maioresDoadores.length>0 || m.doacoesAnon>0) && (
          <div style={box}>
            <p style={titulo}>Maiores doadores</p>
            {m.maioresDoadores.map((d,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:i<m.maioresDoadores.length-1?'1px solid var(--border)':'none'}}>
                <span style={{width:22,height:22,borderRadius:'50%',background:i===0?'#D69E2E':'var(--primary-light)',color:i===0?'white':'var(--primary)',fontSize:12,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</span>
                <span style={{flex:1,fontSize:14,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{formatName(d.name)}</span>
                <b style={{fontSize:14,color:'#2F855A'}}>{fmtBRL(d.v)}</b>
              </div>
            ))}
            {m.doacoesAnon>0 && <p style={{fontSize:12,color:'var(--muted)',marginTop:8}}>+ {m.doacoesAnon} doação(ões) anônima(s)</p>}
          </div>
        )}

        {/* Escalas por equipe */}
        {mostra('equipes') && m.porEq.length>0 && (
          <div style={box}>
            <p style={titulo}>Escalas concluídas por equipe</p>
            {m.porEq.map(x => (
              <div key={x.team.id} style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                  <span style={{fontWeight:600}}>{x.team.name}</span>
                  <span style={{fontWeight:800,color:x.pct===100?'#2F855A':x.pct<50?'#D69E2E':'var(--primary)'}}>{x.pct}% <span style={{color:'var(--muted)',fontWeight:600}}>({x.concl}/{x.total})</span></span>
                </div>
                <div style={{height:8,background:'var(--bg)',borderRadius:99,overflow:'hidden'}}><div style={{height:'100%',width:`${x.pct}%`,background:x.team.color||'var(--primary)',borderRadius:99}}/></div>
              </div>
            ))}
          </div>
        )}

        {/* Correio */}
        {mostra('correio') && (m.chkTotal>0 || m.afiTotal>0) && (
          <div style={box}>
            <p style={titulo}>Correio (padrinhos)</p>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:6}}>
              <span style={{fontWeight:600}}>Checklist concluído</span>
              <span style={{fontWeight:800,color:'var(--primary)'}}>{m.correioPct}% <span style={{color:'var(--muted)',fontWeight:600}}>({m.chkFeito}/{m.chkTotal})</span></span>
            </div>
            <div style={{height:10,background:'var(--bg)',borderRadius:99,overflow:'hidden',marginBottom:12}}><div style={{height:'100%',width:`${m.correioPct}%`,background:'#B83280',borderRadius:99}}/></div>
            <div style={{display:'flex',gap:10}}>
              <div style={{flex:1,textAlign:'center',background:'var(--bg)',borderRadius:10,padding:'10px 6px'}}><p style={{fontSize:22,fontWeight:800,color:'#2F855A'}}>{m.afiConcl}</p><p style={{fontSize:11,color:'var(--muted)'}}>afilhados prontos</p></div>
              <div style={{flex:1,textAlign:'center',background:'var(--bg)',borderRadius:10,padding:'10px 6px'}}><p style={{fontSize:22,fontWeight:800,color:'var(--primary)'}}>{m.afiTotal}</p><p style={{fontSize:11,color:'var(--muted)'}}>afilhados no total</p></div>
            </div>
          </div>
        )}

        {/* Saúde e cozinha */}
        {mostra('saude') && (m.medEntregues+m.medPendentes+m.restricoes+m.alergias)>0 && (
          <div style={box}>
            <p style={titulo}>Saúde e cozinha</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <Mini valor={m.medEntregues} label="remédios entregues" cor="#2F855A"/>
              <Mini valor={m.medPendentes} label="remédios pendentes" cor={m.medPendentes>0?'#E8821A':'var(--muted)'}/>
              <Mini valor={m.restricoes} label="restrições alimentares" cor="#6B46C1"/>
              <Mini valor={m.alergias} label="alergias a remédio" cor="#C53030"/>
            </div>
          </div>
        )}

        {/* Ocorrências */}
        {mostra('ocorr') && (m.ocAbertas+m.ocResolv)>0 && (
          <div style={box}>
            <p style={titulo}>Ocorrências</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <Mini valor={m.ocAbertas} label="abertas" cor={m.ocAbertas>0?'#E8821A':'var(--muted)'}/>
              <Mini valor={m.ocResolv} label="resolvidas" cor="#2F855A"/>
            </div>
            {m.ocCriticas>0 && <p style={{marginTop:10,fontSize:13,fontWeight:700,color:'#C53030',background:'#FFF5F5',borderRadius:8,padding:'8px 10px'}}>⚠️ {m.ocCriticas} ocorrência(s) grave(s) em aberto</p>}
          </div>
        )}

        {/* Fichas médicas */}
        {mostra('fichas') && m.encontristas>0 && (() => {
          const pct = m.encontristas ? Math.round(m.fichasFeitas/m.encontristas*100) : 0
          return (
            <div style={box}>
              <p style={titulo}>Fichas médicas (encontristas)</p>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:6}}>
                <span style={{fontWeight:600}}>Preenchidas</span>
                <span style={{fontWeight:800,color:pct===100?'#2F855A':'var(--primary)'}}>{pct}% <span style={{color:'var(--muted)',fontWeight:600}}>({m.fichasFeitas}/{m.encontristas})</span></span>
              </div>
              <div style={{height:10,background:'var(--bg)',borderRadius:99,overflow:'hidden'}}><div style={{height:'100%',width:`${pct}%`,background:'#2B6CB0',borderRadius:99}}/></div>
              {m.fichasFaltando>0 && <p style={{fontSize:12,color:'var(--muted)',marginTop:8}}>{m.fichasFaltando} ainda sem preencher</p>}
            </div>
          )
        })()}

        {/* Gráfico cadastros por dia */}
        {mostra('grafcad') && (
          <div style={box}>
            <p style={titulo}>Cadastros nos últimos 7 dias</p>
            <div style={{display:'flex',alignItems:'flex-end',gap:8,height:120,paddingTop:8}}>
              {m.dias.map((d,i)=>(
                <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                  <span style={{fontSize:11,fontWeight:800,color:'var(--text2)'}}>{d.n||''}</span>
                  <div style={{width:'100%',height:`${Math.max(4,(d.n/maxCad)*90)}px`,background:'var(--primary)',borderRadius:'4px 4px 0 0'}}/>
                  <span style={{fontSize:10,color:'var(--muted)'}}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tipos donut */}
        {mostra('tipos') && (m.encontristas+m.encontreiros)>0 && (() => {
          const tot = m.encontristas+m.encontreiros; const pctEnc = Math.round(m.encontristas/tot*100)
          return (
            <div style={box}>
              <p style={titulo}>Encontristas × Encontreiros</p>
              <div style={{display:'flex',alignItems:'center',gap:18}}>
                <div style={{width:110,height:110,borderRadius:'50%',flexShrink:0,background:`conic-gradient(#6B46C1 0 ${pctEnc}%, var(--primary) ${pctEnc}% 100%)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div style={{width:66,height:66,borderRadius:'50%',background:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800}}>{tot}</div>
                </div>
                <div style={{fontSize:13}}>
                  <p style={{marginBottom:6}}><span style={ponto('#6B46C1')}/>Encontristas · <b>{m.encontristas}</b></p>
                  <p><span style={ponto('var(--primary)')}/>Encontreiros · <b>{m.encontreiros}</b></p>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Aniversariantes */}
        {mostra('aniver') && m.aniversariantes.length>0 && (
          <div style={box}>
            <p style={titulo}>🎂 Aniversariantes no evento</p>
            {m.aniversariantes.map((a,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:14,padding:'6px 0',borderBottom:i<m.aniversariantes.length-1?'1px solid var(--border)':'none'}}>
                <span style={{fontWeight:600}}>{formatName(a.name)}</span><span style={{color:'var(--primary)',fontWeight:700}}>{a.dia}</span>
              </div>
            ))}
          </div>
        )}

        {/* Engajamento */}
        {mostra('engaj') && (curtidas+comentarios)>0 && (
          <div style={box}>
            <p style={titulo}>Engajamento no carrossel</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <Mini valor={curtidas} label="❤️ curtidas" cor="#ED4956"/>
              <Mini valor={comentarios} label="💬 comentários" cor="#2B6CB0"/>
            </div>
          </div>
        )}

        {/* Comparar com evento anterior */}
        {mostra('compare') && anterior && (
          <div style={box}>
            <p style={titulo}>Comparar com {anterior.name}</p>
            <Comparar label="Cadastros" atual={m.total} antes={anterior.cadastros}/>
            <Comparar label="Arrecadado" atual={m.arrecadado} antes={anterior.arrecadado} dinheiro/>
          </div>
        )}
      </div>

      {modalCards && <ModalCards off={off} toggle={toggleCard} fechar={()=>setModalCards(false)} />}
      {modalAcesso && admin && <ModalAcesso pessoas={pessoas.filter(p=>p.user_id)} fechar={()=>setModalAcesso(false)} />}
    </div>
  )
}

const gridKpi: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10, marginBottom:12 }
const grid: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:12, marginTop:4 }
const box: React.CSSProperties = { background:'white', borderRadius:14, padding:'16px 18px', boxShadow:'var(--shadow-sm)' }
const titulo: React.CSSProperties = { fontSize:13, fontWeight:800, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }
const ponto = (c:string): React.CSSProperties => ({ display:'inline-block', width:11, height:11, borderRadius:3, background:c, marginRight:6 })

function Kpi({ label, valor, sub, cor }: { label:string; valor:string|number; sub?:string; cor:string }) {
  return (
    <div style={{background:'white',borderRadius:14,padding:'14px 16px',boxShadow:'var(--shadow-sm)',borderLeft:`4px solid ${cor}`}}>
      <p style={{fontSize:12,color:'var(--muted)',fontWeight:600}}>{label}</p>
      <p style={{fontSize:24,fontWeight:800,color:cor,lineHeight:1.1,marginTop:2}}>{valor}{sub && <span style={{fontSize:13,color:'var(--muted)',fontWeight:600}}> {sub}</span>}</p>
    </div>
  )
}
function Mini({ valor, label, cor }: { valor:number; label:string; cor:string }) {
  return <div style={{textAlign:'center',background:'var(--bg)',borderRadius:10,padding:'12px 6px'}}><p style={{fontSize:24,fontWeight:800,color:cor}}>{valor}</p><p style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{label}</p></div>
}
function Comparar({ label, atual, antes, dinheiro }: { label:string; atual:number; antes:number; dinheiro?:boolean }) {
  const diff = atual - antes
  const pct = antes>0 ? Math.round(diff/antes*100) : (atual>0?100:0)
  const fmt = (v:number) => dinheiro ? fmtBRL(v) : String(v)
  const cor = diff>0 ? '#2F855A' : diff<0 ? '#C53030' : 'var(--muted)'
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
      <span style={{fontSize:13,fontWeight:600}}>{label}</span>
      <div style={{textAlign:'right'}}>
        <p style={{fontSize:15,fontWeight:800}}>{fmt(atual)} <span style={{fontSize:12,color:'var(--muted)',fontWeight:600}}>· antes {fmt(antes)}</span></p>
        <p style={{fontSize:12,fontWeight:800,color:cor}}>{diff>=0?'▲':'▼'} {Math.abs(pct)}%</p>
      </div>
    </div>
  )
}

function ModalCards({ off, toggle, fechar }: { off:Set<string>; toggle:(k:string)=>void; fechar:()=>void }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&fechar()}>
      <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 28px',maxWidth:480,width:'100%',margin:'0 auto',maxHeight:'80vh',overflowY:'auto'}}>
        <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 14px'}}/>
        <p style={{fontSize:17,fontWeight:800,marginBottom:4}}>Cards do painel</p>
        <p style={{fontSize:12,color:'var(--muted)',marginBottom:14}}>Desligue o que não quiser ver. Vale só neste aparelho.</p>
        {CARDS.map(c=>{
          const on = !off.has(c.key)
          return (
            <button key={c.key} onClick={()=>toggle(c.key)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 4px',background:'none',border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',fontFamily:'inherit'}}>
              <span style={{fontSize:14,fontWeight:600,textAlign:'left'}}>{c.nome}</span>
              <span style={{width:44,height:26,borderRadius:99,background:on?'var(--success)':'var(--border)',position:'relative',flexShrink:0,transition:'background .15s'}}>
                <span style={{position:'absolute',top:3,left:on?21:3,width:20,height:20,borderRadius:'50%',background:'white',transition:'left .15s',boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}/>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ModalAcesso({ pessoas, fechar }: { pessoas:Pessoa[]; fechar:()=>void }) {
  const [liberados, setLiberados] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { (async()=>{ const { data } = await supabase.from('permissoes').select('person_id').eq('modulo','painel').eq('acao','ver').eq('permitido',true); setLiberados(new Set((data??[]).map((x:any)=>x.person_id).filter(Boolean))); setLoading(false) })() }, [])
  async function toggle(p: Pessoa) {
    const on = liberados.has(p.id)
    setLiberados(prev => { const n = new Set(prev); on ? n.delete(p.id) : n.add(p.id); return n })
    if (on) await supabase.from('permissoes').delete().eq('person_id',p.id).eq('modulo','painel').eq('acao','ver')
    else { const { error } = await supabase.from('permissoes').insert({ person_id:p.id, modulo:'painel', acao:'ver', permitido:true }); if (error) toast.falha('Não foi possível liberar.', error) }
  }
  const lista = pessoas.filter(p=>!busca || normalizarNome(p.name).includes(normalizarNome(busca)))
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&fechar()}>
      <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 24px',maxWidth:480,width:'100%',margin:'0 auto',maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
        <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 12px',flexShrink:0}}/>
        <p style={{fontSize:17,fontWeight:800,marginBottom:4}}>Quem acessa o Painel</p>
        <p style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>Liberação própria (não é de equipe). Admin sempre entra. Isto NÃO dá acesso à Administração.</p>
        <div className="search-bar" style={{marginBottom:10,flexShrink:0}}>
          <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
          <input placeholder="Buscar pessoa..." value={busca} onChange={e=>setBusca(e.target.value)}/>
        </div>
        <div style={{overflowY:'auto',flex:1}}>
          {loading ? <p style={{fontSize:13,color:'var(--muted)',padding:'16px 0'}}>Carregando…</p> :
          lista.map(p=>{
            const on = liberados.has(p.id)
            return (
              <button key={p.id} onClick={()=>toggle(p)} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 4px',background:'none',border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                <div style={{width:34,height:34,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {p.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:12,fontWeight:700,color:'var(--primary)'}}>{getInitials(p.name)}</span>}
                </div>
                <span style={{flex:1,fontSize:14,fontWeight:on?700:500}}>{formatName(p.name)}</span>
                <span className="icon" style={{color:on?'var(--primary)':'var(--border)'}}>{on?'check_circle':'radio_button_unchecked'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
