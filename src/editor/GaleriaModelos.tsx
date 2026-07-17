// Galeria de modelos — cada usuário tem os SEUS + os COMPARTILHADOS pelos outros.
//   • Imprimir: qualquer um (direto, sem editar).
//   • Editar/renomear/substituir/excluir/compartilhar: só o DONO.
//   • Compartilhado de outra pessoa: imprime sempre; edita só com a SENHA.
import { useState } from 'react'
import { confirmar } from '../components/Confirmar'
import type { Documento } from './tipos'
import Miniatura from './render/Miniatura'

export type Modelo = {
  id: string; nome: string; doc: Documento
  compartilhado?: boolean; sou_dono?: boolean; tem_senha?: boolean
}

const cm = (mm: number) => (mm / 10).toFixed(1).replace('.', ',').replace(',0', '')
const medida = (d: Documento) => `${cm(d.papel.largura)} × ${cm(d.papel.altura)} cm`
const nElementos = (d: Documento) => d.paginas.reduce((s, p) => s + p.elementos.length, 0)

type Props = {
  modelos: Modelo[]
  docAtual: Documento
  modeloAtualId?: string
  dados?: Record<string, any>
  podeEditar: boolean
  onAbrir: (m: Modelo, senha?: string) => void
  onImprimir: (m: Modelo) => void
  onSubstituir: (m: Modelo) => void
  onRenomear: (m: Modelo, nome: string) => void
  onExcluir: (m: Modelo) => void
  onCompartilhar: (m: Modelo, compartilhado: boolean, senha: string) => void
  onChecarSenha: (m: Modelo, senha: string) => Promise<boolean>
  onZero: () => void
  onFechar: () => void
}

