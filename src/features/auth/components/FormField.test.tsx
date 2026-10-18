import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FormField } from './FormField'

describe('FormField — champ de mot de passe avec bouton œil (LOT 1)', () => {
  it('masque le mot de passe par défaut', () => {
    render(<FormField label="Mot de passe" value="secret123" onChange={vi.fn()} type="password" />)
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Afficher le mot de passe' })).toBeInTheDocument()
  })

  it('affiche le mot de passe en clair au clic sur l’œil, puis le remasque', async () => {
    const user = userEvent.setup()
    render(<FormField label="Mot de passe" value="secret123" onChange={vi.fn()} type="password" />)

    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }))
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Masquer le mot de passe' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }))
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password')
  })

  it('n’affiche aucun bouton œil pour un champ non-mot de passe', () => {
    render(<FormField label="Pseudo" value="sully" onChange={vi.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('affiche l’erreur à la place de l’indice quand les deux sont fournis', () => {
    render(
      <FormField
        label="Pseudo"
        value="ab"
        onChange={vi.fn()}
        hint="Un indice"
        error="Pseudo trop court."
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Pseudo trop court.')
    expect(screen.queryByText('Un indice')).not.toBeInTheDocument()
  })
})
