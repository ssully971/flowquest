import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GameCampaignBanner } from './GameCampaignBanner'

const useCurrentCampaignMock = vi.fn()
const useFeatureFlagMock = vi.fn()
const useTimerSettingsMock = vi.fn()
const useGlobalTimerStateMock = vi.fn()

vi.mock('./useCurrentCampaign', () => ({ useCurrentCampaign: () => useCurrentCampaignMock() }))
vi.mock('@/features/feature-flags/useFeatureFlag', () => ({
  useFeatureFlag: () => useFeatureFlagMock(),
}))
vi.mock('@/features/timer/timer-settings-context', () => ({
  useTimerSettings: () => useTimerSettingsMock(),
}))
vi.mock('@/features/timer/useGlobalTimerState', () => ({
  useGlobalTimerState: () => useGlobalTimerStateMock(),
}))

const CAMPAIGN = {
  name: 'Week-end Double XP',
  xp_multiplier: 2,
  ends_at: '2026-06-07T20:00:00.000Z',
}

beforeEach(() => {
  window.sessionStorage.clear()
  useCurrentCampaignMock.mockReturnValue(CAMPAIGN)
  useFeatureFlagMock.mockReturnValue(true)
  useTimerSettingsMock.mockReturnValue({ settings: { deepFocusEnabled: true } })
  useGlobalTimerStateMock.mockReturnValue({ liveState: 'inactive' })
})

describe('GameCampaignBanner — bandeau Double XP (lot I3, §6)', () => {
  it('n’affiche rien sans campagne active', () => {
    useCurrentCampaignMock.mockReturnValue(null)
    render(<GameCampaignBanner />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('affiche le multiplicateur quand une campagne est active', () => {
    render(<GameCampaignBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('×2')
  })

  it('reste masqué pendant un segment de focus avec Deep Focus activé', () => {
    useGlobalTimerStateMock.mockReturnValue({ liveState: 'focus' })
    render(<GameCampaignBanner />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('reste visible pendant une pause, même avec Deep Focus activé', () => {
    useGlobalTimerStateMock.mockReturnValue({ liveState: 'pause' })
    render(<GameCampaignBanner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('disparaît définitivement pour cette session une fois fermé', async () => {
    const user = userEvent.setup()
    render(<GameCampaignBanner />)
    await user.click(screen.getByRole('button', { name: 'Fermer ce message' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
