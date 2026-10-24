import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AddFriendForm } from './AddFriendForm'

const PREVIEW = {
  id: 'u1',
  username: 'ssully',
  displayName: 'Sullivan',
  avatarUrl: null,
  avatarVersion: 0,
}

describe('AddFriendForm — ajout par code ou pseudo exact, avec aperçu avant envoi (LOT F1)', () => {
  it('recherche par code par défaut : envoie {code} au clic sur la recherche', async () => {
    const user = userEvent.setup()
    const onPreview = vi.fn().mockResolvedValue(PREVIEW)
    render(<AddFriendForm onPreview={onPreview} onSend={vi.fn().mockResolvedValue(true)} />)

    await user.type(screen.getByLabelText('Code ami (8 caractères)'), 'A3F7K9P2')
    await user.click(screen.getByRole('button', { name: '→' }))

    expect(onPreview).toHaveBeenCalledWith({ code: 'A3F7K9P2' })
    expect(await screen.findByText('Sullivan')).toBeInTheDocument()
  })

  it('bascule vers le mode pseudo et recherche par {username}', async () => {
    const user = userEvent.setup()
    const onPreview = vi.fn().mockResolvedValue(PREVIEW)
    render(<AddFriendForm onPreview={onPreview} onSend={vi.fn().mockResolvedValue(true)} />)

    await user.click(screen.getByRole('button', { name: 'Par pseudo' }))
    await user.type(screen.getByLabelText('Pseudo exact'), 'ssully')
    await user.click(screen.getByRole('button', { name: '→' }))

    expect(onPreview).toHaveBeenCalledWith({ username: 'ssully' })
  })

  it('affiche un message « aucun compte » si la recherche ne trouve personne', async () => {
    const user = userEvent.setup()
    const onPreview = vi.fn().mockResolvedValue(null)
    render(<AddFriendForm onPreview={onPreview} onSend={vi.fn().mockResolvedValue(true)} />)

    await user.type(screen.getByLabelText('Code ami (8 caractères)'), 'ZZZZZZZZ')
    await user.click(screen.getByRole('button', { name: '→' }))

    expect(await screen.findByText('Aucun compte ne correspond.')).toBeInTheDocument()
  })

  it('envoyer la demande appelle onSend puis efface l’aperçu en cas de succès', async () => {
    const user = userEvent.setup()
    const onPreview = vi.fn().mockResolvedValue(PREVIEW)
    const onSend = vi.fn().mockResolvedValue(true)
    render(<AddFriendForm onPreview={onPreview} onSend={onSend} />)

    await user.type(screen.getByLabelText('Code ami (8 caractères)'), 'A3F7K9P2')
    await user.click(screen.getByRole('button', { name: '→' }))
    await screen.findByText('Sullivan')
    await user.click(screen.getByRole('button', { name: 'Envoyer la demande' }))

    expect(onSend).toHaveBeenCalledWith({ code: 'A3F7K9P2' })
    expect(screen.queryByText('Sullivan')).not.toBeInTheDocument()
  })
})
