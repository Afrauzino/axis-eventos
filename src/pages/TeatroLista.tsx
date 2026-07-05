import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SubTabs from '../components/SubTabs'
import EmojiGrid from '../components/EmojiGrid'
import Seletor from '../components/Seletor'
import { toast } from '../components/Toast'
import CardItem from '../components/CardItem'
import { isAdmin } from '../utils'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import type { Profile } from '../App'

type Teatro     = { id:string; nome:string; descricao:string|null; data_hora:string|null; local:string|null; status:string; cor:string|null; ministracao_id:string|null; emoji?:string|null }
type Ministracao = { id:string; titulo:string }

const CORES = ['#E8821A','#6B46C1','#2F855A','#C53030','#2B6CB0','#D53F8C','#00A99D','#1A202C','#D69E2E','#C05621']
const STATUS_LABEL: Record<string,string> = { planejamento:'Planejamento', ensaio:'Ensaio', pronto:'Pronto', concluido:'Concluido' }
const STATUS_BADGE: Record<string,string> = { planejamento:'badge-neutral', ensaio:'badge-info', pronto:'badge-success', concluido:'badge-success' }

export default function TeatroLista({ profile }: { profile?: Profile }) {
  const navigate = useNavigate()
  const { evento, loading: evLoading } = useEvento()
  const [lista, setLista]       = useState<Teatro[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState<Teatro|null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')
  const [busca, setBusca]       = useState('')
  const [ministracoes, setMinistracoes] = useState<Ministracao[]>([])
  const [form, setForm] = useState({ nome:'', descricao:'', cor:'#E8821A', ministracao_id:'', emoji:'🎭' })
  const [arqPend, setArqPend] = useState<File[]>([]) // arquivos escolhidos ao criar/editar

  const { pode } = usePermissao(profile ?? null)
  // Admin OU liberação (individual/equipe) "ver e editar Teatro" na tela do Admin
  const canEdit = (!!profile && isAdmin(profile.user_role)) || pode('teatro','editar')

  // Envia um arquivo para o storage e registra em arquivos_modulo
  async function uploadArquivo(modulo:string, refId:string, file:File) {
    const ext = file.name.split('.').pop()
    const path = `${modulo}/${refId}/${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`
    const { error } = await supabase.storage.from('arquivos').upload(path, file, { upsert:true })
    if (error) return
    const { data:u } = supabase.storage.from('arquivos').getPublicUrl(path)
    await supabase.from('arquivos_modulo').insert({ event_id: evento!.id, modulo, referencia_id: refId, nome:file.name, url:u.publicUrl, tipo:file.type, tamanho:file.size })
  }

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [th, mi] = await Promise.all([
      supabase.from('theaters').select('*').eq('event_id', evento.id).order('nome'),
      supabase.from('ministrações').select('id,titulo').eq('event_id', evento.id).order('titulo'),
    ])
    setLista(th.data ?? [])
    setMinistracoes(mi.data ?? [])
    setLoading(false)
  }

  function abrirNovo() {
    setEditando(null)
    setForm({ nome:'', descricao:'', cor:'#E8821A', ministracao_id:'', emoji:'🎭' })
    setArqPend([]); setErro(''); setModal(true)
  }

  async function mudarStatusTeatro(id: string, statusAtual: string) {
    // Concluir teatro é SÓ pela tela de Cronograma. Aqui o clique só avança
    // ensaio (planejamento → ensaio → pronto) e não chega em "concluído".
    if (statusAtual === 'concluido') { toast.info('A conclusão do teatro é feita pela tela de Cronograma.'); return }
    const ordem = ['planejamento','ensaio','pronto']
    const idx   = ordem.indexOf(statusAtual)
    const prox  = ordem[(idx + 1) % ordem.length]
    await supabase.from('theaters').update({ status: prox }).eq('id', id)
    setLista(prev => prev.map(t => t.id===id ? {...t, status:prox} : t))
  }

  function abrirEdicao(t: Teatro) {
    setEditando(t)
    setForm({ nome:t.nome, descricao:t.descricao??'', cor:t.cor??'#E8821A', ministracao_id:(t as any).ministracao_id??'', emoji:t.emoji??'🎭' })
    setArqPend([]); setErro(''); setModal(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true)
    if (!evento || !form.nome.trim()) { setErro('Nome obrigatorio.'); setSalvando(false); return }
    const payload = { nome: form.nome, descricao: form.descricao||null, cor: form.cor }
    let err
    let teatroId = editando?.id
    if (editando) { const r=await supabase.from('theaters').update(payload).eq('id',editando.id); err=r.error }
    else { const r=await supabase.from('theaters').insert({...payload,event_id:evento.id,status:'planejamento'}).select('id').single(); err=r.error; teatroId=r.data?.id }
    if (err) { setErro('Erro: '+err.message); setSalvando(false); return }
    // emoji separado (resiliente — funciona mesmo antes de rodar o SQL da coluna)
    if (teatroId) await supabase.from('theaters').update({ emoji: form.emoji||null }).eq('id', teatroId)
    if (teatroId && arqPend.length) { for (const f of arqPend) await uploadArquivo('teatro', teatroId, f) }
    setModal(false); setSalvando(false); setEditando(null); setArqPend([]); carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este teatro? Todas as cenas e elenco serao removidos.')) return
    await supabase.from('theaters').delete().eq('id', id)
    setModal(false); carregar()
  }

  const filtrados = lista.filter(t => !busca || t.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="page">
      <SubTabs group="teatro"/>
      <div className="search-bar mb-3">
        <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
        <input placeholder="Buscar teatro..." value={busca} onChange={e=>setBusca(e.target.value)}/>
      </div>

      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:8,borderRadius:14}}/>) :
      filtrados.length===0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>theater_comedy</span></div>
          <p className="empty-title">Nenhum teatro</p>
          <p className="empty-desc">Cadastre os teatros deste evento.</p>
        </div>
      ) : filtrados.map(t => (
        <CardItem
          key={t.id}
          cor={t.cor || 'var(--primary)'}
          emoji={t.emoji || '🎭'}
          titulo={t.nome}
          subtitulo={t.descricao || undefined}
          direita={
            <button
              onClick={()=>mudarStatusTeatro(t.id,t.status)}
              className={`badge ${STATUS_BADGE[t.status]??'badge-neutral'}`}
              style={{fontSize:10,border:'none',cursor:'pointer',fontFamily:'inherit'}}
              title="Clique para avançar status"
            >{STATUS_LABEL[t.status]??t.status}</button>
          }
          onVer={()=>navigate('/teatro/'+t.id)}
          onEditar={canEdit ? ()=>abrirEdicao(t) : undefined}
        />
      ))}

      {canEdit && <button className="fab" onClick={abrirNovo}><span className="icon">add</span></button>}

      {modal && canEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0 16px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?'Editar teatro':'Novo teatro'}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Nome do teatro <span className="req">*</span></label>
                <input className="form-input" placeholder="Ex: O Filho Prodigo" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} required/>
              </div>
              <div className="form-group"><label className="form-label">Descricao</label>
                <textarea className="form-textarea" value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} style={{minHeight:70}}/>
              </div>
              {/* Emoji do teatro */}
              <div className="form-group">
                <label className="form-label">Emoji do teatro</label>
                <EmojiGrid value={form.emoji} onChange={em=>setForm(f=>({...f,emoji:em}))}/>
              </div>

              {/* Cor do teatro */}
              <div className="form-group">
                <label className="form-label">Cor do teatro</label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',paddingTop:4,marginBottom:8}}>
                  {CORES.map(c=>(
                    <button key={c} type="button" onClick={()=>setForm(f=>({...f,cor:c}))} style={{width:34,height:34,borderRadius:8,background:c,border:'none',cursor:'pointer',boxShadow:form.cor===c?`0 0 0 3px white, 0 0 0 5px ${c}`:'none',transition:'box-shadow 0.15s'}}/>
                  ))}
                </div>
                {/* Cor livre */}
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:13,color:'var(--text2)'}}>Ou escolha:</span>
                  <input type="color" value={form.cor} onChange={e=>setForm(f=>({...f,cor:e.target.value}))} style={{width:40,height:36,borderRadius:8,border:'1px solid var(--border)',cursor:'pointer',padding:2}}/>
                  <div style={{width:36,height:36,borderRadius:8,background:form.cor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>
                    {form.emoji || '🎭'}
                  </div>
                </div>
              </div>

              {/* Ministração vinculada */}
              <div className="form-group">
                <label className="form-label">Ministração vinculada</label>
                <p className="form-hint mb-2">Ao vincular, teatro e ministração se abrem mutuamente.</p>
                <Seletor titulo="Ministração vinculada" placeholder="Nenhuma" value={form.ministracao_id} onChange={v=>setForm(f=>({...f,ministracao_id:v}))}
                  opcoes={[{value:'',label:'Nenhuma'}, ...ministracoes.map(m=>({value:m.id,label:m.titulo}))]}/>
              </div>

              {/* Arquivos (roteiro, trilha, etc.) */}
              <div className="form-group">
                <label className="form-label">Arquivos (opcional)</label>
                <label className="btn btn-ghost btn-full" style={{cursor:'pointer',border:'1px dashed var(--primary)',color:'var(--primary)'}}>
                  <span className="icon icon-sm">upload_file</span> Escolher arquivo(s)
                  <input type="file" multiple style={{display:'none'}} onChange={e=>{const fs=Array.from(e.target.files??[]); if(fs.length) setArqPend(prev=>[...prev,...fs]); e.target.value=''}}/>
                </label>
                {arqPend.length>0 && (
                  <div style={{marginTop:8}}>
                    {arqPend.map((f,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,padding:'6px 10px',background:'var(--bg)',borderRadius:8,marginBottom:4}}>
                        <span className="icon icon-sm" style={{color:'var(--primary)'}}>description</span>
                        <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</span>
                        <button type="button" onClick={()=>setArqPend(prev=>prev.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
                      </div>
                    ))}
                  </div>
                )}
                {editando && <p className="form-hint mt-1">Mais arquivos aparecem também dentro do teatro, na aba Arquivos.</p>}
              </div>

              {editando && (
                <button type="button" onClick={()=>excluir(editando.id)} style={{background:'var(--danger-bg)',color:'var(--danger)',border:'none',borderRadius:8,padding:'8px 14px',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',marginBottom:8,width:'100%'}}>
                  Excluir teatro
                </button>
              )}
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Salvando...':editando?'Salvar':'Criar teatro'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
