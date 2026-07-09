import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { getInitials, fmtHora, fmtData, isAdmin, hasRole, toLocalInput } from '../utils'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import { toast } from '../components/Toast'
import Seletor from '../components/Seletor'
import CardItem from '../components/CardItem'
import FotoAmpliada from '../components/FotoAmpliada'
import PersonSelect from '../components/PersonSelect'
import RichEditor from '../components/RichEditor'
import ArquivosModulo from '../components/ArquivosModulo'
import PrintOverlay from '../components/PrintOverlay'
import EmojiGrid from '../components/EmojiGrid'
import type { Profile } from '../App'

type Ministracao = {
  id:string; titulo:string; ministrante_id:string|null
  hora_inicio:string; hora_fim:string
  local:string|null; tema:string|null; status:string
  conteudo_sermao:string|null        // texto do sermão (admin + líderes)
  conteudo_teatro:string|null        // texto do teatro vinculado
  continuacao_sermao:string|null     // continuação do sermão
  anotacoes_pessoais:string|null     // só o ministrante vê
  ordem?:number|null
}
type Pessoa = { id:string; name:string; photo_url:string|null; user_id?:string|null }

const STATUS_BADGE: Record<string,string> = { planejado:'badge-neutral', em_andamento:'badge-warning', concluido:'badge-success', cancelado:'badge-danger' }
const FORM_VAZIO = { titulo:'', ministrante_id:'', hora_inicio:'', hora_fim:'', local:'', conteudo_sermao:'', continuacao_sermao:'', anotacoes_pessoais:'', teatro_id:'', emoji:'', cor:'#6B46C1' }

// Bloco "Arquivo" (PDF/Word): conteudo guarda JSON {url, nome}
function arqInfo(conteudo:string){ try{ const o=JSON.parse(conteudo); return { url:o.url as string, nome:(o.nome as string)||'arquivo' } }catch{ return { url:conteudo, nome:'arquivo' } } }
function ehPdf(url:string){ return /\.pdf($|\?)/i.test(url||'') }
function iconeArq(nome:string){ const n=(nome||'').toLowerCase(); if(n.endsWith('.pdf'))return 'picture_as_pdf'; if(n.endsWith('.doc')||n.endsWith('.docx'))return 'description'; return 'insert_drive_file' }
const TIPOS_BLOCO = ['Esboço','Teatro','Continuação','Anotação pastoral','Oração','Referência bíblica','Outro']

