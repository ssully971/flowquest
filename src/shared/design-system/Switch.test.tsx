import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Switch } from './Switch'

describe('Switch — interrupteur accessible unifié (lot 2)', () => {
  it('expose role="switch" et aria-checked reflétant l’état', () => {
    render(<Switch checked label="Son" onChange={vi.fn()} />)
    const toggle = screen.getByRole('switch', { name: 'Son' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('appelle onChange au clic', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} label="Son" onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Son' }))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  /**
   * Bug réel trouvé en navigateur (LOT B, confirmé par mesure de pixels réelle avec
   * Playwright) : sans `left-0` explicite sur la pastille, Chromium calcule sa position
   * statique (avant translate) en tenant compte du `text-align: center` par défaut des
   * `<button>` — un décalage de +24px (la moitié des 48px de la piste) s'ajoutait à
   * translate-x-1/6, poussant la pastille activée entièrement HORS de la piste
   * (marge gauche mesurée : 48px au lieu de 24px). `left-0` rend la position statique
   * explicite et supprime cette ambiguïté.
   *
   * jsdom ne peut pas vérifier ceci : il n'exécute aucune mise en page réelle
   * (getBoundingClientRect y renvoie toujours des zéros), donc ce test ne peut que
   * vérifier la présence des classes attendues — pas la position réellement rendue.
   * La vérification par pixels réels (piste 48×28px, pastille 20×20px, marge de 4px du
   * côté « fermé », jamais de dépassement) a été faite en Chromium réel sur chaque page
   * de réglages qui utilise ce composant (Horloge, Minuteur, Citations, Extras), clair
   * et sombre, et doit être refaite de la même façon si ce fichier change à nouveau.
   */
  it('le curseur ne dépasse jamais la piste (désactivé : 4px, activé : 24px, piste de 48px, curseur de 20px)', () => {
    const { rerender } = render(<Switch checked={false} label="Son" onChange={vi.fn()} />)
    let thumb = screen.getByRole('switch', { name: 'Son' }).querySelector('span')
    expect(thumb?.className).toContain('left-0')
    expect(thumb?.className).toContain('translate-x-1')

    rerender(<Switch checked label="Son" onChange={vi.fn()} />)
    thumb = screen.getByRole('switch', { name: 'Son' }).querySelector('span')
    expect(thumb?.className).toContain('left-0')
    expect(thumb?.className).toContain('translate-x-6')
  })
})
