import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ArquivosModulo from '../components/ArquivosModulo'
import PrintOverlay from '../components/PrintOverlay'
import { getInitials, isAdmin } from '../utils'
import PersonSelect from '../components/PersonSelect'
import CardItem from '../components/CardItem'
import RichEditor from '../components/RichEditor'
import UploadFoto from '../components/UploadFoto'
import Seletor from '../components/Seletor'
import { toast } from '../components/Toast'
import { usePermissao } from '../hooks/usePermissao'
import { useRegistrarChrome } from '../lib/chrome'
import type { Profile } from '../App'

type Teatro     = { id:string; nome:string; descricao:string|null; data_hora:string|null; local:string|null; status:string; cor:string|null; emoji?:string|null; foto_url?:string|null; capa_url?:string|null }
type Bloco      = { tipo:string; conteudo:string }
type Cena       = { id:string; ordem:number; titulo:string|null; deixa:string|null; acao:string|null; fala:string|null; trilha_sonora:string|null; personagem_id:string|null; person_id:string|null; objeto_id:string|null; blocos?:Bloco[]|null; personagens?:any; objetos?:any }
type ElencoItem = { id:string; person_id:string; personagem_id:string|null; observacoes:string|null }
type Pessoa     = { id:string; name:string; photo_url:string|null }
type Personagem = { id:string; nome:string; icone:string|null; multiplo:boolean }
type Objeto     = { id:string; nome:string; icone:string|null }
type Ministracao = { id:string; titulo:string; ministrante_id:string|null; tema:string|null }
type Midia       = { id:string; tipo:'foto'|'audio'|'video'; titulo:string|null; url:string }

