import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

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
  const radius = shape === 'circle' ? '50%' : '12px'

  async function upload(file: File) {
    setLoading(true); setErro('')
    const ext  = file.name.split('.').pop()
    const fullPath = `${path}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(fullPath, file, { upsert: true })
    if (error) {
      // Try creating bucket if not exists
      setErro('Erro ao enviar. Verifique se o bucket "' + bucket + '" existe no Supabase Storage.')
      setLoading(false); return
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath)
    onUpload(data.publicUrl)
    setLoading(false)
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
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => fileRef.current?.click()}
        disabled={loading}
      >
        <span className="icon icon-sm">photo_camera</span>
        {loading ? 'Enviando...' : label}
      </button>
      {erro && <p style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center' }}>{erro}</p>}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
    </div>
  )
}
