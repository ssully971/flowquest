import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BigDigits } from './BigDigits'

function getDigitNodes(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll('.inline-block'))
}

describe('BigDigits — chiffres Liquid Glass', () => {
  it('applique la classe verre seulement quand demandé, et ignore la couleur choisie', () => {
    const { getByTestId, rerender } = render(
      <BigDigits label="09:41" sizePx={100} color="#ff0000" />,
    )
    expect(getByTestId('big-digits')).not.toHaveClass('glass-digits')
    expect(getByTestId('big-digits').style.color).toBe('rgb(255, 0, 0)')

    rerender(<BigDigits label="09:41" sizePx={100} color="#ff0000" glass />)
    expect(getByTestId('big-digits')).toHaveClass('glass-digits')
    expect(getByTestId('big-digits').style.color).toBe('')
  })
})

describe('BigDigits — animation « flip » chiffre par chiffre (lot 2)', () => {
  it('ne remonte (et donc ne réanime) que le chiffre qui change réellement', () => {
    const { container, rerender } = render(<BigDigits label="05:30" sizePx={100} flip />)
    const before = getDigitNodes(container)
    expect(before.map((node) => node.textContent)).toEqual(['0', '5', '3', '0'])

    rerender(<BigDigits label="05:31" sizePx={100} flip />)
    const after = getDigitNodes(container)
    expect(after.map((node) => node.textContent)).toEqual(['0', '5', '3', '1'])

    // Les trois premiers chiffres n'ont pas changé : mêmes nœuds DOM, jamais remontés.
    expect(after[0]).toBe(before[0])
    expect(after[1]).toBe(before[1])
    expect(after[2]).toBe(before[2])
    // Le dernier chiffre a changé : nouveau nœud (remonté, donc l'animation CSS se relance).
    expect(after[3]).not.toBe(before[3])
  })

  it('une retenue (29→30, les minutes ET la dizaine changent) ne réanime que les chiffres concernés', () => {
    const { container, rerender } = render(<BigDigits label="05:29" sizePx={100} flip />)
    const before = getDigitNodes(container)

    rerender(<BigDigits label="05:30" sizePx={100} flip />)
    const after = getDigitNodes(container)

    // Heures inchangées.
    expect(after[0]).toBe(before[0])
    expect(after[1]).toBe(before[1])
    // Dizaine et unité des minutes ont changé (29 → 30) : toutes deux remontées.
    expect(after[2]).not.toBe(before[2])
    expect(after[3]).not.toBe(before[3])
  })

  it('sans flip, aucun chiffre n’est jamais remonté, même quand sa valeur change', () => {
    const { container, rerender } = render(<BigDigits label="05:30" sizePx={100} />)
    const before = getDigitNodes(container)

    rerender(<BigDigits label="05:31" sizePx={100} />)
    const after = getDigitNodes(container)

    expect(after[3]).toBe(before[3])
    expect(after[3].textContent).toBe('1')
  })
})

describe('BigDigits — couleur personnalisée (LOT B10)', () => {
  it('sans couleur, suit var(--text) (comportement « Auto »)', () => {
    const { getByTestId } = render(<BigDigits label="05:30" sizePx={100} />)
    expect(getByTestId('big-digits').style.color).toBe('')
    expect(getByTestId('big-digits').className).toContain('text-[var(--text)]')
  })

  it('avec une couleur, l’applique en style inline', () => {
    const { getByTestId } = render(<BigDigits label="05:30" sizePx={100} color="#F2555A" />)
    expect(getByTestId('big-digits').style.color).toBe('rgb(242, 85, 90)')
  })
})
