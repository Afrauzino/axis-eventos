import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import RecortarFoto from './RecortarFoto'

type Props = {
  bucket: string
  path: string
  currentUrl?: string | null
  onUpload: (url: string) => void
  label?: string
  size?: number
  shape?: 'circle' | 'square'
}

export default function UploadFoto({ bucket, path, currentUrl, onUpload, label = 'Alterar foto', size = 80, shape = 'circle' }: Props) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro]       = useState('')
  const [recorte, setRecorte] = useState<{ src: string; remoto: boolean } | null>(null)
  const radius = shape === 'circle' ? '50%' : '12px'

  // Recebe o Blob já recortado (do RecortarFoto) e envia
  async function enviar(blob: Blob) {
    setLoading(true); setErro('')
    const fullPath = `${path}.jpg`
    const { error } = await supabase.storage.from(bucket).upload(fullPath, blob, { upsert: true, contentType: 'image/jpeg' })
    if (error) {
      setErro('Erro ao enviar. Verifique se o bucket "' + bucket + '" existe no Supabase Storage.')
      setLoading(false); return
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath)
    // cache-bust: mesmo caminho reaproveitado → força a nova imagem a aparecer
    onUpload(`${data.publicUrl}?t=${Date.now()}`)
    setLoading(false)
  }

  // Escolheu um arquivo → abre o ajuste (não envia direto)
  function aoEscolher(file: File) {
    setErro('')
    setRecorte({ src: URL.createObjectURL(file), remoto: false })
  }

  function fecharRecorte() {
    if (recorte && !recorte.remoto) { try { URL.revokeObjectURL(recorte.src) } catch {} }
    setRecorte(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div
        onClick={() => fileRef.current?.click()}
        style={{ width: size, height: size, borderRadius: radius, background: 'var(--primary-light)', border: '2px solid var(--border)', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}
      >
        {currentUrl
          ? <img src={currentUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span className="icon" style={{ color: 'var(--muted-light)', fontSize: 28 }}>add_photo_alternate</span>
        }
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={loading}>
          <span className="icon icon-sm">photo_camera</span>
          {loading ? 'Enviando...' : label}
        </button>
        {currentUrl && !loading && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRecorte({ src: currentUrl, remoto: true })}>
            <span className="icon icon-sm">crop</span> Reposicionar
          </button>
        )}
      </div>

      {erro && <p style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center' }}>{erro}</p>}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && aoEscolher(e.target.files[0])} />

      {recorte && (
        <RecortarFoto
          src={recorte.src}
          crossOrigin={recorte.remoto}
          onCancel={fecharRecorte}
          onConfirm={(blob) => { fecharRecorte(); enviar(blob) }}
        />
      )}
    </div>
  )
}
