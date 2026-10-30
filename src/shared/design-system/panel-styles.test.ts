/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { contrastRatio } from '@/features/home/clock-color-contrast'

interface Palette {
  name: string
  vars: Record<string, string>
}

/** Extrait chaque bloc `.fq-panel[data-panel-style=…]` (clair, puis sombre) avec ses variables. */
function palettes(): Palette[] {
  const result: Palette[] = []
  const blockRe = /([^{}]*\.fq-panel\[data-panel-style='(paper|glass)'\])\s*\{([^{}]*)\}/g
  for (const match of css.matchAll(blockRe)) {
    const vars: Record<string, string> = {}
    for (const v of match[3].matchAll(/--(pn-[a-z-]+):\s*([^;]+);/g)) vars[v[1]] = v[2].trim()
    if (!vars['pn-text']) continue
    const dark = /data-theme='dark'|not\(\[data-theme='light'\]\)/.test(match[1])
    result.push({ name: `${match[2]}-${dark ? 'sombre' : 'clair'}`, vars })
  }
  return result
}

function toRgb(value: string): [number, number, number, number] {
  const rgba = value.match(/rgba?\(([^)]+)\)/)
  if (rgba) {
    const [r, g, b, a = '1'] = rgba[1].split(',').map((part) => part.trim())
    return [Number(r), Number(g), Number(b), Number(a)]
  }
  const hex = value.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(1) as [
    number,
    number,
    number,
    number,
  ]
}

const toHex = (rgb: number[]) =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`

/** Surface composée sur un fond pire cas (blanc ou noir) : le verre est translucide, le
 * contraste doit tenir quelle que soit la photo derrière. */
function composite(surface: string, backdrop: number): string {
  const [r, g, b, a] = toRgb(surface)
  return toHex([r, g, b].map((c) => c * a + backdrop * (1 - a)))
}

// process.cwd() = racine du dépôt sous vitest.
const css = readFileSync('src/shared/design-system/panel-styles.css', 'utf8')

describe('panel-styles.css — contraste AA des deux directions', () => {
  const all = palettes()

  it('couvre papier et verre, en clair et en sombre', () => {
    expect(all.map((p) => p.name).sort()).toEqual([
      'glass-clair',
      'glass-sombre',
      'glass-sombre',
      'paper-clair',
      'paper-sombre',
      'paper-sombre',
    ])
  })

  for (const palette of all) {
    it(`${palette.name} : texte, texte atténué, accent et bouton ≥ 4,5:1 (fond blanc ou noir)`, () => {
      for (const backdrop of [0, 255]) {
        const surface = composite(palette.vars['pn-surface'], backdrop)
        expect(
          contrastRatio(toHex(toRgb(palette.vars['pn-text'])), surface),
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrastRatio(toHex(toRgb(palette.vars['pn-muted'])), surface),
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrastRatio(toHex(toRgb(palette.vars['pn-accent'])), surface),
        ).toBeGreaterThanOrEqual(4.5)
        // Contour des cases : composant d'interface, 3:1 minimum.
        expect(
          contrastRatio(toHex(toRgb(palette.vars['pn-cb-line'])), surface),
        ).toBeGreaterThanOrEqual(3)
      }
      expect(
        contrastRatio(
          toHex(toRgb(palette.vars['pn-on-accent'])),
          toHex(toRgb(palette.vars['pn-accent'])),
        ),
      ).toBeGreaterThanOrEqual(4.5)
    })
  }
})
