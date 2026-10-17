import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TALLY_ICON_SETS } from '../tally-icon-set'
import { SessionTally } from './SessionTally'

describe('SessionTally — indicateur des sessions du cycle, icônes au choix (lot 4)', () => {
  it('iconSet="dots" retombe sur le rendu existant (points reliés)', () => {
    const { container } = render(
      <SessionTally total={4} completed={2} currentIsFocus iconSet="dots" />,
    )
    expect(container.querySelectorAll('.rounded-full').length).toBe(4)
  })

  it.each(TALLY_ICON_SETS.filter((set) => set !== 'dots'))(
    'affiche %s avec le bon nombre d’icônes, pleines pour les sessions faites',
    (iconSet) => {
      const { container } = render(
        <SessionTally total={4} completed={2} currentIsFocus iconSet={iconSet} />,
      )
      const icons = container.querySelectorAll('svg')
      expect(icons.length).toBe(4)
      expect(icons[0]).toHaveAttribute('fill', 'currentColor')
      expect(icons[1]).toHaveAttribute('fill', 'currentColor')
      expect(icons[3]).toHaveAttribute('fill', 'none')
    },
  )

  it('la session en cours (pas encore faite) ressort en accent mais à vide', () => {
    const { container } = render(
      <SessionTally total={3} completed={1} currentIsFocus iconSet="stars" />,
    )
    const icons = container.querySelectorAll('svg')
    expect(icons[1]).toHaveAttribute('fill', 'none')
    expect(icons[1]).toHaveClass('text-[var(--accent)]')
  })
})
