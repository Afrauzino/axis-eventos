import DOMPurify from 'dompurify'

// Limpa HTML vindo do banco/editor antes de exibir com dangerouslySetInnerHTML.
// Mantém a formatação do editor (negrito, listas, cores, links) e remove scripts,
// eventos (onerror, onclick…) e links javascript:.
const OPCOES = {
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i,
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
}

DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'A') { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer') }
})

export function sanitizarHtml(html: string | null | undefined): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, OPCOES) as unknown as string
}
