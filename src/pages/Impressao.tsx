// Impressão — agora é um EDITOR de layout (src/editor).
// Você desenha um modelo (foto, nome, formas, imagens…) e ele é
// repetido por pessoa, encaixado na folha A4.
// O Crachá continua com a tela dele, intacto.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import { carregarConfig, salvarConfig } from '../lib/tema'
import { isAdmin, formatName } from '../utils'
import { toast } from '../components/Toast'
import type { Profile } from '../App'

import Editor from '../editor/Editor'
import ImprimirView, { encaixe, type Orientacao } from '../editor/render/Imprimir'
import GaleriaModelos, { type Modelo } from '../editor/GaleriaModelos'
import EscolherPessoas from '../components/EscolherPessoas'
import { criarElemento } from '../editor/elementos'
import { novoId, type Documento } from '../editor/tipos'

type Pessoa = { id:string; name:string; photo_url:string|null; role_type?:string|null; church?:string|null }

const CHAVE = 'impressao_modelos_v2'

/** Folha em branco (crachá em pé), sem nenhum elemento. Não mexe nos modelos salvos. */
function docVazio(): Documento {
  return {
    id: novoId(), nome: 'Sem título',
    papel: { largura: 54, altura: 86 },
    paginas: [{ id: novoId(), fundo: '#ffffff', elementos: [] }],
    fonteDados: 'pessoas',
  }
}

/** Modelo inicial: crachá em pé (5,4 × 8,6 cm) com foto e nome, repetido por pessoa. */
function docPadrao(): Documento {
  const foto = criarElemento('foto', { x: 12, y: 12, w: 30, h: 30 })!
  const nome = criarElemento('texto', { x: 4, y: 48, w: 46, h: 10 })!
  nome.props = { ...nome.props, campo: 'nome', tam: 4, alinhar: 'center' }
  return {
    id: novoId(), nome: 'Crachá',
    papel: { largura: 54, altura: 86 },
    paginas: [{ id: novoId(), fundo: '#ffffff', elementos: [foto, nome] }],
    fonteDados: 'pessoas',
  }
}

