import type { ReactNode } from 'react'

/**
 * Overlay de impressão reutilizável: botão Imprimir/PDF + Fechar + CSS de impressão.
 * Use `className="print-break"` num elemento para forçar quebra de página depois dele.
 */
export default function PrintOverlay({ titulo, onClose, children }: { titulo?:string; onClose:()=>void; children:ReactNode }) {
  return (
    <div style={{position:'fixed',inset:0,background:'white',zIndex:1000,overflowY:'auto'}}>
      <style>{`
        /* #14 — preservar cores no PDF/impressão (barras coloridas, fundos, etc.) */
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        @media print { .no-print{display:none!important} @page{margin:10mm} body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important} }
        .print-break{break-after:page;page-break-after:always}
      `}</style>
      <div className="no-print" style={{display:'flex',gap:8,alignItems:'center',padding:'12px 16px',position:'sticky',top:0,background:'white',borderBottom:'1px solid #eee',zIndex:2}}>
        <button className="btn btn-primary btn-sm" onClick={()=>window.print()}><span className="icon icon-sm">print</span> Imprimir / Salvar PDF</button>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button>
        {titulo && <span style={{marginLeft:6,fontWeight:700,fontSize:14}}>{titulo}</span>}
        <span style={{flex:1}}/>
        <span style={{fontSize:11,color:'var(--muted)'}}>No diálogo, escolha "Salvar como PDF" para exportar.</span>
      </div>
      <div style={{padding:16,color:'#111827'}}>{children}</div>
    </div>
  )
}
