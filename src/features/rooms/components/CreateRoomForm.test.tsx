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
