import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TIMER_DISPLAY_STYLES } from '../timer-display-style'
import { TimerFace } from './TimerFace'

describe('TimerFace — le temps reste toujours un texte lisible, quel que soit le style (lot 4)', () => {
  it.each(TIMER_DISPLAY_STYLES)('affiche "24:59" en texte pour le style %s', (style) => {
    render(<TimerFace style={style} label="24:59" progress={0.5} />)
    // BigDigits sépare chaque caractère dans son propre nœud : on reconstitue le texte visible.
    expect(screen.getByTestId('big-digits')).toHaveTextContent('24:59')
  })

  it.each(TIMER_DISPLAY_STYLES)(
    'ne plante pas avec progress=null (chronomètre, temps non borné) — style %s',
    (style) => {
      render(<TimerFace style={style} label="05:12" progress={null} />)
      expect(screen.getByTestId('big-digits')).toHaveTextContent('05:12')
    },
  )

  it('le style "default" ne réanime jamais les chiffres (pas de flip)', () => {
    const { container } = render(<TimerFace style="default" label="24:59" progress={0.5} />)
    expect(container.querySelector('[style*="animation"]')).toBeNull()
  })

  it('le style "flip" anime les chiffres (flip)', () => {
    const { container } = render(<TimerFace style="flip" label="24:59" progress={0.5} />)
    expect(container.querySelector('[style*="animation"]')).not.toBeNull()
  })
})

// Les styles « default » et « flip » (BigDigits seul) utilisent clamp() pour la taille de
// police : jsdom ne sait pas analyser clamp() dans un style en ligne (la déclaration est
// silencieusement ignorée, invisible même via getAttribute('style')), donc l'effet de
// sizeScale sur eux n'est vérifiable qu'en navigateur réel (captures LOT B). Les quatre
// autres styles ont leur propre géométrie en pixels simples (SVG, largeurs), observable
// par jsdom — utilisée ci-dessous.
describe('TimerFace — suit la taille d’horloge réglée (LOT B), proportionnellement comme l’accueil', () => {
  it('jauge : sizeScale plus grand agrandit le cercle SVG', () => {
    const { container, unmount } = render(
      <TimerFace style="gauge" label="24:59" progress={0.5} sizeScale={1} />,
    )
    const normalWidth = container.querySelector('svg')?.getAttribute('width')
    unmount()

    const { container: hugeContainer } = render(
      <TimerFace style="gauge" label="24:59" progress={0.5} sizeScale={1.35} />,
    )
    const hugeWidth = hugeContainer.querySelector('svg')?.getAttribute('width')

    expect(Number(hugeWidth)).toBeGreaterThan(Number(normalWidth))
  })

  it('camembert : sizeScale plus grand agrandit le disque', () => {
    const { container, unmount } = render(
      <TimerFace style="pie-chart" label="24:59" progress={0.5} sizeScale={1} />,
    )
    const normalWidth = (container.querySelector('.rounded-full') as HTMLElement | null)?.style.width
    unmount()

    const { container: hugeContainer } = render(
      <TimerFace style="pie-chart" label="24:59" progress={0.5} sizeScale={1.35} />,
    )
    const hugeWidth = (hugeContainer.querySelector('.rounded-full') as HTMLElement | null)?.style.width

    expect(parseFloat(hugeWidth ?? '0')).toBeGreaterThan(parseFloat(normalWidth ?? '0'))
  })

  it('barre de progression : sizeScale plus grand élargit le conteneur', () => {
    const { container, unmount } = render(
      <TimerFace style="progress-bar" label="24:59" progress={0.5} sizeScale={1} />,
    )
    const normalMaxWidth = (container.firstChild as HTMLElement).style.maxWidth
    unmount()

    const { container: hugeContainer } = render(
      <TimerFace style="progress-bar" label="24:59" progress={0.5} sizeScale={1.35} />,
    )
    const hugeMaxWidth = (hugeContainer.firstChild as HTMLElement).style.maxWidth

    expect(parseFloat(hugeMaxWidth)).toBeGreaterThan(parseFloat(normalMaxWidth))
  })

  it('compact ignore sizeScale (vignette de taille fixe)', () => {
    const { container, unmount } = render(
      <TimerFace style="gauge" label="24:59" progress={0.5} compact sizeScale={1} />,
    )
    const base = container.querySelector('svg')?.getAttribute('width')
    unmount()

    const { container: hugeContainer } = render(
      <TimerFace style="gauge" label="24:59" progress={0.5} compact sizeScale={1.35} />,
    )
    expect(hugeContainer.querySelector('svg')?.getAttribute('width')).toBe(base)
  })
})
