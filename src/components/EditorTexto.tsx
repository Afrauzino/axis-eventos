import { useRef, useEffect } from 'react'

// Editor simples com NEGRITO e COR. Guarda o texto como HTML (usado na mensagem
// de reprovação de cadastro). É de uso do admin, então o HTML é confiável.
const CORES = ['#1A202C', '#C53030', '#2F855A', '#1565C0', '#6B46C1', '#E8821A']

export default function EditorTexto({ value, onChange, placeholder, minHeight = 130 }: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Só injeta o HTML quando vem de FORA (troca de modelo) — não a cada digitação (senão o cursor pula)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || ''
  }, [value])

  function cmd(comando: string, valor?: string) {
    ref.current?.focus()
    document.execCommand(comando, false, valor)
    onChange(ref.current?.innerHTML || '')
  }

  const btn: React.CSSProperties = { border: '1px solid var(--border)', background: 'white', borderRadius: 8, height: 32, minWidth: 32, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <button type="button" style={{ ...btn, fontWeight: 800 }} title="Negrito" onMouseDown={e => { e.preventDefault(); cmd('bold') }}>B</button>
        <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
        {CORES.map(c => (
          <button key={c} type="button" title="Cor do texto" onMouseDown={e => { e.preventDefault(); cmd('foreColor', c) }}
            style={{ ...btn, minWidth: 26, width: 26, background: c }} aria-label={`Cor ${c}`} />
        ))}
        <button type="button" style={{ ...btn, fontSize: 12, color: 'var(--muted)' }} title="Tirar formatação" onMouseDown={e => { e.preventDefault(); cmd('removeFormat') }}>limpar</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML || '')}
        data-placeholder={placeholder || 'Escreva a mensagem...'}
        style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', minHeight, fontSize: 14, lineHeight: 1.6, outline: 'none', background: 'white', whiteSpace: 'pre-wrap' }}
      />
      <style>{`[contenteditable][data-placeholder]:empty:before{content:attr(data-placeholder);color:var(--muted-light);}`}</style>
    </div>
  )
}
