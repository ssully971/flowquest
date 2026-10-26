import { describe, expect, it } from 'vitest'

import indexHtml from '../../index.html?raw'

describe('index.html — métadonnées Fokitsu', () => {
  it('titre statique, description et balises Open Graph', () => {
    expect(indexHtml).toContain('<title>Fokitsu - Bêta</title>')
    expect(indexHtml).toContain(
      'content="Fokitsu : minuteur de concentration gratuit (Pomodoro, chronomètre, sessions de groupe)."',
    )
    expect(indexHtml).toContain('<meta property="og:title" content="Fokitsu - Bêta" />')
    expect(indexHtml).toContain('<meta property="og:site_name" content="Fokitsu" />')
    expect(indexHtml).toContain('<meta property="og:type" content="website" />')
    expect(indexHtml).toContain('name="apple-mobile-web-app-title" content="Fokitsu"')
  })

  it('n’ajoute ni og:url ni og:image (dépendent du domaine, phases ultérieures)', () => {
    expect(indexHtml).not.toContain('og:url')
    expect(indexHtml).not.toContain('og:image')
  })

  it('theme-color inchangé', () => {
    expect(indexHtml).toContain('content="#F1EAFF" media="(prefers-color-scheme: light)"')
    expect(indexHtml).toContain('content="#0C0719" media="(prefers-color-scheme: dark)"')
  })

  it('favicon issue de la tête de renard (ico + PNG), plus de favicon SVG', () => {
    expect(indexHtml).toContain('<link rel="icon" href="/favicon.ico" sizes="any" />')
    expect(indexHtml).toContain('sizes="32x32" href="/favicon-32.png"')
    expect(indexHtml).toContain('sizes="16x16" href="/favicon-16.png"')
    expect(indexHtml).not.toContain('favicon.svg')
  })
})
