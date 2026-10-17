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
