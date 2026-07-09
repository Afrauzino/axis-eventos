// ─────────────────────────────────────────────────────────────
// Estado do editor + histórico (desfazer/refazer).
// Regra de ouro: NENHUM componente muda o documento direto —
// tudo passa por dispatch(acao). Assim histórico, logs e futuros
// recursos (colaboração, auto-save) entram sem refatorar nada.
// ─────────────────────────────────────────────────────────────
import { useCallback, useMemo, useRef, useState } from 'react'
import type { Acao, Documento, Elemento, Id, Pagina } from './tipos'
import { novoId } from './tipos'

const LIMITE_HISTORICO = 60

function clonar<T>(v: T): T { return JSON.parse(JSON.stringify(v)) }

function acharPagina(doc: Documento, paginaId: Id) { return doc.paginas.find(p => p.id === paginaId) }

/** Aplica um comando e devolve o NOVO documento (imutável). */
export function aplicar(doc: Documento, a: Acao): Documento {
  const d = clonar(doc)

  const todosElementos = () => d.paginas.flatMap(p => p.elementos)
  const paginaDe = (id: Id) => d.paginas.find(p => p.elementos.some(e => e.id === id))

  switch (a.t) {
    case 'add': {
      const pg = acharPagina(d, a.paginaId) ?? d.paginas[0]
      pg.elementos.push(a.el)
      return d
    }
    case 'excluir': {
      d.paginas.forEach(p => { p.elementos = p.elementos.filter(e => !a.ids.includes(e.id)) })
      return d
    }
    case 'patch': {
      todosElementos().forEach(e => { if (a.ids.includes(e.id) && !e.bloqueado) Object.assign(e, a.patch) })
      // 'bloquear' precisa passar mesmo em elemento bloqueado (pra desbloquear)
      if ('bloqueado' in a.patch) todosElementos().forEach(e => { if (a.ids.includes(e.id)) e.bloqueado = a.patch.bloqueado! })
      return d
    }
    case 'patchProps': {
      todosElementos().forEach(e => { if (a.ids.includes(e.id) && !e.bloqueado) e.props = { ...e.props, ...a.props } })
      return d
    }
    case 'ordem': {
      a.ids.forEach(id => {
        const pg = paginaDe(id); if (!pg) return
        const i = pg.elementos.findIndex(e => e.id === id); if (i < 0) return
        const [el] = pg.elementos.splice(i, 1)
        if (a.para === 'topo') pg.elementos.push(el)
        else if (a.para === 'fundo') pg.elementos.unshift(el)
        else if (a.para === 'frente') pg.elementos.splice(Math.min(i + 1, pg.elementos.length), 0, el)
        else pg.elementos.splice(Math.max(i - 1, 0), 0, el)
      })
      return d
    }
    case 'duplicar': {
      a.ids.forEach(id => {
        const pg = paginaDe(id); if (!pg) return
        const el = pg.elementos.find(e => e.id === id); if (!el) return
        pg.elementos.push({ ...clonar(el), id: novoId(), x: el.x + 3, y: el.y + 3, grupo: null })
      })
      return d
    }
    case 'agrupar': {
      if (a.ids.length < 2) return d
      const g = novoId()
      todosElementos().forEach(e => { if (a.ids.includes(e.id)) e.grupo = g })
      return d
    }
    case 'desagrupar': {
      todosElementos().forEach(e => { if (a.ids.includes(e.id)) e.grupo = null })
      return d
    }
    case 'documento': return { ...d, ...a.patch }
    case 'papel':     return { ...d, papel: { ...d.papel, ...a.patch } }
    case 'pagina.add': {
      const pg: Pagina = { id: novoId(), elementos: [] }
      d.paginas.push(pg)
      return d
    }
    case 'pagina.excluir': {
      if (d.paginas.length <= 1) return d
      d.paginas = d.paginas.filter(p => p.id !== a.paginaId)
      return d
    }
    case 'pagina.duplicar': {
      const pg = acharPagina(d, a.paginaId); if (!pg) return d
      const copia: Pagina = { id: novoId(), fundo: pg.fundo, elementos: pg.elementos.map(e => ({ ...clonar(e), id: novoId() })) }
      d.paginas.splice(d.paginas.indexOf(pg) + 1, 0, copia)
      return d
    }
    default: return d
  }
}

export function useEditor(inicial: Documento) {
  const [doc, setDoc] = useState<Documento>(inicial)
  const [selecao, setSelecao] = useState<Id[]>([])
  const [paginaAtual, setPaginaAtual] = useState(0)

  const passado = useRef<Documento[]>([])
  const futuro  = useRef<Documento[]>([])
  const [, forcar] = useState(0)

  const dispatch = useCallback((a: Acao) => {
    setDoc(atual => {
      const novo = aplicar(atual, a)
      if (novo === atual) return atual
      passado.current.push(atual)
      if (passado.current.length > LIMITE_HISTORICO) passado.current.shift()
      futuro.current = []
      forcar(n => n + 1)
      return novo
    })
  }, [])

  const desfazer = useCallback(() => {
    setDoc(atual => {
      const ant = passado.current.pop()
      if (!ant) return atual
      futuro.current.push(atual)
      forcar(n => n + 1)
      return ant
    })
  }, [])

  const refazer = useCallback(() => {
    setDoc(atual => {
      const prox = futuro.current.pop()
      if (!prox) return atual
      passado.current.push(atual)
      forcar(n => n + 1)
      return prox
    })
  }, [])

  const selecionar = useCallback((ids: Id[]) => setSelecao(ids), [])

  /** Elementos selecionados (objetos), na ordem da página. */
  const selecionados: Elemento[] = useMemo(
    () => doc.paginas.flatMap(p => p.elementos).filter(e => selecao.includes(e.id)),
    [doc, selecao],
  )

  return {
    doc, setDoc,
    selecao, selecionados, selecionar,
    paginaAtual, setPaginaAtual,
    dispatch, desfazer, refazer,
    podeDesfazer: passado.current.length > 0,
    podeRefazer: futuro.current.length > 0,
  }
}

/** Documento vazio pronto pra usar (A4 retrato). */
export function docNovo(nome = 'Novo modelo'): Documento {
  return {
    id: novoId(), nome,
    papel: { largura: 210, altura: 297 },
    paginas: [{ id: novoId(), elementos: [] }],
    fonteDados: null,
  }
}