export default function Impressao({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const { pode } = usePermissao(profile ?? null)
  const canEdit = isAdmin(profile?.user_role) || pode('impressao','editar')

  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [equipes, setEquipes] = useState<{id:string;name:string}[]>([])
  const [equipeIds, setEquipeIds] = useState<Record<string,string[]>>({})
  const [loading, setLoading] = useState(true)

  const [modelos, setModelos] = useState<Modelo[]>([])
  const [doc, setDoc] = useState<Documento>(() => docPadrao())
  /** O documento como está AGORA dentro do editor (o `doc` acima é só o inicial).
   *  `docRef` acompanha CADA mudança; o state só muda no que a tela mostra
   *  (papel, nome, id). Sem isso, arrastar um elemento re-renderizava a página
   *  inteira a cada pixel e o editor engasgava. */
  const docRef = useRef<Documento>(doc)
  const [docAtual, setDocAtual] = useState<Documento>(doc)

  const aoMudarDoc = useCallback((d: Documento) => {
    docRef.current = d
    setDocAtual(ant =>
      ant.id === d.id && ant.nome === d.nome && ant.fonteDados === d.fonteDados &&
      ant.papel.largura === d.papel.largura && ant.papel.altura === d.papel.altura
        ? ant : d)
  }, [])

  /** Troca o documento aberto (carregar modelo, começar do zero, salvar). */
  const aplicarDoc = useCallback((d: Documento) => { docRef.current = d; setDoc(d); setDocAtual(d) }, [])
  const [orientacao, setOrientacao] = useState<Orientacao>('auto')
  const [escolhendo, setEscolhendo] = useState<Documento|null>(null)  // tela "quem vai ser impresso"
  const [imprimindo, setImprimindo] = useState<Documento|null>(null)
  const [idsImprimir, setIdsImprimir] = useState<string[]>([])
  const [galeria, setGaleria] = useState(false)
  const [painel, setPainel] = useState(false)   // janela flutuante com os ajustes
  const [salvando, setSalvando] = useState<Documento|null>(null)   // modal "Salvar modelo"
  const [nomeModelo, setNomeModelo] = useState('')

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])
  useEffect(() => {
    carregarConfig(CHAVE).then(v => {
      if (!v) return
      try { setModelos(JSON.parse(v)) } catch {}
    })
  }, [])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [pe, tm, pt] = await Promise.all([
      supabase.from('people').select('id,name,photo_url,role_type,church').eq('event_id',evento.id).order('name'),
      supabase.from('teams').select('id,name').eq('event_id',evento.id).order('name'),
      supabase.from('people_teams').select('person_id,team_id'),
    ])
    setPessoas(pe.data ?? [])
    setEquipes(tm.data ?? [])
    const ids: Record<string,string[]> = {}
    ;(pt.data ?? []).forEach((v:any)=>{ (ids[v.person_id]=ids[v.person_id]||[]).push(v.team_id) })
    setEquipeIds(ids)
    setLoading(false)
  }

  const nomeEquipes = (pid:string) =>
    (equipeIds[pid]??[]).map(tid => equipes.find(t=>t.id===tid)?.name).filter(Boolean).join(', ')

  /** Um "registro de dados" por pessoa — é o que preenche {{nome}}, {{foto}}… */
  const registroDe = (p: Pessoa) => ({
    nome: formatName(p.name),
    foto: p.photo_url ?? '',
    equipe: nomeEquipes(p.id),
    igreja: p.church ?? '',
    funcao: p.role_type === 'worker' ? 'Encontreiro' : 'Encontrista',
  })

  /** Só quem foi escolhido na tela de impressão, na ordem alfabética da lista. */
  const dados = useMemo(() => {
    const escolhidos = new Set(idsImprimir)
    return pessoas.filter(p => escolhidos.has(p.id)).map(registroDe)
  }, [pessoas, idsImprimir, equipeIds, equipes])

  /** Prévia dentro do editor: a primeira pessoa cadastrada.
   *  Memorizado pra não trocar de identidade e redesenhar o editor à toa. */
  const dadosPrevia = useMemo(
    () => (pessoas[0] ? registroDe(pessoas[0]) : { nome: 'Nome da Pessoa', foto: '', equipe: 'Equipe', igreja: '', funcao: '' }),
    [pessoas, equipeIds, equipes])

  /** Sobe a imagem escolhida no celular e devolve a URL pública. */
  async function subirImagem(f: File): Promise<string|null> {
    const ext = f.name.split('.').pop() || 'jpg'
    const path = `impressao/${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`
    const { error } = await supabase.storage.from('arquivos').upload(path, f, { upsert: true })
    if (error) { toast.falha('Não foi possível enviar a imagem.', error); return null }
    const { data } = supabase.storage.from('arquivos').getPublicUrl(path)
    return data.publicUrl
  }

  async function guardar(novos: Modelo[]) { setModelos(novos); await salvarConfig(CHAVE, JSON.stringify(novos)) }

  /** Salva por NOME: nome novo = modelo novo; nome existente = atualiza aquele.
   *  Assim dá pra ter quantos modelos quiser (e "salvar como" é só trocar o nome). */
  async function confirmarSalvar() {
    const d = salvando
    const nome = nomeModelo.trim()
    if (!d || !nome) return
    const mesmoNome = modelos.find(m => m.nome.trim().toLowerCase() === nome.toLowerCase())

    if (mesmoNome) {
      const doc2 = { ...d, id: mesmoNome.id, nome }
      aplicarDoc(doc2); setSalvando(null)
      await guardar(modelos.map(m => m.id===mesmoNome.id ? { ...m, nome, doc: doc2 } : m))
      toast.sucesso(`"${nome}" atualizado!`)
    } else {
      // reaproveita o id do documento quando ele ainda não pertence a outro modelo
      const id = modelos.some(m => m.id === d.id) ? novoId() : d.id
      const doc2 = { ...d, id, nome }
      aplicarDoc(doc2); setSalvando(null)
      await guardar([...modelos, { id, nome, doc: doc2 }])
      toast.sucesso(`"${nome}" salvo! Agora ele aparece em Modelos.`)
    }
  }

  /** Puxa um modelo salvo pro editor. */
  function abrirModelo(m: Modelo) {
    aplicarDoc(m.doc); setGaleria(false)
    toast.info(`Modelo "${m.nome}" aberto.`)
  }

  /** Joga o documento aberto agora por cima de um modelo salvo.
   *  Usa docRef (o vivo), não docAtual — este só acompanha papel/nome/id. */
  async function substituirModelo(m: Modelo) {
    const doc2 = { ...docRef.current, id: m.id, nome: m.nome }
    aplicarDoc(doc2)
    await guardar(modelos.map(x => x.id===m.id ? { ...x, doc: doc2 } : x))
    toast.sucesso(`"${m.nome}" substituído!`)
  }

  async function renomearModelo(m: Modelo, nome: string) {
    if (docRef.current.id === m.id) aplicarDoc({ ...docRef.current, nome })
    await guardar(modelos.map(x => x.id===m.id ? { ...x, nome, doc: { ...x.doc, nome } } : x))
    toast.sucesso('Nome alterado!')
  }

  async function excluirModelo(m: Modelo) {
    await guardar(modelos.filter(x => x.id !== m.id))
    toast.info(`"${m.nome}" excluído.`)
  }

  function comecarDoZero() { aplicarDoc(docVazio()); setGaleria(false) }

  // O que a aba mostra quando a janela está fechada.
  const enc = encaixe(docAtual.papel, orientacao)
  const folhaLabel = `A4 ${enc.orientacao==='retrato'?'em pé':'deitada'}`
  const resumo = docAtual.fonteDados === 'pessoas'
    ? (enc.cabe ? `${folhaLabel} · ${enc.total}/folha` : 'Não cabe no A4')
    : 'Ajustes'

  if (evLoading || loading) return <div className="page">{[1,2].map(i=><div key={i} className="skeleton" style={{height:110,marginBottom:12,borderRadius:14}}/>)}</div>
  if (!evento) return <div className="page"><div className="empty"><p className="empty-title">Nenhum evento ativo</p></div></div>

  if (imprimindo) return <ImprimirView doc={imprimindo} dados={dados} orientacao={orientacao} onVoltar={()=>setImprimindo(null)} />

  // Tocar em "Imprimir" abre a escolha de pessoas antes da folha
  if (escolhendo) return (
    <EscolherPessoas
      pessoas={pessoas} equipes={equipes} equipeIds={equipeIds}
      nomeModelo={escolhendo.nome || 'Sem título'}
      folhaLabel={folhaLabel} porFolha={enc.total} cabe={enc.cabe}
      onCancelar={()=>setEscolhendo(null)}
      onImprimir={(ids)=>{ setIdsImprimir(ids); setImprimindo(escolhendo); setEscolhendo(null) }}
    />
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100dvh - 56px)', minHeight:0 }}>

      {/* Aba: só ela fica na tela. Tocar desce/sobe a janela com os ajustes. */}
      <div style={{ background:'white', borderBottom:'1px solid var(--border)', padding:'6px 12px', display:'flex', justifyContent:'center', flexShrink:0 }}>
        <button type="button" onClick={()=>setPainel(v=>!v)}
          style={{ display:'flex', alignItems:'center', gap:8, background:'var(--bg)', border:'1px solid var(--border)',
            borderRadius:99, padding:'6px 14px', cursor:'pointer', fontFamily:'inherit', maxWidth:'100%' }}>
          <span className="icon icon-sm" style={{ color:'var(--primary)' }}>tune</span>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{resumo}</span>
          <span className="icon icon-sm" style={{ color:'var(--muted)', transform: painel?'rotate(180deg)':'none', transition:'transform .18s' }}>expand_more</span>
        </button>
      </div>

      {/* Galeria de modelos — tela cheia com miniaturas */}
      {galeria && (
        <GaleriaModelos
          modelos={modelos} docAtual={docAtual} dados={dadosPrevia} podeEditar={canEdit}
          onAbrir={abrirModelo}
          onSubstituir={substituirModelo}
          onRenomear={renomearModelo}
          onExcluir={excluirModelo}
          onZero={comecarDoZero}
          onFechar={()=>setGaleria(false)}
        />
      )}

      {/* EDITOR (a janela flutuante desce POR CIMA dele, sem empurrar nada) */}
      <div style={{ flex:1, minHeight:0, position:'relative' }}>
        <Editor
          key={doc.id}
          inicial={doc}
          dados={dadosPrevia}
          subirImagem={subirImagem}
          somenteLeitura={!canEdit}
          onChange={aoMudarDoc}
          onSalvar={canEdit ? (d)=>{ setNomeModelo(d.nome && d.nome!=='Sem título' ? d.nome : ''); setSalvando(d) } : undefined}
          onImprimir={(d)=>{
            if (d.fonteDados !== 'pessoas') { setIdsImprimir([]); setImprimindo(d); return }   // sem dados: imprime as páginas como estão
            if (pessoas.length===0) { toast.info('Nenhuma pessoa cadastrada neste evento.'); return }
            setEscolhendo(d)
          }}
        />

        <div style={{
          position:'absolute', top:0, left:0, right:0, zIndex:30,
          background:'white', borderBottom:'1px solid var(--border)', borderRadius:'0 0 14px 14px',
          boxShadow:'0 8px 20px rgba(0,0,0,0.12)', padding:'12px 14px',
          display:'flex', gap:8, alignItems:'center', flexWrap:'wrap',
          transform: painel ? 'translateY(0)' : 'translateY(-14px)',
          opacity: painel ? 1 : 0,
          pointerEvents: painel ? 'auto' : 'none',
          transition:'transform .18s ease, opacity .18s ease',
        }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>{ setPainel(false); setGaleria(true) }}>
            <span className="icon icon-sm">bookmarks</span> Meus modelos ({modelos.length})
          </button>
          {docAtual.fonteDados === 'pessoas' && (() => {
            const prox: Orientacao = orientacao==='auto' ? 'retrato' : orientacao==='retrato' ? 'paisagem' : 'auto'
            return (
              <button type="button" onClick={()=>setOrientacao(prox)}
                title="Folha onde os modelos serão impressos. Toque para forçar em pé/deitada."
                style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:8,
                  border:'1px solid var(--border)', background: enc.cabe?'white':'var(--danger-bg)', cursor:'pointer', fontFamily:'inherit' }}>
                <span className="icon icon-sm" style={{ color: enc.cabe?'var(--primary)':'var(--danger)' }}>print</span>
                <span style={{ fontSize:11.5, fontWeight:700, color: enc.cabe?'var(--text2)':'var(--danger)' }}>
                  {enc.cabe ? `A4 ${enc.orientacao==='retrato'?'em pé':'deitada'} · ${enc.total}/folha` : 'Não cabe no A4'}
                </span>
                <span style={{ fontSize:10, color:'var(--muted)' }}>{orientacao==='auto'?'auto':'fixo'}</span>
              </button>
            )
          })()}
          <span style={{ fontSize:12, color:'var(--muted)', marginLeft:'auto' }}>{pessoas.length} cadastrada(s)</span>
        </div>
      </div>

      {/* Salvar modelo — modal de verdade (o prompt do navegador não abre no celular) */}
      {salvando && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}
          onClick={e => e.target===e.currentTarget && setSalvando(null)}>
          <div style={{ background:'white', borderRadius:'20px 20px 0 0', padding:'8px 20px 32px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:36, height:4, background:'var(--border)', borderRadius:2, margin:'12px auto 0' }}/>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 0 16px', borderBottom:'1px solid var(--border)', marginBottom:20 }}>
              <span style={{ fontSize:17, fontWeight:700 }}>Salvar modelo</span>
              <button onClick={()=>setSalvando(null)} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'50%', width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}><span className="icon icon-sm">close</span></button>
            </div>

            <div className="form-group">
              <label className="form-label">Nome do modelo <span className="req">*</span></label>
              <input className="form-input" autoFocus placeholder="Ex: Crachá dos encontristas"
                value={nomeModelo} onChange={e=>setNomeModelo(e.target.value)}
                onKeyDown={e=>{ if (e.key==='Enter') confirmarSalvar() }} />
              <p style={{ fontSize:12, color:'var(--muted)', marginTop:6 }}>
                Nome novo cria um modelo novo. Nome que já existe substitui aquele.
              </p>
            </div>

            {modelos.length > 0 && (
              <div className="form-group">
                <label className="form-label">Ou substituir um salvo</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {modelos.map(m => (
                    <button key={m.id} type="button" onClick={()=>setNomeModelo(m.nome)}
                      style={{ border: nomeModelo.trim().toLowerCase()===m.nome.trim().toLowerCase() ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background:'white', borderRadius:99, padding:'6px 14px', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
                      {m.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button className="btn btn-primary" style={{ width:'100%' }} disabled={!nomeModelo.trim()} onClick={confirmarSalvar}>
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
