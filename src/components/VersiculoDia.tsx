import { useEffect, useRef, useState } from 'react'
import { estiloFundo, medirAspecto, type BlocoFundo } from '../lib/blocoFundo'
import { carregarConfig, salvarConfig } from '../lib/tema'

// Versículo do dia — o admin pode DEFINIR/EDITAR um versículo fixo (config 'versiculo_dia').
// Se não houver um definido, rotaciona de forma determinística por dia (lista embutida).

const VERSICULOS: { t: string; r: string }[] = [
  { t: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.', r: 'João 3:16' },
  { t: 'O Senhor é o meu pastor; nada me faltará.', r: 'Salmos 23:1' },
  { t: 'Tudo posso naquele que me fortalece.', r: 'Filipenses 4:13' },
  { t: 'Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.', r: 'Salmos 37:5' },
  { t: 'Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus.', r: 'Isaías 41:10' },
  { t: 'Buscai primeiro o reino de Deus, e a sua justiça, e todas estas coisas vos serão acrescentadas.', r: 'Mateus 6:33' },
  { t: 'O choro pode durar uma noite, mas a alegria vem pela manhã.', r: 'Salmos 30:5' },
  { t: 'Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.', r: '1 Pedro 5:7' },
  { t: 'Em tudo dai graças, porque esta é a vontade de Deus em Cristo Jesus para convosco.', r: '1 Tessalonicenses 5:18' },
  { t: 'O Senhor é a minha força e o meu escudo; nele confiou o meu coração.', r: 'Salmos 28:7' },
  { t: 'Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.', r: 'Provérbios 3:5' },
  { t: 'Eu vim para que tenham vida e a tenham com abundância.', r: 'João 10:10' },
  { t: 'A minha graça te basta, porque o meu poder se aperfeiçoa na fraqueza.', r: '2 Coríntios 12:9' },
  { t: 'Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.', r: 'Mateus 11:28' },
  { t: 'Porque para Deus nada é impossível.', r: 'Lucas 1:37' },
  { t: 'Mas os que esperam no Senhor renovarão as suas forças; subirão com asas como águias.', r: 'Isaías 40:31' },
  { t: 'Seja forte e corajoso! Não se apavore, nem desanime, pois o Senhor, o seu Deus, estará com você por onde você andar.', r: 'Josué 1:9' },
  { t: 'Aquietai-vos e sabei que eu sou Deus.', r: 'Salmos 46:10' },
  { t: 'Se Deus é por nós, quem será contra nós?', r: 'Romanos 8:31' },
  { t: 'Alegrai-vos sempre no Senhor; outra vez digo: alegrai-vos.', r: 'Filipenses 4:4' },
  { t: 'Ainda que eu andasse pelo vale da sombra da morte, não temeria mal algum, porque tu estás comigo.', r: 'Salmos 23:4' },
]

function diaDoAno(): number {
  const agora = new Date()
  const inicio = new Date(agora.getFullYear(), 0, 0)
  const diff = agora.getTime() - inicio.getTime()
  return Math.floor(diff / 86400000)
}

export default function VersiculoDia({ fundo, onEditar, admin }: { fundo?: BlocoFundo; onEditar?: (aspecto: number) => void; admin?: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [custom, setCustom] = useState<{ t: string; r: string } | null>(null)
  const [modal, setModal] = useState(false)
  const [ft, setFt] = useState('')
  const [fr, setFr] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    carregarConfig('versiculo_dia').then(v => {
      if (v) { try { const o = JSON.parse(v); if (o?.t) setCustom({ t: o.t, r: o.r || '' }) } catch {} }
    })
  }, [])

  const v = custom ?? VERSICULOS[diaDoAno() % VERSICULOS.length]

  function abrir() { setFt(custom?.t ?? ''); setFr(custom?.r ?? ''); setModal(true) }
  async function salvar() {
    setSalvando(true)
    const novo = ft.trim() ? { t: ft.trim(), r: fr.trim() } : null
    await salvarConfig('versiculo_dia', novo ? JSON.stringify(novo) : '')
    setCustom(novo); setSalvando(false); setModal(false)
  }

  return (
    <div ref={cardRef} style={{ ...estiloFundo(fundo, 'linear-gradient(135deg,#4C51BF,#553C9A)'), borderRadius: 14, padding: '18px 18px 16px', marginBottom: 16, boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 7, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 16 }}>📖</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Versículo do dia</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {admin && (
            <button onClick={abrir} title="Escolher/editar versículo" style={{ background: 'rgba(255,255,255,0.22)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'inherit' }}>
              <span className="icon icon-sm">edit</span>
            </button>
          )}
          {onEditar && (
            <button onClick={() => onEditar(medirAspecto(cardRef.current))} title="Cor / imagem" style={{ background: 'rgba(255,255,255,0.22)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'inherit' }}>
              <span className="icon icon-sm">palette</span>
            </button>
          )}
        </div>
      </div>
      <p style={{ fontSize: 15, color: 'white', lineHeight: 1.5, fontStyle: 'italic' }}>"{v.t}"</p>
      {v.r && <p style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.9)', marginTop: 10, textAlign: 'right' }}>— {v.r}</p>}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 22px 28px', width: '100%', maxWidth: 480, margin: '0 auto' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 16px' }} />
            <p style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, color: 'var(--text)' }}>📖 Versículo do dia</p>
            <div className="form-group">
              <label className="form-label">Texto do versículo</label>
              <textarea className="form-input" value={ft} onChange={e => setFt(e.target.value)} rows={4} placeholder="Digite o versículo... (deixe vazio para voltar ao automático)" style={{ resize: 'vertical' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Referência</label>
              <input className="form-input" value={fr} onChange={e => setFr(e.target.value)} placeholder="Ex.: João 3:16" />
            </div>
            <button className="btn btn-primary btn-full" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : (ft.trim() ? 'Salvar versículo' : 'Voltar ao automático')}</button>
            <button className="btn btn-ghost btn-full" onClick={() => setModal(false)} style={{ marginTop: 8 }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
