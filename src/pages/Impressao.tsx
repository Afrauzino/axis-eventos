// Impressão — agora é um EDITOR de layout (src/editor).
// Você desenha um modelo (foto, nome, formas, imagens…) e ele é
// repetido por pessoa, encaixado na folha A4.
// O Crachá continua com a tela dele, intacto.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import { carregarConfig, salvarConfig } from '../lib/tema'
import { isAdmin, formatName } from '../utils'
import { toast } from '../components/Toast'
import type { Profile } from '../App'

import Editor from '../editor/Editor'
import ImprimirView from '../editor/render/Imprimir'
import { criarElemento } from '../editor/elementos'
import { novoId, type Documento } from '../editor/tipos'

type Pessoa = { id:string; name:string; photo_url:string|null; role_type?:string|null; church?:string|null }
type Modelo = { id:string; nome:string; doc:Documento }

const CHAVE = 'impressao_modelos_v2'

/** Modelo inicial: etiqueta 60×80mm com foto e nome, repetida por pessoa. */
function docPadrao(): Documento {
  const foto = criarElemento('foto', { x: 15, y: 8, w: 30, h: 30 })!
  const nome = criarElemento('texto', { x: 4, y: 44, w: 52, h: 12 })!
  nome.props = { ...nome.props, campo: 'nome', tam: 4, alinhar: 'center' }
  return {
    id: novoId(), nome: 'Etiqueta',
    papel: { largura: 60, altura: 80 },
    paginas: [{ id: novoId(), fundo: '#ffffff', elementos: [foto, nome] }],
    fonteDados: 'pessoas',
  }
}

