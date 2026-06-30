import { useRef, useEffect } from 'react'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  label?: string
}

const CORES = ['#000000','#C53030','#2F855A','#2B6CB0','#6B46C1','#D69E2E','#DD6B20','#718096']
const DESTAQUES = ['#FFF3CD','#D4EDDA','#CCE5FF','#F8D7DA','#E2D9F3','transparent']

export default function RichEditor({ value, onChange, placeholder = 'Digite aqui...', minHeight = 120, label }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isUpdating = useRef(false)
  // Save/restore selection so toolbar clicks don't lose cursor position
  const savedRange = useRef<Range|null>(null)

  useEffect(() => {
    if (!editorRef.current) return
    if (isUpdating.current) return
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])

  function saveSelection() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }

  function restoreSelection() {
    const sel = window.getSelection()
    if (sel && savedRange.current) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
    editorRef.current?.focus()
  }

  function exec(cmd: string, val?: string) {
    restoreSelection()
    document.execCommand(cmd, false, val)
    handleChange()
  }

  function handleChange() {
    isUpdating.current = true
    const html = editorRef.current?.innerHTML ?? ''
    onChange(html === '<br>' ? '' : html)
    setTimeout(() => { isUpdating.current = false }, 0)
  }

  function insertLink() {
    const url = prompt('URL do link:')
    if (url) exec('createLink', url)
  }

  function setFontSize(size: string) { exec('fontSize', size) }

  return (
    <div style={{border:'1.5px solid var(--border)',borderRadius:12,overflow:'hidden',background:'white'}}>
      {label && <label className="form-label" style={{padding:'8px 12px 0',display:'block'}}>{label}</label>}

      {/* Toolbar */}
      <div style={{display:'flex',flexWrap:'wrap',gap:2,padding:'8px 10px',borderBottom:'1px solid var(--border)',background:'var(--bg)'}}>
        {/* Formatação básica */}
        <ToolBtn onClick={()=>exec('bold')} title="Negrito"><strong>B</strong></ToolBtn>
        <ToolBtn onClick={()=>exec('italic')} title="Itálico"><em>I</em></ToolBtn>
        <ToolBtn onClick={()=>exec('underline')} title="Sublinhado"><u>U</u></ToolBtn>
        <ToolBtn onClick={()=>exec('strikeThrough')} title="Riscado"><s>S</s></ToolBtn>
        <Divider/>

        {/* Tamanho */}
        <ToolBtn onClick={()=>setFontSize('4')} title="Grande"><span style={{fontSize:16,lineHeight:1}}>A</span></ToolBtn>
        <ToolBtn onClick={()=>setFontSize('3')} title="Normal"><span style={{fontSize:13,lineHeight:1}}>A</span></ToolBtn>
        <ToolBtn onClick={()=>setFontSize('2')} title="Pequeno"><span style={{fontSize:11,lineHeight:1}}>A</span></ToolBtn>
        <Divider/>

        {/* Alinhamento */}
        <ToolBtn onClick={()=>exec('justifyLeft')}   title="Esquerda"><span className="icon" style={{fontSize:16}}>format_align_left</span></ToolBtn>
        <ToolBtn onClick={()=>exec('justifyCenter')} title="Centro"><span className="icon" style={{fontSize:16}}>format_align_center</span></ToolBtn>
        <ToolBtn onClick={()=>exec('justifyRight')}  title="Direita"><span className="icon" style={{fontSize:16}}>format_align_right</span></ToolBtn>
        <Divider/>

        {/* Listas */}
        <ToolBtn onClick={()=>exec('insertUnorderedList')} title="Lista"><span className="icon" style={{fontSize:16}}>format_list_bulleted</span></ToolBtn>
        <ToolBtn onClick={()=>exec('insertOrderedList')}   title="Numerada"><span className="icon" style={{fontSize:16}}>format_list_numbered</span></ToolBtn>
        <Divider/>

        {/* Cores do texto */}
        <div style={{display:'flex',gap:2,alignItems:'center'}}>
          {CORES.map(cor=>(
            <button type="button" key={cor} onMouseDown={e=>{e.preventDefault();exec('foreColor',cor)}}
              style={{width:18,height:18,borderRadius:3,background:cor,border:'1px solid var(--border)',cursor:'pointer',padding:0,flexShrink:0}}
              title={`Cor ${cor}`}
            />
          ))}
        </div>
        <Divider/>

        {/* Destaques */}
        <div style={{display:'flex',gap:2,alignItems:'center'}}>
          {DESTAQUES.map((cor,i)=>(
            <button type="button" key={i} onMouseDown={e=>{e.preventDefault();exec('hiliteColor',cor)}}
              style={{width:18,height:18,borderRadius:3,background:cor||'white',border:'1px solid var(--border)',cursor:'pointer',padding:0,flexShrink:0}}
              title={cor==='transparent'?'Sem destaque':'Destaque'}
            />
          ))}
        </div>
        <Divider/>

        {/* Limpar */}
        <ToolBtn onClick={()=>exec('removeFormat')} title="Limpar formatação"><span className="icon" style={{fontSize:16}}>format_clear</span></ToolBtn>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleChange}
        onBlur={saveSelection}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onKeyDown={e=>{ if(e.key==='Tab'){e.preventDefault();exec('insertHTML','&nbsp;&nbsp;&nbsp;&nbsp;')} }}
        data-placeholder={placeholder}
        style={{
          minHeight,
          padding:'12px 14px',
          outline:'none',
          fontSize:14,
          lineHeight:1.7,
          color:'var(--text)',
          wordBreak:'break-word',
        }}
      />
      <style>{`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: var(--muted-light); pointer-events: none; }
        [contenteditable] a { color: var(--primary); text-decoration: underline; }
      `}</style>
    </div>
  )
}

function ToolBtn({ onClick, title, children }: { onClick:()=>void; title:string; children:React.ReactNode }) {
  return (
    <button type="button" onMouseDown={e=>{e.preventDefault();onClick()}} title={title}
      style={{background:'none',border:'none',cursor:'pointer',padding:'3px 5px',borderRadius:4,fontSize:13,color:'var(--text)',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',minWidth:24,height:24}}
    >{children}</button>
  )
}
function Divider() {
  return <div style={{width:1,height:18,background:'var(--border)',margin:'0 2px',flexShrink:0}}/>
}
