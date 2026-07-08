import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useVoltarFecha } from '../hooks/useVoltarFecha'

/**
 * Overlay de impressão reutilizável: botão Imprimir/PDF + Fechar + CSS de impressão.
 * Use `className="print-break"` num elemento para forçar quebra de página depois dele.
 *
 * Impressão IDÊNTICA no celular e no PC: o conteúdo é renderizado via portal no
 * <body>, o app atrás é escondido na impressão, e o conteúdo é impresso numa
 * largura de página FIXA (190mm) — independente do tamanho do aparelho. Sem isso,
 * o celular imprimia na largura estreita da tela (layout diferente do PC).
 */
export default function PrintOverlay({ titulo, onClose, children }: { titulo?:string; onClose:()=>void; children:ReactNode }) {
  useVoltarFecha(true, onClose)  // voltar do celular fecha a impressão
  useEffect(() => {
    document.body.classList.add('print-overlay-open')
    return () => document.body.classList.remove('print-overlay-open')
  }, [])

  return createPortal(
    <div className="print-overlay" style={{position:'fixed',inset:0,background:'white',zIndex:1000,overflowY:'auto'}}>
      <style>{`
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        @media print {
          .no-print{display:none!important}
          @page{margin:10mm}
          body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
          /* imprime só o conteúdo do overlay, não o app que está atrás */
          body.print-overlay-open > #root{display:none!important}
          /* mesma impressão em qualquer aparelho: o overlay flui e o conteúdo tem largura fixa de página */
          .print-overlay{position:static!important;overflow:visible!important;height:auto!important}
          .print-content{width:190mm!important;max-width:190mm!important;margin:0 auto!important;padding:0!important}
        }
        .print-break{break-after:page;page-break-after:always}
      `}</style>
      <div className="no-print" style={{display:'flex',gap:8,alignItems:'center',padding:'12px 16px',position:'sticky',top:0,background:'white',borderBottom:'1px solid #eee',zIndex:2}}>
        <button className="btn btn-primary btn-sm" onClick={()=>window.print()}><span className="icon icon-sm">print</span> Imprimir / Salvar PDF</button>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button>
        {titulo && <span style={{marginLeft:6,fontWeight:700,fontSize:14}}>{titulo}</span>}
        <span style={{flex:1}}/>
        <span style={{fontSize:11,color:'var(--muted)'}}>No diálogo, escolha "Salvar como PDF" para exportar.</span>
      </div>
      <div className="print-content" style={{padding:16,color:'#111827'}}>{children}</div>
    </div>,
    document.body,
  )
}