export default function Impressao({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const { pode } = usePermissao(profile ?? null)
  const canEdit = isAdmin(profile?.user_role) || pode('impressao','editar')

  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [equipes, setEquipes] = useState<{id:string;name:string}[]>([])
  const [equipeIds, setEquipeIds] = useState<Record<string,string[]>>({})
  const [loading, setLoading] = useState(true)

  const [filtroTipo, setFiltroTipo] = useState<'todos'|'encounterer'|'worker'>('encounterer')
  const [filtroEquipe, setFiltroEquipe] = useState('')

  const [modelos, setModelos] = useState<Modelo[]>([])
  const [doc, setDoc] = useState<Documento>(() => docPadrao())
  const [orientacao, setOrientacao] = useState<'retrato'|'paisagem'>('retrato')
  const [imprimindo, setImprimindo] = useState<Documento|null>(null)
  const [abrirModelos, setAbrirModelos] = useState(false)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])
  useEffect(() => { carregarConfig(CHAVE).then(v => { if (v) { try { setModelos(JSON.parse(v)) } catch {} } }) }, [])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [pe, tm, pt] = await Promise.all([
      supabase.from('people').select('id,name,photo_url,role_type,church').eq('event_id',evento.id).order('name'),
      supabase.from('teams').select('id,name').eq('event_id',evento.id).order('name'),
      supabase.from('people_teams').select('person_id,team_id'),
    ])
    setPessoas(pe.data ?? [])
    setEquipes(tm.data ?? [])
    const ids: Record<string,string[]> = {}
    ;(pt.data ?? []).forEach((v:any)=>{ (ids[v.person_id]=ids[v.person_id]||[]).push(v.team_id) })
    setEquipeIds(ids)
    setLoading(false)
  }

  const lista = pessoas.filter(p => {
    if (filtroTipo!=='todos' && p.role_type!==filtroTipo) return false
    if (filtroEquipe && !(equipeIds[p.id]??[]).includes(filtroEquipe)) return false
    return true
  })

  const nomeEquipes = (pid:string) =>
    (equipeIds[pid]??[]).map(tid => equipes.find(t=>t.id===tid)?.name).filter(Boolean).join(', ')

  /** Um "registro de dados" por pessoa — é o que preenche {{nome}}, {{foto}}… */
  const dados = useMemo(() => lista.map(p => ({
    nome: formatName(p.name),
    foto: p.photo_url ?? '',
    equipe: nomeEquipes(p.id),
    igreja: p.church ?? '',
    funcao: p.role_type === 'worker' ? 'Encontreiro' : 'Encontrista',
  })), [lista, equipeIds, equipes])

  /** Prévia dentro do editor: a primeira pessoa do filtro. */
  const dadosPrevia = dados[0] ?? { nome: 'Nome da Pessoa', foto: '', equipe: 'Equipe', igreja: '', funcao: '' }

  async function guardar(novos: Modelo[]) { setModelos(novos); await salvarConfig(CHAVE, JSON.stringify(novos)) }

  async function salvarModelo(d: Documento) {
    const nome = prompt('Nome do modelo:', d.nome || 'Meu modelo')
    if (!nome) return
    const existe = modelos.find(m => m.id === d.id)
    const doc2 = { ...d, nome }
    setDoc(doc2)
    const novos = existe ? modelos.map(m => m.id===d.id ? { ...m, nome, doc: doc2 } : m)
                         : [...modelos, { id: d.id, nome, doc: doc2 }]
    await guardar(novos)
    toast.sucesso('Modelo salvo!')
  }

  async function excluirModelo(id:string) {
    if (!confirm('Excluir este modelo?')) return
    await guardar(modelos.filter(m => m.id !== id))
  }

  if (evLoading || loading) return <div className="page">{[1,2].map(i=><div key={i} className="skeleton" style={{height:110,marginBottom:12,borderRadius:14}}/>)}</div>
  if (!evento) return <div className="page"><div className="empty"><p className="empty-title">Nenhum evento ativo</p></div></div>

  if (imprimindo) return <ImprimirView doc={imprimindo} dados={dados} orientacao={orientacao} onVoltar={()=>setImprimindo(null)} />

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100dvh - 56px)', minHeight:0 }}>

      {/* Barra: modelos, quem entra, orientação */}
      <div style={{ background:'white', borderBottom:'1px solid var(--border)', padding:'8px 12px', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
        <button className="btn btn-ghost btn-sm" onClick={()=>setAbrirModelos(v=>!v)}>
          <span className="icon icon-sm">bookmarks</span> Modelos ({modelos.length})
        </button>
        <select className="form-input" style={{ width:'auto', padding:'6px 10px', fontSize:13 }}
          value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value as any)}>
          <option value="encounterer">Encontristas</option>
          <option value="worker">Encontreiros</option>
          <option value="todos">Todos</option>
        </select>
        <select className="form-input" style={{ width:'auto', padding:'6px 10px', fontSize:13 }}
          value={filtroEquipe} onChange={e=>setFiltroEquipe(e.target.value)}>
          <option value="">Todas as equipes</option>
          {equipes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="form-input" style={{ width:'auto', padding:'6px 10px', fontSize:13 }}
          value={orientacao} onChange={e=>setOrientacao(e.target.value as any)}>
          <option value="retrato">A4 em pé</option>
          <option value="paisagem">A4 deitada</option>
        </select>
        <span style={{ fontSize:12, color:'var(--muted)', marginLeft:'auto' }}>{lista.length} pessoa(s)</span>
      </div>

      {/* Modelos salvos */}
      {abrirModelos && (
        <div style={{ background:'var(--bg)', padding:'10px 12px', borderBottom:'1px solid var(--border)', display:'flex', gap:8, flexWrap:'wrap', flexShrink:0 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>{ setDoc(docPadrao()); setAbrirModelos(false) }}>+ Novo modelo</button>
          {modelos.map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:4, background: doc.id===m.id?'var(--primary)':'white', color: doc.id===m.id?'white':'var(--text)', border:'1px solid var(--border)', borderRadius:99, padding:'4px 6px 4px 12px' }}>
              <button onClick={()=>{ setDoc(m.doc); setAbrirModelos(false) }} style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', fontFamily:'inherit', fontWeight:700, fontSize:13 }}>{m.nome}</button>
              {canEdit && <button onClick={()=>excluirModelo(m.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', opacity:0.7, display:'flex' }}><span className="icon icon-sm">close</span></button>}
            </div>
          ))}
          {modelos.length===0 && <span style={{ fontSize:12, color:'var(--muted)', alignSelf:'center' }}>Nenhum modelo salvo ainda.</span>}
        </div>
      )}

      {/* EDITOR */}
      <div style={{ flex:1, minHeight:0 }}>
        <Editor
          key={doc.id}
          inicial={doc}
          dados={dadosPrevia}
          onSalvar={canEdit ? salvarModelo : undefined}
          onImprimir={(d)=>{ if (lista.length===0) { toast.info('Ninguém neste filtro.'); return } setImprimindo(d) }}
        />
      </div>
    </div>
  )
}
