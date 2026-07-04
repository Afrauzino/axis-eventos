import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from './Toast'

type Arquivo = { id:string; nome:string; url:string; tipo:string|null; created_at:string }

type Props = {
  eventId: string
  modulo: string          // 'ministracao' | 'teatro'
  referenciaId: string    // id da ministração ou teatro
  pessoaId?: string|null  // quem envia
  titulo?: string
}

export default function ArquivosModulo({ eventId, modulo, referenciaId, pessoaId, titulo='Arquivos' }: Props) {
  const [arquivos, setArquivos] = useState<Arquivo[]>([])
  const [uploadando, setUploadando] = useState(false)
  const [loading, setLoading] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { carregar() }, [referenciaId])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('arquivos_modulo')
      .select('id,nome,url,tipo,created_at')
      .eq('modulo', modulo).eq('referencia_id', referenciaId)
      .order('created_at', { ascending:false })
    setArquivos(data ?? [])
    setLoading(false)
  }

  async function subir(file: File) {
    setUploadando(true)
    const ext = file.name.split('.').pop()
    const path = `${modulo}/${referenciaId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('arquivos').upload(path, file, { upsert:true })
    if (error) { setUploadando(false); toast.falha('Não foi possível enviar o arquivo.', error); return }
    const { data:u } = supabase.storage.from('arquivos').getPublicUrl(path)
    const { data, error:dbErr } = await supabase.from('arquivos_modulo').insert({
      event_id: eventId, modulo, referencia_id: referenciaId,
      nome: file.name, url: u.publicUrl, tipo: file.type, tamanho: file.size, enviado_por: pessoaId ?? null,
    }).select().single()
    setUploadando(false)
    if (dbErr) { toast.falha('Não foi possível registrar o arquivo.', dbErr); return }
    if (data) setArquivos(prev => [data, ...prev])
  }

  async function excluir(arq: Arquivo) {
    if (!confirm(`Excluir "${arq.nome}"?`)) return
    await supabase.from('arquivos_modulo').delete().eq('id', arq.id)
    setArquivos(prev => prev.filter(a => a.id !== arq.id))
  }

  function iconePara(tipo: string|null): string {
    const t = (tipo||'').toLowerCase()
    if (t.includes('pdf')) return 'picture_as_pdf'
    if (t.includes('image')) return 'image'
    if (t.includes('video')) return 'movie'
    if (t.includes('audio')) return 'audic_file'
    if (t.includes('word')||t.includes('document')) return 'description'
    if (t.includes('sheet')||t.includes('excel')) return 'table_chart'
    return 'insert_drive_file'
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
        <p style={{fontSize:13,fontWeight:700}}>{titulo}</p>
        <span style={{fontSize:11,color:'var(--muted)'}}>{arquivos.length} arquivo(s)</span>
      </div>

      <input ref={fileRef} type="file" multiple style={{display:'none'}}
        onChange={async e=>{const fs=Array.from(e.target.files??[]); for(const f of fs){await subir(f)} e.target.value=''}}/>
      <button onClick={()=>fileRef.current?.click()} disabled={uploadando}
        style={{width:'100%',padding:'10px',background:'var(--bg)',color:'var(--primary)',border:'1px dashed var(--primary)',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginBottom:10}}>
        <span className="icon icon-sm" style={{color:'var(--primary)'}}>upload_file</span>
        {uploadando?'Enviando...':'Enviar arquivo(s)'}
      </button>

      {loading
        ? <div className="skeleton" style={{height:44,borderRadius:10}}/>
        : arquivos.length === 0
          ? <p style={{fontSize:12,color:'var(--muted)',textAlign:'center',padding:'10px'}}>Nenhum arquivo ainda</p>
          : arquivos.map(arq => (
            <div key={arq.id} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',background:'white',borderRadius:10,marginBottom:6,boxShadow:'var(--shadow-sm)'}}>
              <span className="icon" style={{color:'var(--primary)'}}>{iconePara(arq.tipo)}</span>
              <a href={arq.url} target="_blank" rel="noreferrer" style={{flex:1,fontSize:12,color:'var(--text)',textDecoration:'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{arq.nome}</a>
              <button onClick={()=>excluir(arq)} style={{background:'none',border:'none',cursor:'pointer',padding:2}}>
                <span className="icon" style={{fontSize:16,color:'var(--danger)'}}>delete</span>
              </button>
            </div>
          ))
      }
    </div>
  )
}