// Tipos de caixa da cena (cada caixa tem tipo + formatação própria)
const TIPOS_BLOCO: { tipo:string; label:string; cor:string; bg:string }[] = [
  { tipo:'fala',   label:'Fala',        cor:'#0f6e56', bg:'#E1F5EE' },
  { tipo:'deixa',  label:'Deixa',       cor:'#854f0b', bg:'#FAEECB' },
  { tipo:'acao',   label:'Ação',        cor:'#0C447C', bg:'#E6F1FB' },
  { tipo:'trilha', label:'Trilha',      cor:'#3C3489', bg:'#EEEDFE' },
  { tipo:'obs',    label:'Observação',  cor:'#5F5E5A', bg:'#F1EFE8' },
  { tipo:'foto',   label:'Foto',        cor:'#5F5E5A', bg:'#F1EFE8' },
]
const infoBloco = (tipo:string) => TIPOS_BLOCO.find(t=>t.tipo===tipo) ?? TIPOS_BLOCO[0]
const stripHtml = (html:string) => (html||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()
// Constrói blocos a partir das colunas antigas (retrocompatível)
function blocosDoLegado(c: Cena): Bloco[] {
  const out: Bloco[] = []
  if (c.deixa) out.push({ tipo:'deixa', conteudo:c.deixa })
  if (c.acao) out.push({ tipo:'acao', conteudo:c.acao })
  if (c.fala) out.push({ tipo:'fala', conteudo:c.fala })
  if (c.trilha_sonora) out.push({ tipo:'trilha', conteudo:c.trilha_sonora })
  return out
}

const MIDIA_INFO: Record<string,{icone:string;label:string}> = {
  foto:  { icone:'photo',       label:'Foto' },
  audio: { icone:'music_note',  label:'Áudio' },
  video: { icone:'movie',       label:'Vídeo' },
}

// Elenco de uma cena: múltiplos atores por personagem, múltiplos objetos
type CenaPersonagem = { personagem_id:string; person_ids:string[] }
type CenaObjeto     = { objeto_id:string }

function MatIcon({ name, size=20, color='var(--text2)' }: {name:string;size?:number;color?:string}) {
  return <span style={{fontFamily:"'Material Symbols Outlined'",fontWeight:'normal',fontStyle:'normal',fontSize:size,lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',direction:'ltr',WebkitFontSmoothing:'antialiased',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",color,userSelect:'none'}}>{name}</span>
}

export default function TeatroDetalhe({ profile }: { profile?: Profile }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [teatro, setTeatro]     = useState<Teatro|null>(null)
  const [eventId, setEventId]   = useState<string|null>(null)
  const [cenas, setCenas]       = useState<Cena[]>([])
  const [elenco, setElenco]     = useState<ElencoItem[]>([])
  const [pessoas, setPessoas]   = useState<Pessoa[]>([])
  const [personagens, setPersonagens] = useState<Personagem[]>([])
  const [objetos, setObjetos]   = useState<Objeto[]>([])
  const [ministracao, setMinistracao] = useState<Ministracao|null>(null)
  const [ministrante, setMinistrante] = useState<Pessoa|null>(null)
  const [midias, setMidias]     = useState<Midia[]>([])
  const [arquivosCount, setArquivosCount] = useState(0)
  const [aba, setAba]           = useState<'cenas'|'elenco'|'midia'|'arquivos'>('cenas')
  const [imprimir, setImprimir] = useState(false)
  const [modalMidia, setModalMidia] = useState(false)
  const [formMidia, setFormMidia]   = useState<{tipo:'foto'|'audio'|'video';titulo:string;url:string}>({ tipo:'foto', titulo:'', url:'' })
  const [salvandoMidia, setSalvandoMidia] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [modalCena, setModalCena] = useState(false)
  const [editandoCena, setEditandoCena] = useState<Cena|null>(null)
  const [salvandoCena, setSalvandoCena] = useState(false)

  // Cena form state
  const [formCena, setFormCena] = useState({ titulo:'', deixa:'', acao:'', fala:'', trilha_sonora:'' })
  const [blocos, setBlocos] = useState<Bloco[]>([])
  // Personagens da cena: lista de {personagem_id, person_ids[]}
  const [cenaPersonagens, setCenaPersonagens] = useState<CenaPersonagem[]>([])
  // Objetos da cena: lista de objeto_ids
  const [cenaObjetos, setCenaObjetos] = useState<string[]>([])
  const [cenaArq, setCenaArq] = useState<File[]>([]) // arquivos da cena

  const { pode } = usePermissao(profile ?? null)
  const canEdit = (!!profile && isAdmin(profile.user_role)) || pode('teatro','editar')

  // Envia um arquivo para o storage e registra em arquivos_modulo
  async function uploadArquivoCena(refId:string, file:File) {
    const ext = file.name.split('.').pop()
    const path = `teatro_cena/${refId}/${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`
    const { error } = await supabase.storage.from('arquivos').upload(path, file, { upsert:true })
    if (error) return
    const { data:u } = supabase.storage.from('arquivos').getPublicUrl(path)
    await supabase.from('arquivos_modulo').insert({ event_id: eventId, modulo:'teatro_cena', referencia_id: refId, nome:file.name, url:u.publicUrl, tipo:file.type, tamanho:file.size })
  }

  useEffect(() => { if (id) carregar() }, [id])

  async function carregar() {
    setLoading(true)
    const [te, ce, el, pg, ob, mi] = await Promise.all([
      supabase.from('theaters').select('*').eq('id', id).single(),
      supabase.from('teatro_cenas').select('*').eq('theater_id', id).order('ordem'),
      supabase.from('teatro_elenco').select('*').eq('theater_id', id),
      supabase.from('personagens_globais').select('id,nome,icone,multiplo').order('nome'),
      supabase.from('objetos_globais').select('id,nome,icone').order('nome'),
      supabase.from('teatro_midias').select('id,tipo,titulo,url').eq('theater_id', id).order('created_at'),
    ])
    setTeatro(te.data)
    setCenas(ce.data ?? [])
    setElenco(el.data ?? [])
    setPersonagens(pg.data ?? [])
    setObjetos(ob.data ?? [])
    setMidias((mi.data as Midia[]) ?? [])
    // conta arquivos (para "informar que tem arquivo" na impressão)
    const { count: arqN } = await supabase.from('arquivos_modulo').select('id',{count:'exact',head:true}).eq('modulo','teatro').eq('referencia_id', id)
    setArquivosCount(arqN ?? 0)

    if (te.data) {
      const { data: ev } = await supabase.from('theaters').select('event_id').eq('id', id).single()
      if (ev?.event_id) setEventId(ev.event_id)
      if (ev) {
        const { data: pe } = await supabase.from('people').select('id,name,photo_url').eq('event_id', ev.event_id).order('name')
        setPessoas(pe ?? [])
      }
    }
    // Load linked ministração if exists
    if (te.data?.ministracao_id) {
      const { data: minData } = await supabase.from('ministrações').select('id,titulo,ministrante_id,tema').eq('id', te.data.ministracao_id).single()
      if (minData) {
        setMinistracao(minData)
        if (minData.ministrante_id) {
          const { data: minPessoa } = await supabase.from('people').select('id,name,photo_url').eq('id', minData.ministrante_id).single()
          if (minPessoa) setMinistrante(minPessoa)
        }
      }
    }
    setLoading(false)
  }

  function abrirNovaCena() {
    setEditandoCena(null)
    setFormCena({ titulo:'', deixa:'', acao:'', fala:'', trilha_sonora:'' })
    setBlocos([])
    setCenaPersonagens([])
    setCenaObjetos([])
    setCenaArq([])
    setModalCena(true)
  }

  function abrirEdicaoCena(c: Cena) {
    setEditandoCena(c)
    setFormCena({ titulo:c.titulo??'', deixa:c.deixa??'', acao:c.acao??'', fala:c.fala??'', trilha_sonora:c.trilha_sonora??'' })
    // Blocos: usa os salvos; senão constrói das colunas antigas
    const bl = Array.isArray(c.blocos) ? c.blocos : null
    setBlocos(bl && bl.length ? bl : blocosDoLegado(c))
    // Personagens: usa os salvos por cena; senão cai no personagem único antigo
    const pgs = Array.isArray(c.personagens) ? c.personagens : null
    setCenaPersonagens(pgs && pgs.length ? pgs : (c.personagem_id ? [{ personagem_id:c.personagem_id, person_ids: c.person_id ? [c.person_id] : [] }] : []))
    // Objetos: idem
    const objs = Array.isArray(c.objetos) ? c.objetos : null
    setCenaObjetos(objs && objs.length ? objs : (c.objeto_id ? [c.objeto_id] : []))
    setCenaArq([])
    setModalCena(true)
  }

  // --- Helpers dos blocos ---
  function addBloco(tipo: string) { setBlocos(prev => [...prev, { tipo, conteudo:'' }]) }
  function setBlocoTipo(i: number, tipo: string) { setBlocos(prev => prev.map((b,j)=> j===i ? {...b, tipo} : b)) }
  function setBlocoConteudo(i: number, conteudo: string) { setBlocos(prev => prev.map((b,j)=> j===i ? {...b, conteudo} : b)) }
  function removeBloco(i: number) { setBlocos(prev => prev.filter((_,j)=>j!==i)) }
  function moverBloco(i: number, dir: 'up'|'down') {
    setBlocos(prev => {
      const j = dir==='up' ? i-1 : i+1
      if (j<0 || j>=prev.length) return prev
      const n = [...prev]; const t = n[i]; n[i]=n[j]; n[j]=t; return n
    })
  }

  async function salvarCena(e: React.FormEvent) {
    e.preventDefault(); setSalvandoCena(true)
    const ordemNova = editandoCena?.ordem ?? (cenas.length > 0 ? Math.max(...cenas.map(c=>c.ordem))+1 : 1)
    
    // Colunas antigas: primeiro bloco de cada tipo vira texto puro (retrocompatível)
    const txtBloco = (tipo:string) => { const b = blocos.find(x=>x.tipo===tipo); return b ? stripHtml(b.conteudo)||null : null }
    const primPG  = cenaPersonagens[0]
    const primObj = cenaObjetos[0]
    const payload = {
      theater_id:id, ordem:ordemNova,
      titulo: formCena.titulo||null,
      deixa: txtBloco('deixa'),
      acao: txtBloco('acao'),
      fala: txtBloco('fala'),
      trilha_sonora: txtBloco('trilha'),
      personagem_id: primPG?.personagem_id||null,
      person_id: primPG?.person_ids[0]||null,
      objeto_id: primObj||null,
    }

    let cenaId: string
    if (editandoCena) {
      await supabase.from('teatro_cenas').update(payload).eq('id', editandoCena.id)
      cenaId = editandoCena.id
    } else {
      const { data } = await supabase.from('teatro_cenas').insert(payload).select().single()
      cenaId = data?.id
    }

    // Colunas novas (blocos + vários personagens/objetos) — resiliente: avisa se faltar sql/32
    if (cenaId) {
      const rNovo = await supabase.from('teatro_cenas')
        .update({ blocos: blocos, personagens: cenaPersonagens, objetos: cenaObjetos })
        .eq('id', cenaId)
      if (rNovo.error) toast.info('Rode o sql/32 para salvar as caixas e vários personagens por cena.')
    }

    // Sync elenco: remove old, add all new
    if (cenaId) {
      // Collect all person-personagem pairs from this cena
      for (const cp of cenaPersonagens) {
        for (const pid of cp.person_ids) {
          const jaNoElenco = elenco.some(e=>e.person_id===pid && e.personagem_id===cp.personagem_id)
          if (!jaNoElenco) {
            await supabase.from('teatro_elenco').insert({ theater_id:id, person_id:pid, personagem_id:cp.personagem_id })
          }
        }
      }
    }

    // Arquivos da cena
    if (cenaId && cenaArq.length) { for (const f of cenaArq) await uploadArquivoCena(cenaId, f) }

    setModalCena(false); setSalvandoCena(false); setEditandoCena(null); setCenaArq([]); carregar()
  }

  async function excluirCena(cenaId: string) {
    if (!confirm('Excluir esta cena?')) return
    await supabase.from('teatro_cenas').delete().eq('id', cenaId)
    carregar()
  }

  async function moverCena(cenaId: string, dir: 'up'|'down') {
    const idx   = cenas.findIndex(c=>c.id===cenaId)
    const outro = dir==='up' ? cenas[idx-1] : cenas[idx+1]
    if (!outro) return
    const atual = cenas[idx]
    await Promise.all([
      supabase.from('teatro_cenas').update({ordem:outro.ordem}).eq('id',atual.id),
      supabase.from('teatro_cenas').update({ordem:atual.ordem}).eq('id',outro.id),
    ])
    carregar()
  }

  async function removerDoElenco(id: string) {
    if (!confirm('Remover do elenco?')) return
    await supabase.from('teatro_elenco').delete().eq('id', id)
    carregar()
  }

  async function salvarMidia(e: React.FormEvent) {
    e.preventDefault()
    const url = formMidia.url.trim()
    if (!url) return
    setSalvandoMidia(true)
    const { error } = await supabase.from('teatro_midias').insert({
      theater_id: id, tipo: formMidia.tipo, titulo: formMidia.titulo.trim() || null, url,
    })
    setSalvandoMidia(false)
    if (error) { toast.falha('Não foi possível salvar.', error); return }
    setModalMidia(false); setFormMidia({ tipo:'foto', titulo:'', url:'' }); carregar(); toast.sucesso('Salvo!')
  }

  async function excluirMidia(midiaId: string) {
    if (!confirm('Excluir esta mídia? (o arquivo na nuvem não é afetado)')) return
    await supabase.from('teatro_midias').delete().eq('id', midiaId)
    setMidias(prev => prev.filter(m => m.id !== midiaId))
  }

  // --- Helpers para cenaPersonagens ---
  function addPersonagem() {
    setCenaPersonagens(prev => [...prev, { personagem_id:'', person_ids:[] }])
  }
  function removePersonagem(idx: number) {
    setCenaPersonagens(prev => prev.filter((_,i)=>i!==idx))
  }
  function setPersonagemId(idx: number, pgId: string) {
    setCenaPersonagens(prev => prev.map((cp,i)=>i===idx?{...cp,personagem_id:pgId,person_ids:[]}:cp))
  }
  function addAtor(idx: number, personId: string) {
    setCenaPersonagens(prev => prev.map((cp,i)=>i===idx?{...cp,person_ids:[...cp.person_ids,personId]}:cp))
  }
  function removeAtor(idx: number, personId: string) {
    setCenaPersonagens(prev => prev.map((cp,i)=>i===idx?{...cp,person_ids:cp.person_ids.filter(p=>p!==personId)}:cp))
  }
  function addObjeto(objetoId: string) {
    if (!cenaObjetos.includes(objetoId)) setCenaObjetos(prev=>[...prev,objetoId])
  }
  function removeObjeto(objetoId: string) {
    setCenaObjetos(prev=>prev.filter(o=>o!==objetoId))
  }

  function getPessoa(pid:string|null) { return pid ? pessoas.find(p=>p.id===pid) : null }
  function getPersonagem(pgid:string|null) { return pgid ? personagens.find(p=>p.id===pgid) : null }
  function getObjeto(oid:string|null) { return oid ? objetos.find(o=>o.id===oid) : null }

  useRegistrarChrome({ impressoes:[{ label:'Imprimir este teatro', onClick:()=>setImprimir(true) }] }, [])

  if (loading) return <div className="page"><div className="skeleton" style={{height:120,borderRadius:14}}/></div>
  if (!teatro) return <div className="page"><div className="alert-box alert-error">Teatro não encontrado.</div></div>

  const cor = teatro.cor || 'var(--primary)'

  return (
    <div className="page">
      {/* Header — capa de fundo (se houver) por baixo da cor */}
      <div style={{
        position:'relative', borderRadius:14, padding:'16px 20px', marginBottom:16, color:'white', overflow:'hidden',
        background: teatro.capa_url
          ? `linear-gradient(0deg, ${cor}E6, ${cor}99), url(${teatro.capa_url}) center/cover`
          : cor,
      }}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:teatro.descricao?8:0}}>
          <div style={{width:48,height:48,borderRadius:'50%',background:teatro.foto_url?'#eee':'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:26,overflow:'hidden'}}>
            {teatro.foto_url
              ? <img src={teatro.foto_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : <span>{teatro.emoji || '🎭'}</span>}
          </div>
          <div>
            <p style={{fontSize:18,fontWeight:800}}>{teatro.nome}</p>
            {teatro.local && <p style={{fontSize:13,opacity:0.85}}>{teatro.local}</p>}
          </div>
        </div>
        {teatro.descricao && <p style={{fontSize:13,opacity:0.85,lineHeight:1.6}}>{teatro.descricao}</p>}
      </div>

      {/* Ministração vinculada - clicável */}
      {ministracao && (
        <button onClick={()=>navigate('/ministracoes/'+ministracao.id)} style={{width:'100%',background:'#F3F0FF',border:'1px solid #D6BCFA',borderRadius:12,padding:'12px 14px',marginBottom:14,cursor:'pointer',fontFamily:'inherit',textAlign:'left',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <p style={{fontSize:10,fontWeight:700,color:'#6B46C1',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Ministração vinculada</p>
            <p style={{fontWeight:700,fontSize:14,color:'#44337A'}}>{ministracao.titulo}</p>
            {ministrante && <p style={{fontSize:12,color:'#6B46C1',marginTop:2}}>Ministrante: {ministrante.name}</p>}
          </div>
          <MatIcon name="chevron_right" size={18} color="#6B46C1"/>
        </button>
      )}

      <div className="tabs mb-4">
        <button className={`tab ${aba==='cenas'?'active':''}`} onClick={()=>setAba('cenas')}>Cenas ({cenas.length})</button>
        <button className={`tab ${aba==='elenco'?'active':''}`} onClick={()=>setAba('elenco')}>Elenco ({elenco.length})</button>
        <button className={`tab ${aba==='midia'?'active':''}`} onClick={()=>setAba('midia')}>Mídia ({midias.length})</button>
        <button className={`tab ${aba==='arquivos'?'active':''}`} onClick={()=>setAba('arquivos')}>Arquivos</button>
      </div>

      {/* CENAS */}
      {aba==='cenas' && (
        <>
          {cenas.length===0 ? (
            <div className="empty">
              <div className="empty-icon"><MatIcon name="format_list_numbered" size={28} color="var(--muted-light)"/></div>
              <p className="empty-title">Nenhuma cena</p>
              <p className="empty-desc">Adicione as cenas desta peça de teatro.</p>
            </div>
          ) : cenas.map((c,i) => {
            const blocosView = (Array.isArray(c.blocos) && c.blocos.length) ? c.blocos : blocosDoLegado(c)
            const pgsView: CenaPersonagem[] = (Array.isArray(c.personagens) && c.personagens.length)
              ? c.personagens
              : (c.personagem_id ? [{ personagem_id:c.personagem_id, person_ids: c.person_id ? [c.person_id] : [] }] : [])
            const objsView: string[] = (Array.isArray(c.objetos) && c.objetos.length) ? c.objetos : (c.objeto_id ? [c.objeto_id] : [])
            const temConteudo = blocosView.length>0 || pgsView.length>0 || objsView.length>0
            return (
              <div key={c.id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,overflow:'hidden'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderBottom:temConteudo?'1px solid var(--border)':'none'}}>
                  <div style={{width:32,height:32,borderRadius:8,background:cor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'white',flexShrink:0}}>{c.ordem}</div>
                  <p style={{fontWeight:700,fontSize:14,flex:1}}>{c.titulo ?? `Cena ${c.ordem}`}</p>
                  {canEdit && (
                    <div style={{display:'flex',gap:4}}>
                      {i>0 && <button onClick={()=>moverCena(c.id,'up')} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="arrow_upward" size={14}/></button>}
                      {i<cenas.length-1 && <button onClick={()=>moverCena(c.id,'down')} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="arrow_downward" size={14}/></button>}
                      <button onClick={()=>abrirEdicaoCena(c)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="edit" size={14}/></button>
                      <button onClick={()=>excluirCena(c.id)} style={{background:'var(--danger-bg)',border:'none',borderRadius:6,width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="delete" size={14} color="var(--danger)"/></button>
                    </div>
                  )}
                </div>
                {temConteudo && (
                  <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',gap:8}}>
                    {blocosView.map((b,bi)=>{
                      const info = infoBloco(b.tipo)
                      if (b.tipo==='foto') return b.conteudo ? <img key={bi} src={b.conteudo} alt="" style={{width:'100%',borderRadius:8,display:'block'}}/> : null
                      if (!b.conteudo) return null
                      return (
                        <div key={bi} style={{background:info.bg,borderRadius:8,padding:'8px 12px',borderLeft:`3px solid ${info.cor}`}}>
                          <p style={{fontSize:10,fontWeight:700,color:info.cor,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{info.label}</p>
                          <div style={{fontSize:13,lineHeight:1.55,color:'var(--text)'}} dangerouslySetInnerHTML={{__html:b.conteudo}}/>
                        </div>
                      )
                    })}
                    {pgsView.map((cp,pi)=>{
                      const pgp = getPersonagem(cp.personagem_id)
                      if (!pgp) return null
                      const nomes = cp.person_ids.map(pid=>getPessoa(pid)?.name).filter(Boolean)
                      return (
                        <div key={'pg'+pi} style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                          <MatIcon name="person" size={14} color="#6B46C1"/>
                          <p style={{fontSize:12,color:'#6B46C1',fontWeight:600}}>{pgp.nome}</p>
                          {nomes.length>0 && <p style={{fontSize:12,color:'var(--muted)'}}>— {nomes.join(', ')}</p>}
                        </div>
                      )
                    })}
                    {objsView.map((oid,oi)=>{ const o=getObjeto(oid); return o ? <div key={'ob'+oi} style={{display:'flex',alignItems:'center',gap:6}}><MatIcon name="inventory_2" size={14} color="var(--muted)"/><p style={{fontSize:12,color:'var(--muted)'}}>{o.nome}</p></div> : null })}
                  </div>
                )}
              </div>
            )
          })}
          {canEdit && <button className="fab" onClick={abrirNovaCena}><span className="icon">add</span></button>}
        </>
      )}

      {/* ELENCO */}
      {aba==='elenco' && (
        <>
          {elenco.length===0 ? (
            <div className="empty">
              <div className="empty-icon"><MatIcon name="group" size={28} color="var(--muted-light)"/></div>
              <p className="empty-title">Nenhum ator</p>
              <p className="empty-desc">Vincule pessoas ao criar ou editar cenas.</p>
            </div>
          ) : elenco.map(el => {
            const p  = getPessoa(el.person_id)
            const pg = getPersonagem(el.personagem_id)
            if (!p) return null
            return (
              <CardItem
                key={el.id}
                cor={cor}
                ehPessoa
                fotoUrl={p.photo_url}
                iniciais={getInitials(p.name)}
                titulo={p.name}
                extra={pg ? <span style={{fontSize:12,color:cor,fontWeight:600}}>{pg.nome}</span> : undefined}
                onExcluir={canEdit ? ()=>removerDoElenco(el.id) : undefined}
              />
            )
          })}
        </>
      )}

      {/* MÍDIA — fotos, áudios e vídeos por link de nuvem */}
      {aba==='midia' && (
        <>
          <div className="alert-box alert-info mb-3" style={{fontSize:12}}>
            As mídias ficam na sua nuvem (Google Drive, Mega, YouTube…). Aqui guardamos só o link — não ocupa espaço do sistema.
          </div>
          {midias.length===0 ? (
            <div className="empty">
              <div className="empty-icon"><MatIcon name="perm_media" size={28} color="var(--muted-light)"/></div>
              <p className="empty-title">Nenhuma mídia</p>
              <p className="empty-desc">Adicione fotos, áudios e vídeos por link.</p>
            </div>
          ) : midias.map(m => {
            const info = MIDIA_INFO[m.tipo]
            return (
              <div key={m.id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,overflow:'hidden'}}>
                {m.tipo==='foto' && (
                  <img src={m.url} alt={m.titulo??''} style={{width:'100%',maxHeight:220,objectFit:'cover',display:'block'}}
                    onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none'}}/>
                )}
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px'}}>
                  <div style={{width:36,height:36,borderRadius:9,background:cor+'22',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <MatIcon name={info.icone} size={20} color={cor}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontWeight:700,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.titulo || info.label}</p>
                    <p style={{fontSize:11,color:'var(--muted)'}}>{info.label}</p>
                  </div>
                  <a href={m.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{textDecoration:'none'}}>
                    <MatIcon name="open_in_new" size={15}/> Abrir
                  </a>
                  {canEdit && (
                    <button onClick={()=>excluirMidia(m.id)} style={{background:'var(--danger-bg)',border:'none',borderRadius:6,width:30,height:30,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>
                      <MatIcon name="delete" size={15} color="var(--danger)"/>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {canEdit && <button className="fab" onClick={()=>{setFormMidia({tipo:'foto',titulo:'',url:''});setModalMidia(true)}}><span className="icon">add</span></button>}
        </>
      )}

      {/* ARQUIVOS */}
      {aba==='arquivos' && eventId && id && (
        <ArquivosModulo eventId={eventId} modulo="teatro" referenciaId={id} pessoaId={null} titulo="Arquivos do teatro" />
      )}

      {/* MODAL MÍDIA */}
      {modalMidia && canEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModalMidia(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>Adicionar mídia</span>
              <button onClick={()=>setModalMidia(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <form onSubmit={salvarMidia}>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <div style={{display:'flex',gap:8}}>
                  {(['foto','audio','video'] as const).map(t => {
                    const on = formMidia.tipo===t
                    return (
                      <button key={t} type="button" onClick={()=>setFormMidia(f=>({...f,tipo:t}))}
                        style={{flex:1,padding:'10px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700,
                          border:on?`2px solid ${cor}`:'1px solid var(--border)',background:on?cor+'18':'white',color:on?cor:'var(--text2)',display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                        <MatIcon name={MIDIA_INFO[t].icone} size={20} color={on?cor:'var(--muted)'}/>{MIDIA_INFO[t].label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="form-group"><label className="form-label">Título (opcional)</label>
                <input className="form-input" value={formMidia.titulo} onChange={e=>setFormMidia(f=>({...f,titulo:e.target.value}))} placeholder="Ex: Trilha da cena final"/>
              </div>
              <div className="form-group"><label className="form-label">Link da nuvem <span className="req">*</span></label>
                <p className="form-hint mb-2">Cole o link do Google Drive, Mega, YouTube, Dropbox, etc.</p>
                <input className="form-input" value={formMidia.url} onChange={e=>setFormMidia(f=>({...f,url:e.target.value}))} placeholder="https://..." required/>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvandoMidia}>
                {salvandoMidia?'Salvando...':'Adicionar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CENA */}
      {modalCena && canEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModalCena(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'95vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editandoCena?`Editar Cena ${editandoCena.ordem}`:'Nova cena'}</span>
              <button onClick={()=>setModalCena(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <form onSubmit={salvarCena}>
              <div className="form-group"><label className="form-label">Título da cena</label>
                <input className="form-input" placeholder="Ex: A volta do filho pródigo" value={formCena.titulo} onChange={e=>setFormCena(f=>({...f,titulo:e.target.value}))}/>
              </div>
              {/* Caixas da cena — quantas quiser, cada uma com tipo + formatação */}
              <div className="form-group">
                <label className="form-label">Cena (caixas)</label>
                <p className="form-hint mb-2">Adicione caixas de Fala, Deixa, Ação… cada uma com sua formatação (negrito, cor). Colar de Word/Docs/site mantém o formato.</p>
                {blocos.map((b,i)=>{
                  const info = infoBloco(b.tipo)
                  return (
                    <div key={i} style={{marginBottom:12}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                        <select value={b.tipo} onChange={e=>setBlocoTipo(i,e.target.value)}
                          style={{background:info.bg,color:info.cor,border:'none',borderRadius:6,padding:'4px 8px',fontSize:11,fontWeight:800,fontFamily:'inherit',cursor:'pointer',textTransform:'uppercase'}}>
                          {TIPOS_BLOCO.map(t=><option key={t.tipo} value={t.tipo}>{t.label}</option>)}
                        </select>
                        <div style={{flex:1}}/>
                        <button type="button" onClick={()=>moverBloco(i,'up')} disabled={i===0} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,width:26,height:26,cursor:i===0?'default':'pointer',opacity:i===0?0.4:1,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="arrow_upward" size={14} color="var(--muted)"/></button>
                        <button type="button" onClick={()=>moverBloco(i,'down')} disabled={i===blocos.length-1} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,width:26,height:26,cursor:i===blocos.length-1?'default':'pointer',opacity:i===blocos.length-1?0.4:1,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="arrow_downward" size={14} color="var(--muted)"/></button>
                        <button type="button" onClick={()=>removeBloco(i)} style={{background:'var(--danger-bg)',border:'none',borderRadius:6,width:26,height:26,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><MatIcon name="delete" size={14} color="var(--danger)"/></button>
                      </div>
                      {b.tipo==='foto' ? (
                        b.conteudo ? (
                          <div style={{position:'relative'}}>
                            <img src={b.conteudo} alt="" style={{width:'100%',borderRadius:12,display:'block'}}/>
                            <button type="button" onClick={()=>setBlocoConteudo(i,'')} style={{position:'absolute',top:8,right:8,background:'rgba(0,0,0,0.55)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
                          </div>
                        ) : (
                          <UploadFoto bucket="team-photos" path={'teatro-cena-'+Date.now()} currentUrl={null} onUpload={(url:string)=>setBlocoConteudo(i,url)} label="Enviar foto"/>
                        )
                      ) : (
                        <RichEditor value={b.conteudo} onChange={html=>setBlocoConteudo(i,html)} minHeight={64} placeholder={`Escreva a ${info.label.toLowerCase()}…`}/>
                      )}
                    </div>
                  )
                })}
                <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginTop:4}}>
                  <span style={{fontSize:12,color:'var(--muted)',width:'100%',marginBottom:2}}>+ Adicionar caixa:</span>
                  {TIPOS_BLOCO.map(t=>(
                    <button type="button" key={t.tipo} onClick={()=>addBloco(t.tipo)}
                      style={{border:'1px dashed var(--border)',borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:700,color:'var(--text2)',background:'white',cursor:'pointer',fontFamily:'inherit'}}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* PERSONAGENS - ilimitados */}
              <div style={{height:1,background:'var(--border)',margin:'4px 0 16px'}}/>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <p style={{fontSize:13,fontWeight:700}}>Personagens desta cena</p>
                <button type="button" onClick={addPersonagem} style={{background:'var(--primary-light)',color:'var(--primary)',border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
                  <span className="icon icon-sm">add</span> Personagem
                </button>
              </div>

              {cenaPersonagens.map((cp,idx) => {
                const pg = personagens.find(p=>p.id===cp.personagem_id)
                return (
                  <div key={idx} style={{background:'var(--bg)',borderRadius:12,padding:'12px 14px',marginBottom:10,border:'1px solid var(--border)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                      <div style={{flex:1}}>
                        <label className="form-label" style={{marginBottom:4}}>Personagem</label>
                        <Seletor titulo="Personagem" placeholder="Selecionar personagem" value={cp.personagem_id} onChange={v=>setPersonagemId(idx,v)}
                          opcoes={[{value:'',label:'Selecionar personagem'}, ...personagens.map(p=>({value:p.id,label:`${p.nome}${p.multiplo?' (múltiplo)':''}`}))]}/>
                      </div>
                      <button type="button" onClick={()=>removePersonagem(idx)} style={{background:'var(--danger-bg)',color:'var(--danger)',border:'none',borderRadius:8,padding:'6px',cursor:'pointer',fontFamily:'inherit',marginTop:20,flexShrink:0}}>
                        <span className="icon icon-sm">delete</span>
                      </button>
                    </div>

                    {cp.personagem_id && (
                      <>
                        <label className="form-label" style={{marginBottom:6}}>
                          {pg?.multiplo ? 'Atores (múltiplos permitidos)' : 'Ator'}
                        </label>
                        {/* Atores já adicionados */}
                        {cp.person_ids.map(pid => {
                          const p = getPessoa(pid)
                          return (
                            <div key={pid} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                              <div style={{width:28,height:28,borderRadius:'50%',background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                                {p?.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:11,fontWeight:700,color:'white'}}>{getInitials(p?.name??'?')}</span>}
                              </div>
                              <span style={{flex:1,fontSize:13,fontWeight:600}}>{p?.name}</span>
                              <button type="button" onClick={()=>removeAtor(idx,pid)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
                            </div>
                          )
                        })}
                        {/* Adicionar ator */}
                        {(pg?.multiplo || cp.person_ids.length===0) && (
                          <div style={{marginTop:4}}>
                            <PersonSelect
                              pessoas={pessoas.filter(p=>!cp.person_ids.includes(p.id))}
                              value=""
                              onChange={pid=>{ if(pid) addAtor(idx,pid) }}
                              placeholder="Adicionar ator..."
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}

              {/* OBJETOS - ilimitados */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,marginTop:4}}>
                <p style={{fontSize:13,fontWeight:700}}>Objetos / Figurinos</p>
                <div style={{flex:1,marginLeft:12}}>
                  <Seletor titulo="Adicionar objeto" placeholder="+ Adicionar objeto" value="" onChange={v=>{ if(v) addObjeto(v) }}
                    opcoes={objetos.filter(o=>!cenaObjetos.includes(o.id)).map(o=>({value:o.id,label:o.nome}))}/>
                </div>
              </div>
              {cenaObjetos.length>0 && (
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                  {cenaObjetos.map(oid=>{
                    const obj=getObjeto(oid)
                    return obj ? (
                      <div key={oid} style={{display:'flex',alignItems:'center',gap:4,background:'var(--bg)',borderRadius:8,padding:'4px 10px',border:'1px solid var(--border)'}}>
                        <span style={{fontSize:13}}>{obj.nome}</span>
                        <button type="button" onClick={()=>removeObjeto(oid)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-light)',padding:0,fontFamily:'inherit'}}><span className="icon" style={{fontSize:14}}>close</span></button>
                      </div>
                    ) : null
                  })}
                </div>
              )}

              {/* Arquivos da cena */}
              <div style={{marginTop:4,marginBottom:12}}>
                <label className="form-label" style={{marginBottom:6}}>Arquivos da cena (opcional)</label>
                <label className="btn btn-ghost btn-full" style={{cursor:'pointer',border:'1px dashed var(--accent)',color:'var(--accent)'}}>
                  <MatIcon name="upload_file" size={16} color="var(--accent)"/> Escolher arquivo(s)
                  <input type="file" multiple style={{display:'none'}} onChange={e=>{const fs=Array.from(e.target.files??[]); if(fs.length) setCenaArq(prev=>[...prev,...fs]); e.target.value=''}}/>
                </label>
                {cenaArq.map((f,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,padding:'6px 10px',background:'var(--bg)',borderRadius:8,marginTop:6}}>
                    <MatIcon name="description" size={16} color="var(--accent)"/>
                    <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</span>
                    <button type="button" onClick={()=>setCenaArq(prev=>prev.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',fontFamily:'inherit'}}><MatIcon name="close" size={16} color="var(--danger)"/></button>
                  </div>
                ))}
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={salvandoCena}>
                {salvandoCena?'Salvando...':editandoCena?'Salvar cena':'Adicionar cena'}
              </button>
            </form>
          </div>
        </div>
      )}

      {imprimir && teatro && (() => {
        const corHex = teatro.cor || '#6B46C1'
        return (
        <PrintOverlay titulo={`Teatro — ${teatro.nome}`} onClose={()=>setImprimir(false)}>
          {/* Cabeçalho estilo app (sem menus) */}
          <div style={{background:corHex,borderRadius:14,padding:'16px 20px',color:'white',marginBottom:14,display:'flex',alignItems:'center',gap:12,WebkitPrintColorAdjust:'exact',printColorAdjust:'exact'} as any}>
            <div style={{width:48,height:48,borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:26}}>🎭</div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:19,fontWeight:800,lineHeight:1.15}}>{teatro.nome}</p>
              {teatro.local && <p style={{fontSize:13,opacity:0.85}}>{teatro.local}</p>}
            </div>
          </div>
          {teatro.descricao && <p style={{fontSize:13,marginBottom:12,color:'#374151'}}>{teatro.descricao}</p>}
          {ministracao && (
            <div style={{background:'#F3F0FF',border:'1px solid #D6BCFA',borderRadius:12,padding:'10px 14px',marginBottom:12}}>
              <p style={{fontSize:10,fontWeight:700,color:'#6B46C1',textTransform:'uppercase',letterSpacing:'0.06em'}}>Ministração vinculada</p>
              <p style={{fontWeight:700,fontSize:14,color:'#44337A'}}>{ministracao.titulo}{ministrante?` · ${ministrante.name}`:''}</p>
            </div>
          )}

          {/* Aviso de mídia/arquivo antes das cenas */}
          {(midias.length>0 || arquivosCount>0) && (
            <p style={{fontSize:12,color:'#374151',background:'#f3f4f6',borderRadius:8,padding:'8px 12px',marginBottom:14}}>
              {midias.length>0 && <>📷 {midias.length} mídia(s) no app</>}
              {midias.length>0 && arquivosCount>0 && ' · '}
              {arquivosCount>0 && <>📎 {arquivosCount} arquivo(s) no app</>}
            </p>
          )}

          {/* Elenco com foto + nome + personagem */}
          {elenco.length>0 && (
            <>
              <h2 style={{fontSize:14,fontWeight:800,textTransform:'uppercase',color:'#374151',margin:'8px 0 8px',borderBottom:'2px solid #111827',paddingBottom:4}}>Elenco ({elenco.length})</h2>
              <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:16}}>
                {elenco.map(el=>{
                  const p=getPessoa(el.person_id); const pg=getPersonagem(el.personagem_id)
                  if(!p) return null
                  return (
                    <div key={el.id} style={{width:88,textAlign:'center'}}>
                      <div style={{width:64,height:64,borderRadius:'50%',margin:'0 auto 4px',overflow:'hidden',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid #e5e7eb'}}>
                        {p.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontWeight:700,color:'#6b7280',fontSize:18}}>{getInitials(p.name)}</span>}
                      </div>
                      {pg && <p style={{fontSize:11,fontWeight:700,lineHeight:1.15}}>{pg.nome}</p>}
                      <p style={{fontSize:11,color:'#6b7280',lineHeight:1.15}}>{p.name}</p>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Cenas — estilo dos cards do app */}
          <h2 style={{fontSize:14,fontWeight:800,textTransform:'uppercase',color:'#374151',margin:'8px 0 8px',borderBottom:'2px solid #111827',paddingBottom:4}}>Cenas ({cenas.length})</h2>
          {cenas.map(c=>{
            const pg=getPersonagem(c.personagem_id); const pe=getPessoa(c.person_id); const obj=getObjeto(c.objeto_id)
            return (
              <div key={c.id} style={{border:'1px solid #e5e7eb',borderRadius:10,overflow:'hidden',marginBottom:10,breakInside:'avoid'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:(c.deixa||c.acao||c.fala||pg||obj||c.trilha_sonora)?'1px solid #eee':'none'}}>
                  <div style={{width:30,height:30,borderRadius:8,background:corHex,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'white',flexShrink:0,WebkitPrintColorAdjust:'exact',printColorAdjust:'exact'} as any}>{c.ordem}</div>
                  <p style={{fontWeight:700,fontSize:14}}>{c.titulo ?? `Cena ${c.ordem}`}</p>
                </div>
                {(c.deixa||c.acao||c.fala||pg||obj||c.trilha_sonora) && (
                  <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',gap:7}}>
                    {c.deixa && <div style={{background:'#FFF3E0',borderRadius:8,padding:'8px 12px',borderLeft:`3px solid ${corHex}`}}><p style={{fontSize:10,fontWeight:700,color:corHex,textTransform:'uppercase'}}>Deixa</p><p style={{fontSize:13}}>{c.deixa}</p></div>}
                    {c.acao && <p style={{fontSize:13}}><strong style={{color:'#6b7280'}}>AÇÃO </strong>{c.acao}</p>}
                    {c.fala && <p style={{fontSize:13,fontStyle:'italic'}}>"{c.fala}"</p>}
                    {pg && <p style={{fontSize:13,color:'#6B46C1',fontWeight:600}}>🎭 {pg.nome}{pe?` — ${pe.name}`:''}</p>}
                    {obj && <p style={{fontSize:13,color:'#6b7280'}}>📦 {obj.nome}</p>}
                    {c.trilha_sonora && <p style={{fontSize:13,color:'#6b7280'}}>🎵 {c.trilha_sonora}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </PrintOverlay>
        )
      })()}
    </div>
  )
}
