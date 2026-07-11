// Galeria "Meus modelos" — tela cheia com miniaturas dos modelos salvos.
// Tirou os chips da barra de cima: agora o editor fica limpo.
//
// Ao tocar num modelo abre a folha de ações:
//   • Abrir para editar
//   • Substituir por este que estou editando
//   • Renomear
//   • Excluir
// Salvar um modelo NOVO é o botão "Salvar" do editor (nome novo = modelo novo),
// por isso aqui não há "Salvar como novo" nem "Modelo pronto" — seria repetido.
import { useState } from 'react'
import type { Documento } from './tipos'
import Miniatura from './render/Miniatura'

export type Modelo = { id: string; nome: string; doc: Documento }

const cm = (mm: number) => (mm / 10).toFixed(1).replace('.', ',').replace(',0', '')
const medida = (d: Documento) => `${cm(d.papel.largura)} × ${cm(d.papel.altura)} cm`
const nElementos = (d: Documento) => d.paginas.reduce((s, p) => s + p.elementos.length, 0)

type Props = {
  modelos: Modelo[]
  docAtual: Documento
  dados?: Record<string, any>
  podeEditar: boolean
  onAbrir: (m: Modelo) => void
  onSubstituir: (m: Modelo) => void
  onRenomear: (m: Modelo, nome: string) => void
  onExcluir: (m: Modelo) => void
  onZero: () => void
  onFechar: () => void
}

export default function GaleriaModelos({
  modelos, docAtual, dados, podeEditar,
  onAbrir, onSubstituir, onRenomear, onExcluir, onZero, onFechar,
}: Props) {
  const [aberto, setAberto] = useState<Modelo | null>(null)
  const [renomeando, setRenomeando] = useState(false)
  const [nome, setNome] = useState('')

  function fecharAcoes() { setAberto(null); setRenomeando(false) }

  const cardVazio = (icone: string, texto: string, onClick: () => void, destaque = false) => (
    <button type="button" onClick={onClick}
      style={{
        aspectRatio: '1', border: `1px dashed ${destaque ? 'var(--primary)' : 'var(--border)'}`,
        borderRadius: 12, background: 'white', cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
        color: destaque ? 'var(--primary)' : 'var(--muted)',
      }}>
      <span className="icon">{icone}</span>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{texto}</span>
    </button>
  )

  const acao = (icone: string, texto: string, onClick: () => void, perigo = false) => (
    <button type="button" onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
        border: `1px solid ${perigo ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 10,
        background: 'white', padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit',
        color: perigo ? 'var(--danger)' : 'var(--text)', fontSize: 14, fontWeight: 600,
      }}>
      <span className="icon icon-sm" style={{ color: perigo ? 'var(--danger)' : 'var(--primary)' }}>{icone}</span>
      {texto}
    </button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 350, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'white', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div>
          <p style={{ fontSize: 17, fontWeight: 800 }}>Meus modelos</p>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>{modelos.length} salvo(s)</p>
        </div>
        <button onClick={onFechar} aria-label="Fechar"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
          <span className="icon icon-sm">close</span>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14 }}>

          {podeEditar && cardVazio('note_add', 'Começar do zero', onZero, true)}

          {modelos.map(m => {
            const emUso = docAtual.id === m.id
            return (
              <button key={m.id} type="button" onClick={() => setAberto(m)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <div style={{
                  aspectRatio: '1', background: 'white', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: emUso ? '2px solid var(--primary)' : '1px solid var(--border)', overflow: 'hidden',
                }}>
                  <Miniatura doc={m.doc} dados={dados} lado={112} />
                </div>
                <p style={{ fontSize: 12.5, fontWeight: 700, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</p>
                <p style={{ fontSize: 11, color: 'var(--muted)' }}>{medida(m.doc)}{emUso ? ' · em uso' : ''}</p>
              </button>
            )
          })}
        </div>

        {modelos.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginTop: 22 }}>
            Nenhum modelo salvo ainda. Monte um e toque em <b>Salvar</b>, lá no editor.
          </p>
        )}
      </div>

      {/* Folha de ações do modelo tocado */}
      {aberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 360, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && fecharAcoes()}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 20px 28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 16px' }} />

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'white' }}>
                <Miniatura doc={aberto.doc} dados={dados} lado={64} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aberto.nome}</p>
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>{medida(aberto.doc)} · {nElementos(aberto.doc)} elemento(s)</p>
              </div>
            </div>

            {renomeando ? (
              <>
                <div className="form-group">
                  <label className="form-label">Novo nome</label>
                  <input className="form-input" autoFocus value={nome} onChange={e => setNome(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && nome.trim()) { onRenomear(aberto, nome.trim()); fecharAcoes() } }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setRenomeando(false)}>Voltar</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={!nome.trim()}
                    onClick={() => { onRenomear(aberto, nome.trim()); fecharAcoes() }}>Salvar nome</button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {acao(podeEditar?'edit':'visibility', podeEditar?'Abrir para editar':'Abrir para imprimir', () => { onAbrir(aberto); fecharAcoes() })}
                {podeEditar && acao('save_as', 'Substituir por este que estou editando', () => {
                  if (confirm(`Substituir "${aberto.nome}" pelo modelo aberto agora? O antigo será perdido.`)) { onSubstituir(aberto); fecharAcoes() }
                })}
                {podeEditar && acao('text_fields', 'Renomear', () => { setNome(aberto.nome); setRenomeando(true) })}
                {podeEditar && acao('delete', 'Excluir', () => {
                  if (confirm(`Excluir o modelo "${aberto.nome}"?`)) { onExcluir(aberto); fecharAcoes() }
                }, true)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