export default function GaleriaModelos({
  modelos, docAtual, modeloAtualId, dados, podeEditar,
  onAbrir, onImprimir, onSubstituir, onRenomear, onExcluir, onCompartilhar, onChecarSenha, onZero, onFechar,
}: Props) {
  const [aberto, setAberto] = useState<Modelo | null>(null)
  const [modo, setModo] = useState<'menu' | 'renomear' | 'compartilhar' | 'senha'>('menu')
  const [nome, setNome] = useState('')
  const [compOn, setCompOn] = useState(false)
  const [senha, setSenha] = useState('')
  const [erroSenha, setErroSenha] = useState('')
  const [verificando, setVerificando] = useState(false)

  function abrirSheet(m: Modelo) {
    setAberto(m); setModo('menu'); setNome(m.nome); setCompOn(!!m.compartilhado); setSenha(''); setErroSenha('')
  }
  function fecharAcoes() { setAberto(null); setModo('menu'); setErroSenha(''); setSenha('') }

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

  async function verificarSenha() {
    if (!aberto) return
    setVerificando(true); setErroSenha('')
    const ok = await onChecarSenha(aberto, senha)
    setVerificando(false)
    if (ok) { onAbrir(aberto, senha); fecharAcoes() }
    else setErroSenha('Senha incorreta. Peça a quem compartilhou.')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 350, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'white', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div>
          <p style={{ fontSize: 17, fontWeight: 800 }}>Modelos</p>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>{modelos.length} disponível(is) · seus + compartilhados</p>
        </div>
        <button onClick={onFechar} aria-label="Fechar"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
          <span className="icon icon-sm">close</span>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14 }}>

          {podeEditar && (
            <button type="button" onClick={onZero}
              style={{ aspectRatio: '1', border: '1px dashed var(--primary)', borderRadius: 12, background: 'white', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--primary)' }}>
              <span className="icon">note_add</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>Começar do zero</span>
            </button>
          )}

          {modelos.map(m => {
            const emUso = modeloAtualId === m.id
            const deOutro = m.sou_dono === false
            return (
              <div key={m.id} role="button" tabIndex={0} onClick={() => abrirSheet(m)}
                style={{ cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', position: 'relative' }}>
                <div style={{
                  aspectRatio: '1', background: 'white', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: emUso ? '2px solid var(--primary)' : '1px solid var(--border)', overflow: 'hidden',
                }}>
                  <Miniatura doc={m.doc} dados={dados} lado={112} />
                </div>
                {/* Selo de compartilhado */}
                {m.compartilhado && (
                  <span title={deOutro ? 'Compartilhado com você' : 'Você compartilhou'}
                    style={{ position: 'absolute', top: 6, left: 6, display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(14,19,27,.82)', color: 'white',
                      borderRadius: 8, padding: '3px 7px', fontSize: 10, fontWeight: 700 }}>
                    <span className="icon" style={{ fontSize: 12 }}>{m.tem_senha ? 'lock' : 'group'}</span>
                    {deOutro ? 'de outro' : 'seu'}
                  </span>
                )}
                {/* Imprimir direto */}
                <button type="button" title="Imprimir este modelo" aria-label="Imprimir"
                  onClick={e => { e.stopPropagation(); onImprimir(m) }}
                  style={{ position: 'absolute', top: 6, right: 6, width: 34, height: 34, borderRadius: 10, cursor: 'pointer',
                    background: 'var(--primary)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.25)', fontFamily: 'inherit' }}>
                  <span className="icon icon-sm">print</span>
                </button>
                <p style={{ fontSize: 12.5, fontWeight: 700, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</p>
                <p style={{ fontSize: 11, color: 'var(--muted)' }}>{medida(m.doc)}{emUso ? ' · em uso' : ''}</p>
              </div>
            )
          })}
        </div>

        {modelos.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginTop: 22 }}>
            Nenhum modelo ainda. Monte um e toque em <b>Salvar</b>, lá no editor.
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
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {medida(aberto.doc)} · {nElementos(aberto.doc)} elemento(s){aberto.sou_dono === false ? ' · de outra pessoa' : ''}
                </p>
              </div>
            </div>

            {modo === 'renomear' ? (
              <>
                <div className="form-group">
                  <label className="form-label">Novo nome</label>
                  <input className="form-input" autoFocus value={nome} onChange={e => setNome(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && nome.trim()) { onRenomear(aberto, nome.trim()); fecharAcoes() } }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModo('menu')}>Voltar</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={!nome.trim()}
                    onClick={() => { onRenomear(aberto, nome.trim()); fecharAcoes() }}>Salvar nome</button>
                </div>
              </>
            ) : modo === 'compartilhar' ? (
              <>
                <button type="button" onClick={() => setCompOn(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: '1px solid var(--border)', borderRadius: 10, background: 'white', padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
                  <span style={{ width: 42, height: 24, borderRadius: 99, background: compOn ? 'var(--primary)' : 'var(--border)', position: 'relative', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: 2, left: compOn ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
                  </span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>Compartilhar com todos</span>
                </button>
                {compOn && (
                  <div className="form-group">
                    <label className="form-label">Senha para editar</label>
                    <input className="form-input" type="text" value={senha} onChange={e => setSenha(e.target.value)}
                      placeholder={aberto.tem_senha ? '••••• (deixe vazio pra manter)' : 'Deixe em branco = só você edita'} />
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                      Quem tem a senha <b>edita</b>. Quem não tem, só <b>imprime</b>. Sem senha, só você edita.
                    </p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModo('menu')}>Voltar</button>
                  <button className="btn btn-primary" style={{ flex: 1 }}
                    onClick={() => { onCompartilhar(aberto, compOn, senha); fecharAcoes() }}>Salvar</button>
                </div>
              </>
            ) : modo === 'senha' ? (
              <>
                <div className="form-group">
                  <label className="form-label">Senha para editar</label>
                  <input className="form-input" type="password" autoFocus value={senha}
                    onChange={e => { setSenha(e.target.value); setErroSenha('') }}
                    onKeyDown={e => { if (e.key === 'Enter') verificarSenha() }} />
                  {erroSenha && <p style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 6 }}>{erroSenha}</p>}
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Este modelo é de outra pessoa. Sem a senha, você só imprime.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModo('menu')}>Voltar</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={verificando || !senha} onClick={verificarSenha}>
                    {verificando ? 'Conferindo...' : 'Editar'}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Imprimir — todo mundo */}
                <button type="button" onClick={() => { onImprimir(aberto); fecharAcoes() }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 'none', borderRadius: 10,
                    background: 'var(--primary)', color: 'white', padding: '13px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
                  <span className="icon icon-sm">print</span> Imprimir este modelo
                </button>

                {/* Dono: edição completa */}
                {podeEditar && aberto.sou_dono !== false && (
                  <>
                    {acao('edit', 'Abrir para editar', () => { onAbrir(aberto); fecharAcoes() })}
                    {acao('save_as', 'Substituir por este que estou editando', async () => {
                      if (await confirmar({ titulo: `Substituir "${aberto.nome}"?`, mensagem: 'Você substitui pelo modelo aberto agora. O antigo será perdido.', confirmar: 'Substituir' })) { onSubstituir(aberto); fecharAcoes() }
                    })}
                    {acao('text_fields', 'Renomear', () => { setNome(aberto.nome); setModo('renomear') })}
                    {acao(aberto.compartilhado ? 'group' : 'share', aberto.compartilhado ? 'Compartilhamento' : 'Compartilhar', () => { setCompOn(!!aberto.compartilhado); setSenha(''); setModo('compartilhar') })}
                    {acao('delete', 'Excluir', async () => {
                      if (await confirmar({ titulo: `Excluir o modelo "${aberto.nome}"?`, perigo: true })) { onExcluir(aberto); fecharAcoes() }
                    }, true)}
                  </>
                )}

                {/* Compartilhado de outra pessoa: editar só com senha */}
                {podeEditar && aberto.sou_dono === false && (
                  aberto.tem_senha
                    ? acao('lock_open', 'Editar (precisa de senha)', () => { setSenha(''); setErroSenha(''); setModo('senha') })
                    : <p style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '8px 4px' }}>
                        Só quem criou pode editar este modelo. Você pode imprimir.
                      </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
