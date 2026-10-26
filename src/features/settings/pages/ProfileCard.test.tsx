import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProfileCard } from './ProfileCard'

const useAuthMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))

beforeEach(() => {
  useAuthMock.mockReset()
})

describe('ProfileCard — point d’entrée social unique (LOT H2, §1)', () => {
  it('affiche le pseudo et ouvre le panneau social au clic', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'u1' },
      profile: {
        username: 'moi',
        display_name: null,
        avatar_url: null,
        avatar_version: 0,
      },
    })
    const onOpenSocial = vi.fn()
    const user = userEvent.setup()
    render(<ProfileCard onOpenSocial={onOpenSocial} />)

    expect(screen.getByText('moi')).toBeInTheDocument()
    expect(screen.getByText('Amis, salons et classement')).toBeInTheDocument()

    await user.click(screen.getByRole('button'))
    expect(onOpenSocial).toHaveBeenCalled()
  })

  it('préfère le prénom au pseudo quand les deux existent', () => {
    useAuthMock.mockReturnValue({
      user: { id: 'u1' },
      profile: { username: 'moi', display_name: 'Camille', avatar_url: null, avatar_version: 0 },
    })
    render(<ProfileCard onOpenSocial={vi.fn()} />)
    expect(screen.getByText('Camille')).toBeInTheDocument()
  })

  it('affiche « Invité » en mode invité, sans faire planter le rendu', () => {
    useAuthMock.mockReturnValue({ user: null, profile: null })
    render(<ProfileCard onOpenSocial={vi.fn()} />)
    expect(screen.getByText('Invité')).toBeInTheDocument()
  })
})
