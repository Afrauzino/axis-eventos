import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRegistrarChromeAdmin } from '../lib/chrome'
import { fmtBRL } from '../utils'
import type { Profile } from '../App'

type Evento = { id:string; name:string; status:string }
type Metricas = {
  totalPessoas:number; encontristas:number; encontreiros:number; equipes:number
  arrecadado:number; doacoes:number; ocorrencias:number; ministracoes:number; teatros:number
}

const LINHAS: { key:keyof Metricas; label:string; money?:boolean }[] = [
  { key:'totalPessoas', label:'Total de pessoas' },
  { key:'encontristas', label:'Encontristas' },
  { key:'encontreiros', label:'Encontreiros' },
  { key:'equipes',      label:'Equipes' },
  { key:'ministracoes', label:'Ministrações' },
  { key:'teatros',      label:'Teatros' },
  { key:'arrecadado',   label:'Arrecadado', money:true },
  { key:'doacoes',      label:'Doações', money:true },
  { key:'ocorrencias',  label:'Ocorrências' },
]

const STATUS_LABEL: Record<string,string> = { active:'Ativo', finished:'Encerrado', inactive:'Inativo' }

export default function Relatorios({ profile }: { profile?: Profile }) {
  useRegistrarChromeAdmin()
  const [eventos, setEventos] = useState<Evento[]>([])
  const [sel, setSel] = useState<string[]>([])
  const [metricas, setMetricas] = useState<Record<string, Metricas>>({})
  const [carregando, setCarregando] = useState(false)

  useEffect(() => { carregarEventos() }, [])

  async function carregarEventos() {
    const { data } = await supabase.from('events').select('id,name,status').order('created_at', { ascending:false })
    const evs = data ?? []
    setEventos(evs)
    // pré-seleciona o ativo (ou o primeiro)
    const ativo = evs.find(e=>e.status==='active') ?? evs[0]
    if (ativo) { setSel([ativo.id]); carregarMetricas([ativo.id]) }
  }

  async function carregarMetricas(ids: string[]) {
    const faltam = ids.filter(id => !metricas[id])
    if (!faltam.length) return
    setCarregando(true)
    const novos: Record<string, Metricas> = {}
    await Promise.all(faltam.map(async id => {
      const q = (t:string, extra?:(qb:any)=>any) => {
        let qb:any = supabase.from(t).select('id', { count:'exact', head:true }).eq('event_id', id)
        if (extra) qb = extra(qb)
        return qb
      }
      const [enc, trb, eq, oc, mi, te, fin, doa] = await Promise.all([
        q('people', (qb:any)=>qb.eq('role_type','encounterer')),
        q('people', (qb:any)=>qb.eq('role_type','worker')),
        q('teams'),
        q('occurrences'),
        q('ministrações'),
        q('theaters'),
        supabase.from('financeiro').select('valor,status').eq('event_id', id),
        supabase.from('doacoes').select('valor').eq('event_id', id),
      ])
      const arrecadado = (fin.data ?? []).filter((p:any)=>p.status==='pago').reduce((s:number,p:any)=>s+(p.valor||0),0)
      const doacoes    = (doa.data ?? []).reduce((s:number,d:any)=>s+(d.valor||0),0)
      novos[id] = {
        encontristas: enc.count ?? 0, encontreiros: trb.count ?? 0,
        totalPessoas: (enc.count ?? 0) + (trb.count ?? 0),
        equipes: eq.count ?? 0, ocorrencias: oc.count ?? 0,
        ministracoes: mi.count ?? 0, teatros: te.count ?? 0,
        arrecadado, doacoes,
      }
    }))
    setMetricas(m => ({ ...m, ...novos }))
    setCarregando(false)
  }

  function toggle(id: string) {
    setSel(prev => {
      const novo = prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]
      carregarMetricas(novo)
      return novo
    })
  }

  const selecionados = eventos.filter(e => sel.includes(e.id))
  const fmt = (v:number, money?:boolean) => money ? fmtBRL(v) : String(v)

  // Exporta a MESMA tabela da tela como arquivo que o Excel abre nativo (.xls).
  // Sem biblioteca: um HTML de <table> com MIME de Excel — o Excel lê direto.
  function exportarExcel() {
    if (!selecionados.length) return
    const esc = (s:any) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    const head = `<tr><th>Métrica</th>${selecionados.map(e=>`<th>${esc(e.name)}</th>`).join('')}</tr>`
    const linhas = LINHAS.map(ln => {
      const celulas = selecionados.map(e => {
        const m = metricas[e.id]
        return `<td>${m ? esc(fmt(m[ln.key] as number, ln.money)) : ''}</td>`
      }).join('')
      return `<tr><td>${esc(ln.label)}</td>${celulas}</tr>`
    }).join('')
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1">${head}${linhas}</table></body></html>`
    const blob = new Blob(['﻿', html], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'AXIS-comparativo.xls'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      <h1 style={{fontSize:20,fontWeight:800,marginBottom:4}}>📊 Comparativo entre eventos</h1>
      <p style={{fontSize:13,color:'var(--muted)',marginBottom:14}}>Selecione os eventos (inclusive inativos) para comparar números lado a lado.</p>

      {/* Seleção de eventos */}
      <div className="section-label mb-2">Eventos</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
        {eventos.length===0 ? <p style={{fontSize:13,color:'var(--muted)'}}>Nenhum evento.</p> :
         eventos.map(e => {
          const on = sel.includes(e.id)
          return (
            <button key={e.id} onClick={()=>toggle(e.id)}
              style={{padding:'8px 12px',borderRadius:20,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600,
                border:on?'2px solid var(--primary)':'1px solid var(--border)',background:on?'var(--primary-light)':'white',
                color:on?'var(--primary)':'var(--text2)',display:'flex',alignItems:'center',gap:6}}>
              <span className="icon" style={{fontSize:15}}>{on?'check_box':'check_box_outline_blank'}</span>
              {e.name}
              <span style={{fontSize:10,opacity:0.7}}>· {STATUS_LABEL[e.status]??e.status}</span>
            </button>
          )
        })}
      </div>

      {/* Exportar (só quando há evento selecionado) */}
      {selecionados.length>0 && (
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
          <button onClick={exportarExcel}
            style={{padding:'8px 14px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700,border:'none',background:'var(--primary)',color:'white',display:'flex',alignItems:'center',gap:6}}>
            <span className="icon" style={{fontSize:16}}>download</span> Exportar Excel
          </button>
        </div>
      )}

      {/* Tabela comparativa */}
      {selecionados.length===0 ? (
        <div className="empty"><p className="empty-desc">Selecione ao menos um evento.</p></div>
      ) : (
        <div style={{overflowX:'auto',border:'1px solid var(--border)',borderRadius:12,background:'white'}}>
          <table style={{borderCollapse:'collapse',width:'100%',minWidth:selecionados.length>1?420:280}}>
            <thead>
              <tr>
                <th style={{textAlign:'left',padding:'10px 12px',fontSize:12,color:'var(--muted)',position:'sticky',left:0,background:'white',borderBottom:'2px solid var(--border)'}}>Métrica</th>
                {selecionados.map(e => (
                  <th key={e.id} style={{textAlign:'right',padding:'10px 12px',fontSize:13,fontWeight:800,borderBottom:'2px solid var(--border)',whiteSpace:'nowrap'}}>{e.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LINHAS.map((ln,i) => (
                <tr key={ln.key} style={{background:i%2?'var(--bg)':'white'}}>
                  <td style={{padding:'10px 12px',fontSize:13,fontWeight:600,position:'sticky',left:0,background:i%2?'var(--bg)':'white'}}>{ln.label}</td>
                  {selecionados.map(e => {
                    const m = metricas[e.id]
                    return (
                      <td key={e.id} style={{padding:'10px 12px',fontSize:13,textAlign:'right',color:ln.money?'var(--success)':'var(--text)',fontWeight:ln.money?700:500}}>
                        {m ? fmt(m[ln.key] as number, ln.money) : (carregando?'...':'—')}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