export default function Ministracoes({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [mins, setMins]         = useState<Ministracao[]>([])
  const [pessoas, setPessoas]   = useState<Pessoa[]>([])
  const [loading, setLoading]   = useState(true)
  const [locais, setLocais]     = useState<{id:string;nome:string}[]>([])
  const [teatros, setTeatros]   = useState<{id:string;nome:string;ministracao_id:string|null;cor:string|null}[]>([])
  const [detalhe, setDetalhe]   = useState<Ministracao|null>(null)
  useVoltarFecha(!!detalhe, () => setDetalhe(null))
  const [abaDetalhe, setAbaDetalhe] = useState<'info'|'sermao'|'anotacoes'>('info')
  const [nota, setNota]         = useState('')          // rascunho das "Minhas notas"
  const [salvandoNota, setSalvandoNota] = useState(false)
  const [fotoAmpliada, setFotoAmpliada] = useState<string|null>(null)
  const [modal, setModal]       = useState(false)
  useVoltarFecha(modal, () => setModal(false))
  const [imprimir, setImprimir] = useState<Ministracao|null>(null)
  const [editando, setEditando] = useState<Ministracao|null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')
  const [form, setForm]         = useState({ ...FORM_VAZIO })
  const [abaForm, setAbaForm]   = useState<'basico'|'conteudo'>('basico')
  const [blocos, setBlocos]     = useState<{tipo:string;conteudo:string}[]>([])
  const [visor, setVisor]       = useState<{url:string;pdf:boolean}|null>(null)
  const blocoImgRef = useRef<HTMLInputElement>(null)
  const blocoArqRef = useRef<HTMLInputElement>(null)

  const { pode } = usePermissao(profile ?? null)
  // Admin OU liberação (individual/equipe) "ver e editar Ministrações" na tela do Admin
  const canEdit    = (!!profile && isAdmin(profile.user_role)) || pode('ministracoes','editar')
  const userId     = profile?.user_id
  const isLiderPlus = profile && hasRole(profile.user_role, 'lider')
  // #16 — Ministrante (cargo "Ministrante" = coordenador, e não admin): acesso mínimo.
  // Só vê a PRÓPRIA ministração + bloco de notas; entra só pelo Cronograma; ao sair volta pro Cronograma.
  const restrito   = profile?.user_role === 'coordenador' && !canEdit

  const { id: paramId } = useParams()
  const navigate = useNavigate()

  // MODO FOCO: pessoa comum (não admin/líder/liberado) abrindo UMA ministração por link
  // direto (ex.: clicou na ministração em "Minhas Atividades"). Abre só a dela, em tela
  // cheia, sem lista, e ao fechar SEMPRE volta pra Minhas Atividades.
  const modoFoco = !!paramId && !canEdit && !isLiderPlus

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  // #16 — ministrante nunca vê a lista geral: sem id na URL, volta pro cronograma
  useEffect(() => { if (restrito && !paramId) navigate('/cronograma', { replace: true }) }, [restrito, paramId])
  // Sincroniza o rascunho das "Minhas notas" ao abrir uma ministração
  useEffect(() => { setNota(detalhe?.anotacoes_pessoais ?? '') }, [detalhe?.id])
  // Fechar/voltar: no modo foco volta pra Minhas Atividades (sempre); restrito volta pro Cronograma.
  const fecharDetalhe = () => {
    if (modoFoco) { navigate('/minhas-atividades'); return }
    if (restrito) { navigate('/cronograma'); return }
    // Se abriu por link direto (ex: veio do Cronograma/Teatro), fechar volta pra origem
    if (paramId) { if (window.history.length > 1) navigate(-1); else navigate('/ministracoes'); return }
    setDetalhe(null)
  }

  // Auto-open ministração when navigating from cronograma
  useEffect(() => {
    if (paramId && mins.length > 0) {
      const m = mins.find(m => m.id === paramId)
      if (m) { setDetalhe(m); setAbaDetalhe('info') }
    }
  }, [paramId, mins])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [mi, pe, lo, te] = await Promise.all([
      supabase.from('ministrações').select('*').eq('event_id',evento.id).order('titulo'),
      supabase.from('people').select('id,name,photo_url,user_id,role_type').eq('event_id',evento.id).order('name'),
      supabase.from('locais').select('id,nome').eq('event_id',evento.id).order('nome'),
      supabase.from('theaters').select('id,nome,ministracao_id,cor').eq('event_id',evento.id).order('nome'),
    ])
    // Ordena por 'ordem' no cliente (nulos por último) — resiliente mesmo sem o sql/34
    const minsOrd = (mi.data ?? []).slice().sort((a:any,b:any)=>{
      const ao=a.ordem, bo=b.ordem
      if (ao==null && bo==null) return (a.titulo||'').localeCompare(b.titulo||'')
      if (ao==null) return 1
      if (bo==null) return -1
      return ao-bo
    })
    setMins(minsOrd)
    setPessoas(pe.data ?? [])
    setLocais(lo.data ?? [])
    setTeatros(te.data ?? [])
    setLoading(false)
  }

  async function mudarStatusMin(id: string, statusAtual: string) {
    // Concluir ministração é SÓ pela tela de Cronograma. Aqui o clique só alterna
    // planejado → em andamento → cancelado, sem passar por "concluído".
    if (statusAtual === 'concluido') { toast.info('A conclusão da ministração é feita pela tela de Cronograma.'); return }
    const ordem = ['planejado','em_andamento','cancelado']
    const idx   = ordem.indexOf(statusAtual)
    const prox  = ordem[(idx + 1) % ordem.length]
    await supabase.from('ministrações').update({ status: prox }).eq('id', id)
    setMins(prev => prev.map(m => m.id===id ? {...m, status:prox} : m))
    setDetalhe(prev => prev?.id===id ? {...prev, status:prox} : prev)
  }

  function getPessoa(id:string|null) { return id ? pessoas.find(p=>p.id===id) : null }

  // A pessoa logada é o MINISTRANTE desta ministração?
  // Se for, ela tem acesso total à PRÓPRIA ministração (conteúdo, arquivos, notas) — menos o teatro.
  function souMinistranteDe(m: { ministrante_id:string|null } | null) {
    if (!m || !userId) return false
    const p = getPessoa(m.ministrante_id)
    return !!p?.user_id && p.user_id === userId
  }

  function abrirNovo() {
    setEditando(null); setForm({...FORM_VAZIO}); setErro(''); setAbaForm('basico'); setBlocos([]); setModal(true)
  }

  function abrirEdicao(m:Ministracao) {
    setEditando(m)
    const teatroVinc = teatros.find(t=>t.ministracao_id===m.id)
    setForm({ titulo:m.titulo, ministrante_id:m.ministrante_id??'', hora_inicio:toLocalInput(m.hora_inicio), hora_fim:toLocalInput(m.hora_fim), local:m.local??'', conteudo_sermao:m.conteudo_sermao??'', continuacao_sermao:m.continuacao_sermao??'', anotacoes_pessoais:m.anotacoes_pessoais??'', teatro_id:teatroVinc?.id??'', emoji:(m as any).emoji??'', cor:(m as any).cor??'#6B46C1' })
    setErro(''); setAbaForm('basico')
    // Rebuild blocos from saved JSON or legacy fields
    let bl: {tipo:string;conteudo:string}[] = []
    if (m.conteudo_sermao) {
      try { bl = JSON.parse(m.conteudo_sermao) }
      catch { bl = [{tipo:'Esboço',conteudo:m.conteudo_sermao}] }
    }
    if (bl.length===0 && m.conteudo_teatro) bl.push({tipo:'Teatro',conteudo:m.conteudo_teatro})
    if (bl.length===0 && m.continuacao_sermao) bl.push({tipo:'Continuação',conteudo:m.continuacao_sermao})
    setBlocos(bl)
    setModal(true)
  }

  async function salvar(e:React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true)
    if (!evento||!form.titulo.trim()) { setErro('Título obrigatório.'); setSalvando(false); return }
    // #10 — a ministração não guarda mais agenda; mantemos um horário-base só pra não quebrar o banco
    // (colunas hora_inicio/hora_fim ainda são obrigatórias). O horário real fica no Cronograma.
    const base = (evento as any)?.start_date ? `${(evento as any).start_date}T09:00:00` : new Date().toISOString()
    const iso = (v:string, plus=0) => { const d = new Date(v); const ok = !isNaN(d.getTime()); const t = (ok ? d : new Date(base)).getTime() + plus; return new Date(t).toISOString() }
    const payload = {
      titulo:form.titulo, ministrante_id:form.ministrante_id||null,
      hora_inicio: iso(form.hora_inicio),
      hora_fim: iso(form.hora_fim || form.hora_inicio, 60*60*1000),
      local:form.local||null, status:'planejado', emoji:form.emoji||null, cor:form.cor||'#6B46C1',
      conteudo_sermao: blocos.length > 0 ? JSON.stringify(blocos) : null,
      conteudo_teatro: blocos.find(b=>b.tipo==='Teatro')?.conteudo||null,
      continuacao_sermao: blocos.find(b=>b.tipo==='Continuação')?.conteudo||null,
    }
    let err
    let minId = editando?.id
    if (editando) { const r=await supabase.from('ministrações').update(payload).eq('id',editando.id); err=r.error }
    else { const r=await supabase.from('ministrações').insert({...payload,event_id:evento.id}).select('id').single(); err=r.error; minId=r.data?.id }
    if (err) { setErro('Erro: '+err.message); setSalvando(false); return }
    // Sync teatro link — garante que só UM teatro fica vinculado.
    // Só o admin/liberado mexe no teatro; o ministrante NÃO altera o vínculo do teatro.
    if (minId && canEdit) {
      // primeiro desvincula QUALQUER teatro que esteja nesta ministração
      await supabase.from('theaters').update({ ministracao_id: null }).eq('ministracao_id', minId)
      // depois vincula só o escolhido (se houver)
      if (form.teatro_id) {
        await supabase.from('theaters').update({ ministracao_id: minId }).eq('id', form.teatro_id)
      }
    }
    setModal(false); setSalvando(false); setEditando(null); carregar()
  }

  async function excluir(id:string) {
    if (!confirm('Excluir esta ministração? Os teatros e itens do cronograma ligados a ela serão desvinculados.')) return
    // Remove os vínculos ANTES do delete — senão a chave estrangeira bloqueia a exclusão
    await supabase.from('theaters').update({ ministracao_id: null }).eq('ministracao_id', id)
    await supabase.from('cronograma_eventos').update({ ministracao_id: null }).eq('ministracao_id', id)
    const { error } = await supabase.from('ministrações').delete().eq('id', id)
    if (error) { toast.falha('Não foi possível excluir.', error); return }
    setDetalhe(null); carregar(); toast.sucesso('Excluído.')
  }

  // Reordenar ministrações (subir/descer) — grava a ordem de todas
  async function moverMin(id:string, dir:'up'|'down') {
    const arr = [...mins]
    const i = arr.findIndex(m => m.id === id)
    const j = dir === 'up' ? i - 1 : i + 1
    if (i < 0 || j < 0 || j >= arr.length) return
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
    setMins(arr.map((m, idx) => ({ ...m, ordem: idx })))
    await Promise.all(arr.map((m, idx) => supabase.from('ministrações').update({ ordem: idx }).eq('id', m.id)))
  }

  async function salvarAnotacoes(id:string, val:string) {
    setSalvandoNota(true)
    const { error } = await supabase.from('ministrações').update({anotacoes_pessoais:val}).eq('id',id)
    setSalvandoNota(false)
    if (error) { toast.falha('Não foi possível salvar as notas.', error); return }
    setDetalhe(prev => prev?.id===id ? {...prev, anotacoes_pessoais:val} : prev)
    setMins(prev => prev.map(m => m.id===id ? {...m, anotacoes_pessoais:val} : m))
    toast.sucesso('Notas salvas!')
  }

  const STATUS_LABEL: Record<string,string> = { planejado:'Planejado', em_andamento:'Em andamento', concluido:'Concluído', cancelado:'Cancelado' }

  // Ministrante comum (sem admin/líder/liberação) enxerga na lista SÓ a própria ministração.
  const listaVisivel = (canEdit || isLiderPlus) ? mins : mins.filter(m => souMinistranteDe(m))

  return (
    <div className="page">
      {modoFoco ? (
        // Só a ministração da pessoa, em tela cheia (o detalhe abre por cima). Sem lista.
        !detalhe ? [1,2].map(i=><div key={i} className="skeleton" style={{height:120,marginBottom:8,borderRadius:14}}/>) : null
      ) : restrito ? (
        <div className="empty" style={{textAlign:'center'}}>
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>event</span></div>
          <p className="empty-title">Abra sua ministração pelo Cronograma</p>
          <button className="btn btn-primary btn-sm" onClick={()=>navigate('/cronograma')}>Ir para o Cronograma</button>
        </div>
      ) : loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:8,borderRadius:14}}/>) :
      listaVisivel.length===0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>church</span></div>
          <p className="empty-title">Nenhuma ministração</p>
          {canEdit && <button className="btn btn-primary btn-sm" onClick={abrirNovo}>Cadastrar</button>}
        </div>
      ) : listaVisivel.map((m,i) => {
        const min = getPessoa(m.ministrante_id)
        return (
          <CardItem
            key={m.id}
            cor={(m as any).cor ?? '#6B46C1'}
            ehPessoa={!!min?.photo_url}
            emoji={min?.photo_url ? undefined : ((m as any).emoji || '🎤')}
            fotoUrl={min?.photo_url ?? null}
            titulo={m.titulo}
            subtitulo={`${min?.name??'Sem ministrante'}${m.local?` · ${m.local}`:''}`}
            direita={
              <button
                onClick={()=>mudarStatusMin(m.id,m.status)}
                className={`badge ${STATUS_BADGE[m.status]??'badge-neutral'}`}
                style={{fontSize:10,border:'none',cursor:'pointer',fontFamily:'inherit'}}
                title="Clique para avançar status"
              >{STATUS_LABEL[m.status]??m.status}</button>
            }
            onVer={()=>{setDetalhe(m);setAbaDetalhe('info')}}
            onFoto={()=>min?.photo_url && setFotoAmpliada(min.photo_url)}
            onEditar={canEdit ? ()=>abrirEdicao(m) : undefined}
            acoes={canEdit ? [
              ...(i>0 ? [{ label:'Mover para cima', icon:'arrow_upward', onClick:()=>moverMin(m.id,'up') }] : []),
              ...(i<listaVisivel.length-1 ? [{ label:'Mover para baixo', icon:'arrow_downward', onClick:()=>moverMin(m.id,'down') }] : []),
            ] : undefined}
            onExcluir={canEdit ? ()=>excluir(m.id) : undefined}
          />
        )
      })}

      {canEdit && <button className="fab" onClick={abrirNovo}><span className="icon">add</span></button>}

      <FotoAmpliada url={fotoAmpliada} onClose={()=>setFotoAmpliada(null)} />

      {/* ===== DETALHE ===== */}
      {detalhe && (() => {
        const min = getPessoa(detalhe.ministrante_id)
        const isEuMinistrant = !!min?.user_id && min.user_id === userId
        const canSeeConteudo = isLiderPlus || canEdit || isEuMinistrant

        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent: modoFoco ? 'flex-start' : 'flex-end'}} onClick={e=>e.target===e.currentTarget&&fecharDetalhe()}>
            <div style={{background:'white',borderRadius: modoFoco ? 0 : '20px 20px 0 0',maxHeight: modoFoco ? '100dvh' : '90vh',height: modoFoco ? '100dvh' : undefined,width:'100%',overflowY:'auto'}}>
              {modoFoco ? (
                <div style={{position:'sticky',top:0,zIndex:2,background:'white',display:'flex',alignItems:'center',gap:8,padding:'12px 16px',borderBottom:'1px solid var(--border)'}}>
                  <button onClick={fecharDetalhe} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 12px',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:13,display:'flex',alignItems:'center',gap:6}}>
                    <span className="icon icon-sm">arrow_back</span> Minhas Atividades
                  </button>
                </div>
              ) : (
                <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
              )}

              {/* Header roxo */}
              <div style={{background:(detalhe as any).cor??'#6B46C1',padding:'14px 20px',marginTop:8,color:'white'}}>
                <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',opacity:0.75,marginBottom:4}}>Ministração</p>
                <p style={{fontSize:17,fontWeight:800,marginBottom:2}}>{detalhe.titulo}</p>
                {detalhe.local && <p style={{fontSize:12,opacity:0.8}}>{detalhe.local}</p>}
              </div>

              {/* Abas do detalhe */}
              <div style={{display:'flex',borderBottom:'1px solid var(--border)',background:'white'}}>
                {[
                  {id:'info',    label:'Info'},
                  ...(canSeeConteudo?[{id:'sermao',  label:'Esboço'}]:[]),
                  ...(isEuMinistrant?[{id:'anotacoes',label:'Minhas notas'}]:[]),
                ].map(({id,label})=>(
                  <button key={id} type="button" onClick={()=>setAbaDetalhe(id as any)} style={{flex:1,padding:'10px 4px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:abaDetalhe===id?700:400,color:abaDetalhe===id?'#6B46C1':'var(--muted)',borderBottom:abaDetalhe===id?'2px solid #6B46C1':'2px solid transparent',transition:'all 0.15s'}}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{padding:'16px 20px 32px'}}>
                {abaDetalhe==='info' && (
                  <>
                    <div className="info-section mb-3">
                      {min && <div className="info-row"><span className="info-label">Ministrante</span>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:28,height:28,borderRadius:'50%',background:'#6B46C1',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                            {min.photo_url?<img src={min.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:11,fontWeight:700,color:'white'}}>{getInitials(min.name)}</span>}
                          </div>
                          <span className="info-value">{min.name}</span>
                        </div>
                      </div>}
                                            {!restrito && <div className="info-row">
                      <span className="info-label">Status</span>
                      <button
                        onClick={()=>mudarStatusMin(detalhe.id,detalhe.status)}
                        className={`badge ${STATUS_BADGE[detalhe.status]??'badge-neutral'}`}
                        style={{border:'none',cursor:'pointer',fontFamily:'inherit'}}
                        title="Clique para avançar status"
                      >{STATUS_LABEL[detalhe.status]??detalhe.status} ▶</button>
                    </div>}
                    </div>
                    {/* Teatro vinculado (ministrante restrito não navega pra fora) */}
                    {(() => {
                      const teatroLink = (restrito || modoFoco) ? null : teatros.find(t=>t.ministracao_id===detalhe.id)
                      return teatroLink ? (
                        <button onClick={()=>{ setDetalhe(null); navigate('/teatro/'+teatroLink.id) }} style={{width:'100%',background:teatroLink.cor?teatroLink.cor+'22':'#FFF3E0',border:`1px solid ${teatroLink.cor??'var(--accent)'}`,borderRadius:12,padding:'12px 14px',marginBottom:12,cursor:'pointer',fontFamily:'inherit',textAlign:'left',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <div>
                            <p style={{fontSize:10,fontWeight:700,color:teatroLink.cor??'var(--accent)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Teatro vinculado</p>
                            <p style={{fontWeight:700,fontSize:14}}>{teatroLink.nome}</p>
                          </div>
                          <span className="icon icon-sm" style={{color:teatroLink.cor??'var(--accent)'}}>chevron_right</span>
                        </button>
                      ) : null
                    })()}

                    {!restrito && (
                      <button className="btn btn-outline btn-full btn-sm" onClick={()=>setImprimir(detalhe)} style={{marginBottom:8}}>
                        <span className="icon icon-sm">print</span> Imprimir ministração
                      </button>
                    )}
                    {restrito && (
                      <button className="btn btn-primary btn-full btn-sm" onClick={()=>navigate('/cronograma')} style={{marginTop:8}}>
                        <span className="icon icon-sm">arrow_back</span> Voltar ao Cronograma
                      </button>
                    )}
                    {(canEdit || isEuMinistrant) && (
                      <div style={{display:'flex',gap:8}}>
                        <button className="btn btn-ghost" style={{flex:1}} onClick={()=>{setDetalhe(null);abrirEdicao(detalhe)}}>{canEdit ? 'Editar' : 'Editar minha ministração'}</button>
                        {canEdit && <button className="btn" style={{flex:1,background:'var(--danger-bg)',color:'var(--danger)',border:'none'}} onClick={()=>excluir(detalhe.id)}>Excluir</button>}
                      </div>
                    )}
                    {!canEdit && isEuMinistrant && (
                      <p style={{fontSize:11,color:'var(--muted)',textAlign:'center',marginTop:8}}>Você é o ministrante — pode editar o conteúdo, anexar arquivos e anotar. O teatro é gerenciado pela equipe de teatro.</p>
                    )}
                  </>
                )}

                {abaDetalhe==='sermao' && canSeeConteudo && (
                  <div>
                    <p style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>Conteúdo visível para líderes e administradores.</p>
                    {(() => {
                      if (!detalhe.conteudo_sermao) return <p style={{fontSize:13,color:'var(--muted)',fontStyle:'italic'}}>Nenhum conteúdo cadastrado.</p>
                      let bls: {tipo:string;conteudo:string}[] = []
                      try { bls = JSON.parse(detalhe.conteudo_sermao) } catch { bls = [{tipo:'Esboço',conteudo:detalhe.conteudo_sermao}] }
                      return bls.map((bl,i)=>(
                        <div key={i} style={{marginBottom:16}}>
                          <p style={{fontSize:11,fontWeight:700,color:'var(--primary)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>{bl.tipo}</p>
                          {bl.tipo==='Imagem'
                            ? <img src={bl.conteudo} alt="" onClick={()=>setVisor({url:bl.conteudo,pdf:false})} style={{width:'100%',borderRadius:8,display:'block',cursor:'zoom-in'}}/>
                            : bl.tipo==='Arquivo'
                              ? (()=>{ const a=arqInfo(bl.conteudo); const pdf=ehPdf(a.url); return (
                                  <button type="button" onClick={()=> pdf ? setVisor({url:a.url,pdf:true}) : window.open(a.url,'_blank')}
                                    style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'12px 14px',border:'1px solid var(--border)',borderRadius:10,background:'var(--bg)',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                                    <span className="icon" style={{color: pdf?'#C53030':'#2B6CB0',fontSize:26,flexShrink:0}}>{iconeArq(a.nome)}</span>
                                    <span style={{flex:1,minWidth:0,fontSize:14,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.nome}</span>
                                    <span className="icon icon-sm" style={{color:'var(--muted)'}}>{pdf?'open_in_full':'open_in_new'}</span>
                                  </button>) })()
                              : <div style={{fontSize:14,lineHeight:1.7,color:'var(--text)'}} dangerouslySetInnerHTML={{__html:bl.conteudo}}/>
                          }
                          {i<bls.length-1 && <div style={{height:1,background:'var(--border)',marginTop:16}}/>}
                        </div>
                      ))
                    })()}
                    {/* Arquivos só na edição/criação, não na visualização */}
                  </div>
                )}

                {abaDetalhe==='anotacoes' && isEuMinistrant && (
                  <div>
                    <p style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>Visíveis apenas para você.</p>
                    <RichEditor
                      value={nota}
                      onChange={setNota}
                      placeholder="Suas anotações privadas..."
                      minHeight={150}
                    />
                    <button className="btn btn-primary btn-full" style={{marginTop:12}}
                      disabled={salvandoNota || nota===(detalhe.anotacoes_pessoais??'')}
                      onClick={()=>salvarAnotacoes(detalhe.id, nota)}>
                      {salvandoNota ? 'Salvando...' : 'Salvar notas'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ===== MODAL CRIAR/EDITAR ===== */}
      {modal && (canEdit || (editando && souMinistranteDe(editando))) && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',maxHeight:'95vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px 14px',borderBottom:'1px solid var(--border)'}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?'Editar ministração':'Nova ministração'}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>

            <div style={{display:'flex',borderBottom:'1px solid var(--border)'}}>
              <button type="button" onClick={()=>setAbaForm('basico')} style={{flex:1,padding:'10px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:abaForm==='basico'?700:400,color:abaForm==='basico'?'#6B46C1':'var(--muted)',borderBottom:abaForm==='basico'?'2px solid #6B46C1':'2px solid transparent'}}>Básico</button>
              <button type="button" onClick={()=>setAbaForm('conteudo')} style={{flex:1,padding:'10px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:abaForm==='conteudo'?700:400,color:abaForm==='conteudo'?'#6B46C1':'var(--muted)',borderBottom:abaForm==='conteudo'?'2px solid #6B46C1':'2px solid transparent'}}>Conteúdo</button>
            </div>

            {erro && <div className="alert-box alert-error" style={{margin:'12px 20px 0'}}>{erro}</div>}

            <form onSubmit={salvar}>
              <div style={{padding:'16px 20px 32px'}}>
                {abaForm==='basico' ? (
                  <>
                    <div className="form-group"><label className="form-label">Título <span className="req">*</span></label>
                      <input className="form-input" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} required/>
                    </div>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Cor de identificação</label>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:6}}>
                          {['#6B46C1','#00A99D','#E8821A','#2F855A','#C53030','#2B6CB0','#D53F8C','#1A202C'].map(cor=>(
                            <button key={cor} type="button" onClick={()=>setForm(f=>({...f,cor}))} style={{width:28,height:28,borderRadius:6,background:cor,border:'none',cursor:'pointer',boxShadow:form.cor===cor?`0 0 0 3px white, 0 0 0 5px ${cor}`:'none',transition:'box-shadow 0.15s'}}/>
                          ))}
                        </div>
                        <input type="color" value={form.cor} onChange={e=>setForm(f=>({...f,cor:e.target.value}))} style={{width:40,height:32,borderRadius:6,border:'1px solid var(--border)',cursor:'pointer',padding:2}}/>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Emoji da ministração</label>
                        <EmojiGrid value={form.emoji} onChange={em=>setForm(f=>({...f,emoji:em}))}/>
                      </div>
                    </div>
                    <div className="form-group">
                      {/* #9 — só Encontreiros podem ser ministrantes */}
                      <PersonSelect label="Ministrante" pessoas={pessoas.filter((p:any)=>p.role_type==='worker')} value={form.ministrante_id} onChange={id=>setForm(f=>({...f,ministrante_id:id}))} placeholder="Buscar ministrante (encontreiro)..."/>
                    </div>
                    {/* #10 — Ministração não tem mais data/horário/duração. A agenda fica só no Cronograma. */}
                    <div className="alert-box mb-3" style={{fontSize:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px',color:'var(--muted)'}}>
                      🗓️ O horário desta ministração é definido no <b>Cronograma</b> (aqui é só o conteúdo).
                    </div>
                    <div className="form-group"><label className="form-label">Local</label>
                      <Seletor titulo="Local" placeholder="Selecionar local..." value={form.local} onChange={v=>setForm(f=>({...f,local:v}))}
                        opcoes={[{value:'',label:'Sem local'}, ...locais.map(l=>({value:l.nome,label:l.nome}))]}/>
                    </div>
                    {/* Vínculo teatro↔ministração agora é feito SÓ no Cronograma */}
                  </>
                ) : (
                  <>
                    {blocos.map((bloco,idx)=>(
                      <div key={idx} style={{marginBottom:16,border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'var(--bg)',borderBottom:'1px solid var(--border)'}}>
                          <span style={{flex:1,fontSize:13,fontWeight:700,color:'var(--primary)'}}>{bloco.tipo==='Imagem'?'🖼️ Imagem':bloco.tipo==='Arquivo'?'📎 Arquivo':bloco.tipo}</span>
                          {bloco.tipo!=='Imagem' && bloco.tipo!=='Arquivo' && (
                            <Seletor sheet compact titulo="Tipo do bloco"
                              value={bloco.tipo} onChange={v=>setBlocos(prev=>prev.map((b,i)=>i===idx?{...b,tipo:v}:b))}
                              opcoes={TIPOS_BLOCO.map(t=>({value:t, label:t}))}/>
                          )}
                          {idx>0 && <button type="button" onClick={()=>setBlocos(prev=>{const n=[...prev];[n[idx-1],n[idx]]=[n[idx],n[idx-1]];return n})} style={{background:'none',border:'none',cursor:'pointer',padding:2}} title="Subir"><span className="icon icon-sm" style={{color:'var(--muted)'}}>arrow_upward</span></button>}
                          {idx<blocos.length-1 && <button type="button" onClick={()=>setBlocos(prev=>{const n=[...prev];[n[idx+1],n[idx]]=[n[idx],n[idx+1]];return n})} style={{background:'none',border:'none',cursor:'pointer',padding:2}} title="Descer"><span className="icon icon-sm" style={{color:'var(--muted)'}}>arrow_downward</span></button>}
                          <button type="button" onClick={()=>setBlocos(prev=>prev.filter((_,i)=>i!==idx))} style={{background:'var(--danger-bg)',color:'var(--danger)',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'inherit'}}>Remover</button>
                        </div>
                        {bloco.tipo==='Imagem'
                          ? (bloco.conteudo
                              ? <img src={bloco.conteudo} alt="" style={{width:'100%',display:'block'}}/>
                              : <div style={{padding:16,textAlign:'center',color:'var(--muted)',fontSize:12}}>Imagem não carregada</div>)
                          : bloco.tipo==='Arquivo'
                            ? (()=>{ const a=arqInfo(bloco.conteudo); return (
                                <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px'}}>
                                  <span className="icon" style={{color: ehPdf(a.url)?'#C53030':'#2B6CB0',fontSize:26,flexShrink:0}}>{iconeArq(a.nome)}</span>
                                  <span style={{flex:1,minWidth:0,fontSize:14,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.nome}</span>
                                </div>) })()
                            : <RichEditor value={bloco.conteudo} onChange={v=>setBlocos(prev=>prev.map((b,i)=>i===idx?{...b,conteudo:v}:b))} placeholder="Escreva o conteúdo aqui..." minHeight={100}/>
                        }
                      </div>
                    ))}
                    <div style={{display:'flex',gap:8}}>
                      <button type="button" onClick={()=>setBlocos(prev=>[...prev,{tipo:'Esboço',conteudo:''}])} style={{flex:1,padding:'12px',border:'2px dashed var(--border)',borderRadius:12,background:'none',cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--primary)',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                        <span className="icon icon-sm">add</span> Texto
                      </button>
                      <button type="button" onClick={()=>blocoImgRef.current?.click()} style={{flex:1,padding:'12px',border:'2px dashed var(--border)',borderRadius:12,background:'none',cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--primary)',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                        <span className="icon icon-sm">image</span> Foto
                      </button>
                      <button type="button" onClick={()=>blocoArqRef.current?.click()} style={{flex:1,padding:'12px',border:'2px dashed var(--border)',borderRadius:12,background:'none',cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--primary)',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                        <span className="icon icon-sm">attach_file</span> Arquivo
                      </button>
                    </div>
                    <input ref={blocoArqRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple style={{display:'none'}} onChange={async e=>{
                      const fs=Array.from(e.target.files??[])
                      for(const f of fs){
                        const ext=f.name.split('.').pop()
                        const path=`ministracao/blocos/${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`
                        const {error}=await supabase.storage.from('arquivos').upload(path,f,{upsert:true})
                        if(!error){const {data:u}=supabase.storage.from('arquivos').getPublicUrl(path); setBlocos(prev=>[...prev,{tipo:'Arquivo',conteudo:JSON.stringify({url:u.publicUrl,nome:f.name})}])}
                        else toast.falha('Não foi possível enviar o arquivo.', error)
                      }
                      e.target.value=''
                    }}/>
                    <input ref={blocoImgRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={async e=>{
                      const fs=Array.from(e.target.files??[])
                      for(const f of fs){
                        const ext=f.name.split('.').pop()
                        const path=`ministracao/blocos/${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`
                        const {error}=await supabase.storage.from('arquivos').upload(path,f,{upsert:true})
                        if(!error){const {data:u}=supabase.storage.from('arquivos').getPublicUrl(path); setBlocos(prev=>[...prev,{tipo:'Imagem',conteudo:u.publicUrl}])}
                        else toast.falha('Não foi possível enviar a imagem.', error)
                      }
                      e.target.value=''
                    }}/>
                  </>
                )}
                <button type="submit" className="btn btn-primary btn-full" disabled={salvando} style={{marginTop:8}}>
                  {salvando?'Salvando...':editando?'Salvar':'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visor em tela cheia (imagem/PDF) */}
      {visor && (
        <div onClick={()=>setVisor(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:800,display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',justifyContent:'flex-end',padding:10}}>
            <button onClick={()=>setVisor(null)} style={{background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'50%',width:40,height:40,cursor:'pointer',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon">close</span></button>
          </div>
          <div style={{flex:1,minHeight:0,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 10px 10px'}} onClick={e=>e.stopPropagation()}>
            {visor.pdf
              ? <iframe src={visor.url} title="PDF" style={{width:'100%',height:'100%',border:'none',borderRadius:8,background:'white'}}/>
              : <img src={visor.url} alt="" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',borderRadius:8}}/>}
          </div>
        </div>
      )}

      {imprimir && (() => {
        const min = getPessoa(imprimir.ministrante_id)
        const cor = (imprimir as any).cor ?? '#6B46C1'
        let blocos: {tipo:string;conteudo:string}[] = []
        if (imprimir.conteudo_sermao) { try { blocos = JSON.parse(imprimir.conteudo_sermao) } catch { blocos = [{tipo:'Esboço',conteudo:imprimir.conteudo_sermao}] } }
        return (
          <PrintOverlay titulo={`Ministração — ${imprimir.titulo}`} onClose={()=>setImprimir(null)}>
            {/* Cabeçalho colorido igual ao app (sem a cara dentro) */}
            <div style={{background:cor,borderRadius:14,padding:'16px 20px',color:'white',marginBottom:14,WebkitPrintColorAdjust:'exact',printColorAdjust:'exact'} as any}>
              <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',opacity:0.8,marginBottom:4}}>Ministração</p>
              <p style={{fontSize:20,fontWeight:800,lineHeight:1.15}}>{imprimir.titulo}</p>
              {imprimir.local && <p style={{fontSize:13,opacity:0.9,marginTop:3}}>{imprimir.local}</p>}
            </div>
            {/* Linha "Ministrante" com a cara (igual à aba Info) */}
            {min && (
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',border:'1px solid #e5e7eb',borderRadius:10,padding:'12px 14px',marginBottom:16}}>
                <span style={{fontSize:13,color:'#6b7280',fontWeight:600}}>Ministrante</span>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:40,height:40,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:cor,display:'flex',alignItems:'center',justifyContent:'center',WebkitPrintColorAdjust:'exact',printColorAdjust:'exact'} as any}>
                    {min.photo_url ? <img src={min.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{fontSize:14,fontWeight:700,color:'white'}}>{getInitials(min.name)}</span>}
                  </div>
                  <span style={{fontSize:15,fontWeight:700}}>{min.name}</span>
                </div>
              </div>
            )}
            {blocos.length===0 ? <p style={{fontSize:13,color:'#6b7280',marginTop:12}}>Sem conteúdo cadastrado.</p> :
            blocos.map((bl,i)=>(
              <div key={i} style={{marginBottom:16}}>
                <p style={{fontSize:12,fontWeight:800,textTransform:'uppercase',color:'#374151',marginBottom:6}}>{bl.tipo}</p>
                {bl.tipo==='Imagem' ? <img src={bl.conteudo} alt="" style={{maxWidth:'100%'}}/>
                  : bl.tipo==='Arquivo' ? <p style={{fontSize:14}}>📎 {arqInfo(bl.conteudo).nome}</p>
                  : <div style={{fontSize:14,lineHeight:1.7}} dangerouslySetInnerHTML={{__html:bl.conteudo}}/>}
              </div>
            ))}
          </PrintOverlay>
        )
      })()}
    </div>
  )
}
