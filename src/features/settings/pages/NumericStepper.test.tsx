import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { NumericStepper } from './NumericStepper'

/** Parent réaliste qui renvoie bien la valeur ajustée en prop (contrairement à un simple
 * vi.fn() qui ne referme jamais la boucle) : seul ce aller-retour peut révéler une
 * resynchronisation du brouillon qui effacerait le message d'ajustement trop tôt. */
function StatefulWrapper() {
  const [value, setValue] = useState(25)
  return (
    <NumericStepper label="Durée de focus" value={value} min={5} max={90} step={5} unit="min" onChange={setValue} />
  )
}

describe('NumericStepper — boutons −/+ et saisie clavier directe (LOT B)', () => {
  it('affiche la valeur courante dans un champ modifiable au clavier, avec son unité', () => {
    render(
      <NumericStepper label="Durée de focus" value={25} min={5} max={90} step={5} unit="min" onChange={vi.fn()} />,
    )

    expect(screen.getByLabelText('Durée de focus')).toHaveValue(25)
    expect(screen.getByText('min')).toBeInTheDocument()
  })

  it('valide à la sortie du champ (blur) et appelle onChange avec la valeur saisie', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <NumericStepper label="Durée de focus" value={25} min={5} max={90} step={5} unit="min" onChange={onChange} />,
    )

    const input = screen.getByLabelText('Durée de focus')
    await user.clear(input)
    await user.type(input, '40')
    await user.tab()

    expect(onChange).toHaveBeenCalledWith(40)
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('valide à Entrée (sans attendre un blur séparé)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <NumericStepper label="Durée de focus" value={25} min={5} max={90} step={5} unit="min" onChange={onChange} />,
    )

    const input = screen.getByLabelText('Durée de focus')
    await user.clear(input)
    await user.type(input, '40{Enter}')

    expect(onChange).toHaveBeenCalledWith(40)
  })

  it('ajuste une valeur hors bornes à la borne la plus proche, avec un message explicite', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <NumericStepper label="Durée de focus" value={25} min={5} max={90} step={5} unit="min" onChange={onChange} />,
    )

    const input = screen.getByLabelText('Durée de focus')
    await user.clear(input)
    await user.type(input, '500')
    await user.tab()

    expect(onChange).toHaveBeenCalledWith(90)
    expect(input).toHaveValue(90)
    expect(screen.getByRole('alert')).toHaveTextContent('Ajustée entre 5 et 90.')
  })

  it('revient à la dernière valeur valide pour une saisie non numérique, sans jamais rester bloqué', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <NumericStepper label="Durée de focus" value={25} min={5} max={90} step={5} unit="min" onChange={onChange} />,
    )

    const input = screen.getByLabelText('Durée de focus')
    await user.clear(input)
    await user.type(input, 'abc')
    await user.tab()

    expect(onChange).not.toHaveBeenCalled()
    expect(input).toHaveValue(25)
    expect(screen.getByRole('alert')).toHaveTextContent('Valeur invalide : nombre entier attendu.')

    // Le champ reste utilisable : une nouvelle saisie valide efface le message et fonctionne.
    await user.clear(input)
    await user.type(input, '30')
    await user.tab()

    expect(onChange).toHaveBeenCalledWith(30)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('garde le message d’ajustement visible même quand le parent renvoie la valeur corrigée en prop', async () => {
    const user = userEvent.setup()
    render(<StatefulWrapper />)

    const input = screen.getByLabelText('Durée de focus')
    await user.clear(input)
    await user.type(input, '500')
    await user.tab()

    expect(input).toHaveValue(90)
    expect(screen.getByRole('alert')).toHaveTextContent('Ajustée entre 5 et 90.')
  })

  it('les boutons − et + continuent de fonctionner', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <NumericStepper label="Durée de focus" value={25} min={5} max={90} step={5} unit="min" onChange={onChange} />,
    )

    await user.click(screen.getByRole('button', { name: 'Augmenter : Durée de focus' }))
    expect(onChange).toHaveBeenCalledWith(30)

    await user.click(screen.getByRole('button', { name: 'Diminuer : Durée de focus' }))
    expect(onChange).toHaveBeenCalledWith(20)
  })
})
