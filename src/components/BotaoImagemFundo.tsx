import { useRef, useState } from 'react'
import RecortarFoto from './RecortarFoto'

// Botão "Enviar imagem" que já abre o enquadramento (arrastar + zoom) e devolve
// um Blob JPEG pronto. Usado nos editores de plano de fundo dos blocos.
export default function BotaoImagemFundo({ onImagem, aspecto = 16 / 9, disabled, label = 'Enviar imagem' }:
  { onImagem: (blob: Blob) => void; aspecto?: number; disabled?: boolean; label?: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [src, setSrc] = useState<string | null>(null)

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={disabled}>
        <span className="icon icon-sm">image</span> {label}
      </button>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) setSrc(URL.createObjectURL(f)); e.target.value = '' }} />
      {src && (
        <RecortarFoto src={src} aspecto={aspecto} saida={1000} titulo="Enquadrar plano de fundo"
          onCancel={() => { URL.revokeObjectURL(src); setSrc(null) }}
          onConfirm={blob => { URL.revokeObjectURL(src); setSrc(null); onImagem(blob) }} />
      )}
    </>
  )
}
