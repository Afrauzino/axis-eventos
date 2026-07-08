import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import ArquivosModulo from '../components/ArquivosModulo'
import { toast } from '../components/Toast'
import { carregarConfig, salvarConfig } from '../lib/tema'
import { isAdmin } from '../utils'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Midia = { id:string; tipo:'foto'|'audio'|'video'; titulo:string|null; url:string }

const MIDIA_INFO: Record<string,{icone:string;label:string;emoji:string}> = {
  foto:  { icone:'photo',      label:'Foto',  emoji:'📷' },
  audio: { icone:'music_note', label:'Áudio', emoji:'🎵' },
  video: { icone:'movie',      label:'Vídeo', emoji:'🎬' },
}

// Extrai o ID da PASTA de um link do Google Drive (ou aceita o id colado direto)
function driveFolderId(raw: string): string | null {
  const s = (raw || '').trim()
  let m = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(s)
  if (m) return m[1]
  m = /[?&]id=([A-Za-z0-9_-]{10,})/.exec(s)
  if (m) return m[1]
  if (/^[A-Za-z0-9_-]{20,}$/.test(s)) return s
  return null
}

function MatIcon({ name, size=20, color='var(--text2)' }: { name:string; size?:number; color?:string }) {
  return <span style={{fontFamily:"'Material Symbols Outlined'",fontWeight:'normal',fontStyle:'normal',fontSize:size,lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',userSelect:'none',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",color}}>{name}</span>
}

export default function Midia({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [midias, setMidias]   = useState<Midia[]>([])
  const [aba, setAba]         = useState<'drive'|'midia'|'arquivos'>('drive')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  useVoltarFecha(modal, () => setModal(false))
  // Pasta do Google Drive (navegável) — por evento
  const [driveLink, setDriveLink]   = useState('')
  const [driveModal, setDriveModal] = useState(false)
  const [driveRascunho, setDriveRascunho] = useState('')
  const [driveGrid, setDriveGrid]   = useState(true)
  useVoltarFecha(driveModal, () => setDriveModal(false))
  const [form, setForm]       = useState<{tipo:'foto'|'audio'|'video';titulo:string;url:string}>({ tipo:'foto', titulo:'', url:'' })
  const [salvando, setSalvando] = useState(false)

  const canEdit = isAdmin(profile?.user_role)
  const cor = 'var(--primary)'

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const { data } = await supabase.from('midias').select('id,tipo,titulo,url').eq('event_id', evento.id).order('created_at')
    setMidias((data as Midia[]) ?? [])
    const dv = await carregarConfig('midia_drive:' + evento.id)
    setDriveLink(dv ?? '')
    setLoading(false)
  }

  async function salvarDrive() {
    if (!evento) return
    const link = driveRascunho.trim()
    if (link && !driveFolderId(link)) { toast.aviso('Link de pasta do Google Drive inválido. Cole o link de uma PASTA.'); return }
    await salvarConfig('midia_drive:' + evento.id, link)
    setDriveLink(link); setDriveModal(false)
    toast.sucesso(link ? 'Pasta atualizada!' : 'Pasta removida.')
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const url = form.url.trim()
    if (!url || !evento) return
    setSalvando(true)
    const { error } = await supabase.from('midias').insert({ event_id:evento.id, tipo:form.tipo, titulo:form.titulo.trim()||null, url })
    setSalvando(false)
    if (error) { toast.falha('Não foi possível salvar.', error); return }
    setModal(false); setForm({ tipo:'foto', titulo:'', url:'' }); carregar(); toast.sucesso('Salvo!')
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta mídia? (o arquivo na nuvem não é afetado)')) return
    await supabase.from('midias').delete().eq('id', id)
    setMidias(prev => prev.filter(m => m.id !== id))
  }

  if (evLoading || loading) return <div className="page">{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:10,borderRadius:14}}/>)}</div>
  if (!evento) return <div className="page"><div className="empty"><p className="empty-title">Nenhum evento ativo</p></div></div>

  return (
    <div className="page">
      <div className="tabs mb-4" style={{flexWrap:'wrap'}}>
        <button className={`tab ${aba==='drive'?'active':''}`} onClick={()=>setAba('drive')}>Pasta</button>
        <button className={`tab ${aba==='midia'?'active':''}`} onClick={()=>setAba('midia')}>Mídia ({midias.length})</button>
        <button className={`tab ${aba==='arquivos'?'active':''}`} onClick={()=>setAba('arquivos')}>Arquivos</button>
      </div>

      {/* PASTA DO GOOGLE DRIVE — navegável (entra em subpastas) */}
      {aba==='drive' && (() => {
        const fid = driveFolderId(driveLink)
        if (!fid) {
          return (
            <div className="empty">
              <div className="empty-icon"><MatIcon name="folder" size={28} color="var(--muted-light)"/></div>
              <p className="empty-title">Nenhuma pasta do Drive</p>
              <p className="empty-desc">{canEdit ? 'Defina uma pasta do Google Drive para navegar aqui como se fosse uma pasta.' : 'O administrador ainda não definiu a pasta.'}</p>
              {canEdit && <button className="btn btn-primary" style={{marginTop:12}} onClick={()=>{setDriveRascunho(driveLink);setDriveModal(true)}}>Definir pasta do Google Drive</button>}
            </div>
          )
        }
        return (
          <>
            <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap',alignItems:'center'}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setDriveGrid(g=>!g)}>
                <MatIcon name={driveGrid?'view_list':'grid_view'} size={15}/> {driveGrid?'Lista':'Grade'}
              </button>
              <a href={`https://drive.google.com/drive/folders/${fid}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{textDecoration:'none'}}>
                <MatIcon name="open_in_new" size={15}/> Abrir no Drive
              </a>
              {canEdit && <button className="btn btn-ghost btn-sm" onClick={()=>{setDriveRascunho(driveLink);setDriveModal(true)}}>
                <MatIcon name="edit" size={15}/> Trocar pasta
              </button>}
            </div>
            <iframe title="Google Drive" src={`https://drive.google.com/embeddedfolderview?id=${fid}#${driveGrid?'grid':'list'}`}
              style={{width:'100%',height:'72vh',border:'1px solid var(--border)',borderRadius:12,background:'white',display:'block'}} />
            <p style={{fontSize:11,color:'var(--muted)',marginTop:8,lineHeight:1.5}}>
              Navegue pelas pastas e subpastas como no Drive. A pasta precisa estar compartilhada como <b>"Qualquer pessoa com o link"</b>.
            </p>
          </>
        )
      })()}

      {/* MÍDIA — por link de nuvem */}
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
                  <div style={{width:36,height:36,borderRadius:9,background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:20,lineHeight:1}}>
                    {info.emoji}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontWeight:700,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.titulo || info.label}</p>
                    <p style={{fontSize:11,color:'var(--muted)'}}>{info.label}</p>
                  </div>
                  <a href={m.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{textDecoration:'none'}}>
                    <MatIcon name="open_in_new" size={15}/> Abrir
                  </a>
                  {canEdit && (
                    <button onClick={()=>excluir(m.id)} style={{background:'var(--danger-bg)',border:'none',borderRadius:6,width:30,height:30,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>
                      <MatIcon name="delete" size={15} color="var(--danger)"/>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {canEdit && <button className="fab" onClick={()=>{setForm({tipo:'foto',titulo:'',url:''});setModal(true)}}><span className="icon">add</span></button>}
        </>
      )}

      {/* ARQUIVOS */}
      {aba==='arquivos' && (
        <ArquivosModulo eventId={evento.id} modulo="midia" referenciaId={evento.id} pessoaId={null} titulo="Arquivos" />
      )}

      {/* MODAL ADICIONAR MÍDIA (janela flutuante padrão) */}
      {modal && canEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>Adicionar mídia</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <form onSubmit={salvar}>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <div style={{display:'flex',gap:8}}>
                  {(['foto','audio','video'] as const).map(t => {
                    const on = form.tipo===t
                    return (
                      <button key={t} type="button" onClick={()=>setForm(f=>({...f,tipo:t}))}
                        style={{flex:1,padding:'10px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700,border:on?`2px solid ${cor}`:'1px solid var(--border)',background:on?'var(--primary-light)':'white',color:on?cor:'var(--text2)',display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                        <span style={{fontSize:20,lineHeight:1}}>{MIDIA_INFO[t].emoji}</span>{MIDIA_INFO[t].label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="form-group"><label className="form-label">Título (opcional)</label>
                <input className="form-input" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} placeholder="Ex: Vídeo de abertura"/>
              </div>
              <div className="form-group"><label className="form-label">Link da nuvem <span className="req">*</span></label>
                <p className="form-hint mb-2">Cole o link do Google Drive, Mega, YouTube, Dropbox, etc.</p>
                <input className="form-input" value={form.url} onChange={e=>setForm(f=>({...f,url:e.target.value}))} placeholder="https://..." required/>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>{salvando?'Salvando...':'Adicionar'}</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL — definir pasta do Google Drive */}
      {driveModal && canEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setDriveModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 28px',maxWidth:480,width:'100%',margin:'0 auto',maxHeight:'88vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 16px'}}/>
            <p style={{fontSize:16,fontWeight:800,marginBottom:6}}>Pasta do Google Drive</p>
            <p className="form-hint mb-2" style={{lineHeight:1.6}}>
              No Google Drive: abra a pasta → <b>Compartilhar</b> → em "Acesso geral" escolha <b>"Qualquer pessoa com o link"</b> → <b>Copiar link</b>. Cole aqui embaixo.
            </p>
            <input className="form-input" value={driveRascunho} onChange={e=>setDriveRascunho(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..." autoFocus style={{marginBottom:8}}/>
            {driveRascunho.trim() && !driveFolderId(driveRascunho) && (
              <p style={{fontSize:12,color:'var(--danger)',marginBottom:8}}>Link inválido — precisa ser o link de uma PASTA do Drive.</p>
            )}
            <button className="btn btn-primary btn-full" onClick={salvarDrive} style={{marginBottom:8}}>Salvar</button>
            {driveLink && <button className="btn btn-ghost btn-full" style={{color:'var(--danger)'}} onClick={()=>setDriveRascunho('')}>Limpar</button>}
          </div>
        </div>
      )}
    </div>
  )
}
