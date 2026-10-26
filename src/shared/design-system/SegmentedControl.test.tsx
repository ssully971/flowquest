import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Home } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { SegmentedControl } from './SegmentedControl'
import type { SegmentedOption } from './SegmentedControl'

const options: SegmentedOption<'a' | 'b' | 'c'>[] = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
]

describe('SegmentedControl', () => {
  it('ne tabule que sur l’option sélectionnée (roving tabindex)', () => {
    render(<SegmentedControl ariaLabel="Test" value="b" onChange={vi.fn()} options={options} />)
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('radio', { name: 'B' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'C' })).toHaveAttribute('tabindex', '-1')
  })

  it('les flèches déplacent la sélection et le focus', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SegmentedControl ariaLabel="Test" value="a" onChange={onChange} options={options} />)

    screen.getByRole('radio', { name: 'A' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('Fin déplace la sélection sur la dernière option', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SegmentedControl ariaLabel="Test" value="a" onChange={onChange} options={options} />)

    screen.getByRole('radio', { name: 'A' }).focus()
    await user.keyboard('{End}')

    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('porte un indicateur unique (fond partagé) plutôt qu’un fond par bouton (LOT D)', () => {
    const { container } = render(
      <SegmentedControl ariaLabel="Test" value="b" onChange={vi.fn()} options={options} />,
    )
    // Un seul calque d'indicateur, en dehors des boutons eux-mêmes (dont aucun ne porte
    // plus le fond directement — le glissement visuel réel ne se vérifie qu'en navigateur,
    // jsdom ne mesurant jamais de vraie mise en page).
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1)
    for (const option of options) {
      expect(screen.getByRole('radio', { name: option.label }).className).not.toContain(
        'bg-[var(--accent)]',
      )
    }
  })

  it('une option à icône n’affiche son nom en dessous que si elle est active (LOT H2, retour après feu vert)', () => {
    const iconOptions: SegmentedOption<'home' | 'focus'>[] = [
      { value: 'home', label: 'Accueil', icon: Home },
      { value: 'focus', label: 'Focus', icon: Home },
    ]
    render(<SegmentedControl ariaLabel="Mode" value="home" onChange={vi.fn()} options={iconOptions} />)

    // Toujours trouvable par son nom accessible (aria-label porté par le bouton), que le
    // texte soit affiché ou non.
    const active = screen.getByRole('radio', { name: 'Accueil' })
    expect(active.querySelector('span')).toHaveTextContent('Accueil')

    const inactive = screen.getByRole('radio', { name: 'Focus' })
    expect(inactive.querySelector('span')).toBeNull()
  })

  it('suit `iconSize` pour la taille des icônes (défaut « medium »)', () => {
    const iconOptions: SegmentedOption<'home' | 'focus'>[] = [
      { value: 'home', label: 'Accueil', icon: Home },
      { value: 'focus', label: 'Focus', icon: Home },
    ]
    const { rerender } = render(
      <SegmentedControl ariaLabel="Mode" value="home" onChange={vi.fn()} options={iconOptions} />,
    )
    expect(screen.getByRole('radio', { name: 'Accueil' }).querySelector('svg')).toHaveAttribute(
      'width',
      '18',
    )

    rerender(
      <SegmentedControl
        ariaLabel="Mode"
        value="home"
        onChange={vi.fn()}
        options={iconOptions}
        iconSize="small"
      />,
    )
    expect(screen.getByRole('radio', { name: 'Accueil' }).querySelector('svg')).toHaveAttribute(
      'width',
      '15',
    )
  })
})
