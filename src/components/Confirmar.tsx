/**
 * confirmar() — diálogo de confirmação no padrão AXIS (substitui o confirm() do navegador).
 * Uso (inclusive fora de componente), igual ao Toast:
 *   import { confirmar } from '../components/Confirmar'
 *   if (!(await confirmar({ titulo:'Excluir cadastro?', mensagem:'Não dá pra desfazer.', perigo:true }))) return
 *   // rápido (só título): if (!(await confirmar('Encerrar votação?'))) return
 * Basta ter <ConfirmHost/> montado uma vez no App. Se não houver host, cai no confirm nativo.
 */
import { useEffect, useState } from 'react'

export type ConfirmOpts = {
  titulo: string
  mensagem?: string
  confirmar?: string   // rótulo do botão de ação (padrão: perigo?'Excluir':'Confirmar')
  cancelar?: string    // rótulo do botão de cancelar (padrão: 'Cancelar')
  perigo?: boolean     // vermelho (exclusão / ação destrutiva)
  icone?: string       // Material Symbol (padrão: perigo?'delete':'help')
}
type Req = ConfirmOpts & { _resolve: (v: boolean) => void }

let listener: ((r: Req) => void) | null = null

export function confirmar(arg: string | ConfirmOpts): Promise<boolean> {
  const opts: ConfirmOpts = typeof arg === 'string' ? { titulo: arg } : arg
  return new Promise<boolean>(resolve => {
    if (!listener) {
      // Rede de segurança: sem host montado, usa o confirm nativo pra não travar.
      const txt = opts.titulo + (opts.mensagem ? '\n\n' + opts.mensagem : '')
      resolve(typeof window !== 'undefined' ? window.confirm(txt) : true)
      return
    }
    listener({ ...opts, _resolve: resolve })
  })
}

export function ConfirmHost() {
  const [req, setReq] = useState<Req | null>(null)
  useEffect(() => { listener = (r) => setReq(r); return () => { listener = null } }, [])
  if (!req) return null

  const perigo = !!req.perigo
  const corAcao = perigo ? 'var(--danger)' : 'var(--primary)'
  const icone = req.icone || (perigo ? 'delete' : 'help')
  const fechar = (v: boolean) => { req._resolve(v); setReq(null) }

  return (
    <div onClick={e => e.target === e.currentTarget && fechar(false)}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:950, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
      <div style={{ background:'white', borderRadius:'20px 20px 0 0', padding:'8px 22px calc(24px + env(safe-area-inset-bottom))', maxWidth:480, width:'100%', margin:'0 auto', textAlign:'center' }}>
        <div style={{ width:36, height:4, background:'var(--border)', borderRadius:2, margin:'12px auto 16px' }} />
        <div style={{ width:56, height:56, borderRadius:'50%', background:perigo?'var(--danger-bg)':'var(--primary-light)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
          <span className="icon" style={{ fontSize:26, color:corAcao }}>{icone}</span>
        </div>
        <p style={{ fontSize:18, fontWeight:800, color:'var(--text)', marginBottom: req.mensagem ? 6 : 20 }}>{req.titulo}</p>
        {req.mensagem && <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.5, marginBottom:20 }}>{req.mensagem}</p>}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => fechar(false)} className="btn btn-ghost" style={{ flex:1 }}>{req.cancelar || 'Cancelar'}</button>
          <button onClick={() => fechar(true)} className="btn" style={{ flex:1, background:corAcao, color:'white' }}>{req.confirmar || (perigo ? 'Excluir' : 'Confirmar')}</button>
        </div>
      </div>
    </div>
  )
}
