import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CreateRoomForm } from './CreateRoomForm'

const FRIEND = (id: string, username: string) => ({
  friendshipId: `f-${id}`,
  id,
  username,
  displayName: null,
  avatarUrl: null,
  avatarVersion: 0,
  since: '2026-01-01T00:00:00Z',
  live: { state: null, startedAt: null, durationMs: null, isOnline: false },
})

describe('CreateRoomForm — LOT F3', () => {
  it('affiche un message quand il n’y a pas d’amis à inviter', () => {
    render(<CreateRoomForm friends={[]} onCreate={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.getByText(/Ajoute des amis/)).toBeInTheDocument()
  })

  it('affiche un état de chargement plutôt que « pas d’amis » tant que la liste charge (LOT F4, finitions)', () => {
    render(<CreateRoomForm friends={[]} friendsLoading onCreate={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.getByText('Chargement…')).toBeInTheDocument()
    expect(screen.queryByText(/Ajoute des amis/)).not.toBeInTheDocument()
  })

  it('désactive la création tant qu’aucun ami n’est invité (LOT F4, finitions)', async () => {
    const user = userEvent.setup()
    render(<CreateRoomForm friends={[FRIEND('u1', 'ami1')]} onCreate={vi.fn()} onCreated={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Créer le salon' })).toBeDisabled()

    await user.click(screen.getByText('ami1'))
    expect(screen.getByRole('button', { name: 'Créer le salon' })).toBeEnabled()

    await user.click(screen.getByText('ami1'))
    expect(screen.getByRole('button', { name: 'Créer le salon' })).toBeDisabled()
  })

  it('crée un salon avec la durée choisie et les amis cochés', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue('new-room')
    const onCreated = vi.fn()
    render(
      <CreateRoomForm friends={[FRIEND('u1', 'ami1'), FRIEND('u2', 'ami2')]} onCreate={onCreate} onCreated={onCreated} />,
    )

    await user.click(screen.getByRole('button', { name: '45 min' }))
    await user.click(screen.getByText('ami1'))
    await user.click(screen.getByRole('button', { name: 'Créer le salon' }))

    expect(onCreate).toHaveBeenCalledWith(45, ['u1'])
    expect(onCreated).toHaveBeenCalledWith('new-room')
  })

  it('affiche la durée choisie en direct et la met à jour avec les préréglages (LOT H1, §4)', async () => {
    const user = userEvent.setup()
    render(<CreateRoomForm friends={[FRIEND('u1', 'ami1')]} onCreate={vi.fn()} onCreated={vi.fn()} />)

    expect(screen.getAllByText('25 min').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: '45 min' }))
    expect(screen.getAllByText('45 min').length).toBeGreaterThan(0)
  })

  it('un champ saisissable permet d’entrer une durée exacte (LOT H1, §4)', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue('new-room')
    render(<CreateRoomForm friends={[FRIEND('u1', 'ami1')]} onCreate={onCreate} onCreated={vi.fn()} />)

    const field = screen.getByLabelText('Durée exacte, en minutes')
    await user.clear(field)
    await user.type(field, '50')
    await user.tab()

    expect(screen.getByText('50 min')).toBeInTheDocument()

    await user.click(screen.getByText('ami1'))
    await user.click(screen.getByRole('button', { name: 'Créer le salon' }))
    expect(onCreate).toHaveBeenCalledWith(50, ['u1'])
  })

  it('ajuste une durée saisie hors bornes, avec un message explicite (LOT H1, §4)', async () => {
    const user = userEvent.setup()
    render(<CreateRoomForm friends={[FRIEND('u1', 'ami1')]} onCreate={vi.fn()} onCreated={vi.fn()} />)

    const field = screen.getByLabelText('Durée exacte, en minutes')
    await user.clear(field)
    await user.type(field, '500')
    await user.tab()

    expect(field).toHaveValue(120)
    expect(screen.getByRole('alert')).toHaveTextContent('Ajustée entre 5 et 120.')
  })

  it('plafonne les invitations à 5 amis', async () => {
    const user = userEvent.setup()
    const friends = Array.from({ length: 6 }, (_, i) => FRIEND(`u${i}`, `ami${i}`))
    render(<CreateRoomForm friends={friends} onCreate={vi.fn()} onCreated={vi.fn()} />)

    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByText(`ami${i}`))
    }
    expect(screen.getByText(/au plus 6 personnes/)).toBeInTheDocument()

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes[5]).toBeDisabled()
  })
})
