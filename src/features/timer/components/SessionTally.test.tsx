import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TALLY_EMOJI, TALLY_ICON_SETS } from '../tally-icon-set'
import { SessionTally } from './SessionTally'

describe('SessionTally — indicateur des sessions du cycle, émojis au choix (LOT B)', () => {
  it('iconSet="dots" retombe sur le rendu existant (points reliés)', () => {
    const { container } = render(
      <SessionTally total={4} completed={2} currentIsFocus iconSet="dots" />,
    )
    expect(container.querySelectorAll('.rounded-full').length).toBe(4)
  })

  it.each(TALLY_ICON_SETS.filter((set) => set !== 'dots'))(
    'affiche %s avec le bon nombre d’émojis, en couleur pour les sessions faites, désaturés sinon',
    (iconSet) => {
      const { container } = render(
        <SessionTally total={4} completed={2} currentIsFocus iconSet={iconSet} />,
      )
      const spans = container.querySelectorAll('span[style]')
      expect(spans.length).toBe(4)

      const emoji = TALLY_EMOJI[iconSet]
      expect(spans[0].textContent).toBe(emoji[0 % emoji.length])

      // Faites (index 0, 1) : couleur d'origine, pleine opacité.
      expect((spans[0] as HTMLElement).style.filter).toBe('grayscale(0) brightness(1)')
      expect((spans[0] as HTMLElement).style.opacity).toBe('1')
      expect((spans[1] as HTMLElement).style.filter).toBe('grayscale(0) brightness(1)')

      // Pas encore faite (index 3, pas la session en cours) : désaturée et assombrie.
      expect((spans[3] as HTMLElement).style.filter).toBe('grayscale(1) brightness(0.55)')
      expect((spans[3] as HTMLElement).style.opacity).toBe('0.45')
    },
  )

  it('la session en cours (pas encore faite) ressort déjà en couleur', () => {
    const { container } = render(
      <SessionTally total={3} completed={1} currentIsFocus iconSet="stars" />,
    )
    const spans = container.querySelectorAll('span[style]')
    // index 1 = la session en cours (completed=1, currentIsFocus) : en couleur malgré non faite.
    expect((spans[1] as HTMLElement).style.filter).toBe('grayscale(0) brightness(1)')
    // index 2 = future, ni faite ni en cours : désaturée.
    expect((spans[2] as HTMLElement).style.filter).toBe('grayscale(1) brightness(0.55)')
  })

  it('le jeu médical propose une progression de plusieurs émojis (pas un seul répété)', () => {
    const { container } = render(
      <SessionTally total={6} completed={3} currentIsFocus={false} iconSet="stethoscope" />,
    )
    const texts = Array.from(container.querySelectorAll('span[style]')).map((el) => el.textContent)
    expect(texts).toEqual(['🩺', '❤️', '💊', '🧠', '🦷', '🫁'])
  })
})
