import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import RecortarFoto from './RecortarFoto'
import { pathOriginal, imagemCarrega, baixarImagem } from '../lib/foto'

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
  const [recorte, setRecorte] = useState<{ src: string; remoto: boolean; novo: boolean } | null>(null)
  const radius = shape === 'circle' ? '50%' : '12px'

  // Recebe o recorte (exibição) + a original inteira e envia.
  // novaOriginal=true (arquivo novo) grava a original; ao só reposicionar, mantém a original.
  async function enviar(blob: Blob, original: Blob | null, novaOriginal: boolean) {
    setLoading(true); setErro('')
    const fullPath = `${path}.jpg`
    const { error } = await supabase.storage.from(bucket).upload(fullPath, blob, { upsert: true, contentType: 'image/jpeg' })
    if (error) {
      setErro('Erro ao enviar. Verifique se o bucket "' + bucket + '" existe no Supabase Storage.')
      setLoading(false); return
    }
    if (novaOriginal && original) {
      await supabase.storage.from(bucket).upload(pathOriginal(fullPath), original, { upsert: true, contentType: 'image/jpeg' })
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath)
    // cache-bust: mesmo caminho reaproveitado → força a nova imagem a aparecer
    onUpload(`${data.publicUrl}?t=${Date.now()}`)
    setLoading(false)
  }

  // Escolheu um arquivo → abre o ajuste (não envia direto)
  function aoEscolher(file: File) {
    setErro('')
    setRecorte({ src: URL.createObjectURL(file), remoto: false, novo: true })
  }

  // Reenquadrar: abre a ORIGINAL (não o recorte). Se não houver original (foto antiga), usa a atual.
  async function reenquadrar() {
    const origUrl = supabase.storage.from(bucket).getPublicUrl(pathOriginal(`${path}.jpg`)).data.publicUrl + `?t=${Date.now()}`
    const temOrig = await imagemCarrega(origUrl)
    setRecorte({ src: temOrig ? origUrl : (currentUrl as string), remoto: true, novo: !temOrig })
  }

  async function baixarOriginal() {
    const origUrl = supabase.storage.from(bucket).getPublicUrl(pathOriginal(`${path}.jpg`)).data.publicUrl
    const temOrig = await imagemCarrega(origUrl)
    await baixarImagem(temOrig ? origUrl : (currentUrl as string), 'foto-original.jpg')
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
          <button type="button" className="btn btn-ghost btn-sm" onClick={reenquadrar}>
            <span className="icon icon-sm">crop</span> Reenquadrar
          </button>
        )}
        {currentUrl && !loading && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={baixarOriginal}>
            <span className="icon icon-sm">download</span> Baixar original
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
          onConfirm={(blob, original) => { const novo = recorte?.novo ?? false; fecharRecorte(); enviar(blob, original, novo) }}
        />
      )}
    </div>
  )
}
