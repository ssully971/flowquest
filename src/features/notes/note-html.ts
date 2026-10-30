import DOMPurify from 'dompurify'

/**
 * Formats autorisés par l'éditeur riche (§8 : gras, italique, titres, listes, cases).
 * Les cases à cocher sont un <li data-checked="true|false"> (pas un vrai <input> : une
 * case rendue en CSS depuis un attribut de données évite d'avoir à tolérer des
 * éléments de formulaire dans du contenu utilisateur).
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'h2',
  'h3',
  'blockquote',
  'ul',
  'ol',
  'li',
]
const ALLOWED_ATTR = ['data-checked', 'class']

/** Nettoie le HTML produit par l'éditeur (ou collé depuis l'extérieur) avant de
 * l'afficher ou de l'enregistrer — seule défense contre un <script>/<img onerror>
 * glissé via le presse-papiers ou une donnée distante modifiée hors de l'app. */
export function sanitizeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}

/** Texte brut dérivé d'un HTML déjà nettoyé (compteurs de mots/caractères, §8) — ne
 * jamais appeler sur du HTML non assaini. */
export function htmlToPlainText(safeHtml: string): string {
  if (typeof document === 'undefined') return ''
  const container = document.createElement('div')
  container.innerHTML = safeHtml
  return container.textContent ?? ''
}
