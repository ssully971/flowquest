import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProfileLoading } from './ProfileLoading'

const retryLoadProfile = vi.fn()
vi.mock('../useAuth', () => ({ useAuth: () => ({ retryLoadProfile }) }))

afterEach(() => {
  vi.useRealTimers()
  retryLoadProfile.mockReset()
})

describe('ProfileLoading — squelette puis « Réessayer » (jamais de chargement infini)', () => {
  it('affiche d’abord « Chargement de ton profil… » sans bouton', () => {
    render(<ProfileLoading />)
    expect(screen.getByText('Chargement de ton profil…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })

  it('après 8 s, propose Réessayer qui relance le chargement', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ProfileLoading />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_100)
    })
    expect(screen.getByText('Cela prend plus de temps que d’habitude…')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(retryLoadProfile).toHaveBeenCalledTimes(1)
  })
})
