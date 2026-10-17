import { describe, expect, it } from 'vitest'

import { htmlToPlainText, sanitizeNoteHtml } from './note-html'

describe('sanitizeNoteHtml — formats autorisés par l’éditeur riche (lot 6, §8)', () => {
  it('conserve le gras, l’italique, les titres et les listes', () => {
    const html = '<h3>Titre</h3><p><strong>Gras</strong> et <em>italique</em></p><ul><li>Item</li></ul>'
    expect(sanitizeNoteHtml(html)).toBe(html)
  })

  it('conserve les cases à cocher (data-checked)', () => {
    const html = '<ul class="checklist"><li data-checked="true">Fait</li><li data-checked="false">À faire</li></ul>'
    expect(sanitizeNoteHtml(html)).toBe(html)
  })

  it('retire les balises non autorisées (script, img, a) et leurs gestionnaires', () => {
    const html = '<p>Bonjour</p><script>alert(1)</script><img src=x onerror="alert(1)"><a href="x">lien</a>'
    const result = sanitizeNoteHtml(html)
    expect(result).not.toContain('<script')
    expect(result).not.toContain('<img')
    expect(result).not.toContain('onerror')
    expect(result).not.toContain('<a ')
    expect(result).toContain('Bonjour')
  })

  it('retire les attributs non autorisés (style, onclick) des balises conservées', () => {
    const html = '<p style="color:red" onclick="alert(1)">Texte</p>'
    const result = sanitizeNoteHtml(html)
    expect(result).not.toContain('style=')
    expect(result).not.toContain('onclick')
    expect(result).toContain('Texte')
  })
})

describe('htmlToPlainText — pour les compteurs de mots/caractères (lot 6, §8)', () => {
  it('extrait le texte sans les balises', () => {
    expect(htmlToPlainText('<h3>Titre</h3><p>Un <strong>mot</strong> en gras.</p>')).toBe(
      'TitreUn mot en gras.',
    )
  })

  it('renvoie une chaîne vide pour un HTML vide', () => {
    expect(htmlToPlainText('')).toBe('')
  })

  it('inclut le texte des cases à cocher', () => {
    expect(htmlToPlainText('<ul><li data-checked="true">Fait</li></ul>')).toBe('Fait')
  })
})
