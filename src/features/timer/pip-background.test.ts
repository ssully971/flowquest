import { describe, expect, it } from 'vitest'

import { resolvePipBackground } from './pip-background'

const COLORS = { bg: '#0c0719', surface2: '#291d47' }

describe('resolvePipBackground — version statique du fond d’écran pour la fenêtre PiP', () => {
  it('fond photo : sa vignette légère, sur le dégradé du thème', () => {
    const background = resolvePipBackground('photo-aurore', { colors: COLORS })
    expect(background.imageSrc).toBe('/backgrounds/dark-gradients/thumbs/aurore.webp')
    expect(background).toMatchObject({ colorFrom: '#0c0719', colorTo: '#291d47' })
  })

  it('fond en CSS (dégradé, animé…) : pas d’image, dégradé équivalent aux couleurs du thème', () => {
    for (const id of ['horizon', 'respiration', 'derive', 'pure-black'] as const) {
      const background = resolvePipBackground(id, { colors: COLORS })
      expect(background.imageSrc).toBeNull()
      expect(background.colorFrom).toBe('#0c0719')
    }
  })

  it('photo personnelle de la bibliothèque : son URL d’objet et sa position verticale', () => {
    const background = resolvePipBackground('custom:abc', {
      customPhoto: { url: 'blob:http://localhost/abc', position: 'top' },
      colors: COLORS,
    })
    expect(background.imageSrc).toBe('blob:http://localhost/abc')
    expect(background.position).toBe('center top')
  })

  it('photo personnelle sans image envoyée : dégradé seul', () => {
    expect(resolvePipBackground('custom:abc', { colors: COLORS }).imageSrc).toBeNull()
  })
})
