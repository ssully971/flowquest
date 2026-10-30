import { act, renderHook } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from '@/features/auth/auth-context'
import type { AuthContextValue } from '@/features/auth/auth-context'
import { DEFAULT_SETTINGS } from './types'

const loadLocalMock = vi.fn()
const saveLocalMock = vi.fn()
const loadRemoteMock = vi.fn()
const saveRemoteMock = vi.fn()
const hasOfferedImportMock = vi.fn()

vi.mock('./storage/indexed-db-settings-repository', () => ({
  IndexedDbSettingsRepository: vi.fn().mockImplementation(function () {
    return {
      load: (...args: unknown[]) => loadLocalMock(...args),
      save: (...args: unknown[]) => saveLocalMock(...args),
    }
  }),
}))

vi.mock('./storage/supabase-settings-repository', () => ({
  SupabaseSettingsRepository: vi.fn().mockImplementation(function () {
    return {
      load: (...args: unknown[]) => loadRemoteMock(...args),
      save: (...args: unknown[]) => saveRemoteMock(...args),
    }
  }),
}))

vi.mock('@/features/auth/guest-import', () => ({
  hasOfferedImport: (...args: unknown[]) => hasOfferedImportMock(...args),
}))

const { useSettingsSync } = await import('./useSettingsSync')

function buildAuthValue(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    status: 'guest',
    isSupabaseConfigured: true,
    isReconnecting: false,
    user: null,
    session: null,
    profile: null,
    profileState: 'idle',
    profileError: null,
    profileErrorDetails: null,
    retryLoadProfile: vi.fn(),
    signUpWithEmail: vi.fn(),
    signInWithEmail: vi.fn(),
    signInWithGoogle: vi.fn(),
    signInWithGoogleIdToken: vi.fn(),
    signOut: vi.fn(),
    updateUsername: vi.fn(),
    resendConfirmationEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
    updatePassword: vi.fn(),
    isPasswordRecovery: false,
    clearPasswordRecovery: vi.fn(),
    deleteAccount: vi.fn(),
    updateProfile: vi.fn(),
    ...overrides,
  }
}

function buildParams(
  dailyGoalMinutes = DEFAULT_SETTINGS.dailyGoalMinutes,
  timerSettings = DEFAULT_SETTINGS.timerSettings,
) {
  return {
    appearance: DEFAULT_SETTINGS.appearance,
    setAppearance: vi.fn(),
    backgrounds: DEFAULT_SETTINGS.backgrounds,
    setBackgroundSelection: vi.fn(),
    backgroundDisplaySettings: DEFAULT_SETTINGS.backgroundDisplaySettings,
    setBackgroundDisplaySettings: vi.fn(),
    activeTaskId: null,
    setActiveTaskId: vi.fn(),
    dailyGoalMinutes,
    setDailyGoalMinutes: vi.fn(),
    timerSettings,
    setTimerSettings: vi.fn(),
    clockSettings: DEFAULT_SETTINGS.clockSettings,
    setClockSettings: vi.fn(),
    quotesSettings: DEFAULT_SETTINGS.quotesSettings,
    setQuotesSettings: vi.fn(),
    extrasSettings: DEFAULT_SETTINGS.extrasSettings,
    setExtrasSettings: vi.fn(),
  }
}

function renderWithAuth(authOverrides: Partial<AuthContextValue>, dailyGoalMinutes?: number) {
  const authValue = buildAuthValue(authOverrides)
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(AuthContext.Provider, { value: authValue }, children)
  return renderHook(
    ({ minutes, timerSettings }) => useSettingsSync(buildParams(minutes, timerSettings)),
    {
      wrapper,
      initialProps: {
        minutes: dailyGoalMinutes ?? DEFAULT_SETTINGS.dailyGoalMinutes,
        timerSettings: DEFAULT_SETTINGS.timerSettings,
      },
    },
  )
}

describe('useSettingsSync — synchronisation des réglages avec le compte (LOT A)', () => {
  const USER = { id: 'user-1' } as AuthContextValue['user']

  beforeEach(() => {
    loadLocalMock.mockReset()
    saveLocalMock.mockReset()
    loadRemoteMock.mockReset()
    saveRemoteMock.mockReset()
    hasOfferedImportMock.mockReset()
    loadLocalMock.mockResolvedValue(null)
    saveLocalMock.mockResolvedValue(undefined)
    saveRemoteMock.mockResolvedValue(undefined)
  })

  it('ne pousse jamais vers le compte avant que le tirage initial ait résolu', async () => {
    let resolveRemote: (value: unknown) => void = () => {}
    loadRemoteMock.mockReturnValue(new Promise((resolve) => (resolveRemote = resolve)))

    renderWithAuth({ status: 'authenticated', user: USER })

    // L'effet d'envoi a déjà tourné une fois au premier rendu (synchrone), mais le
    // tirage (asynchrone) n'a pas encore résolu : rien ne doit être parti vers le compte.
    expect(saveRemoteMock).not.toHaveBeenCalled()

    await act(async () => {
      resolveRemote(null)
      await Promise.resolve()
      await Promise.resolve()
    })
  })

  it('pousse les changements une fois le tirage résolu (compte avec réglages distants)', async () => {
    loadRemoteMock.mockResolvedValue({
      schemaVersion: 1,
      settings: DEFAULT_SETTINGS,
      updatedAt: 1, // plus ancien que le local : pas appliqué, mais le tirage résout quand même.
    })
    loadLocalMock.mockResolvedValue({ schemaVersion: 1, settings: DEFAULT_SETTINGS, updatedAt: 2 })

    const { rerender } = renderWithAuth({ status: 'authenticated', user: USER })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    rerender({ minutes: 45, timerSettings: DEFAULT_SETTINGS.timerSettings })

    expect(saveRemoteMock).toHaveBeenCalled()
  })

  it('nouveau compte sans réglages distants : n’envoie rien tant que l’import invité n’est pas tranché', async () => {
    loadRemoteMock.mockResolvedValue(null)
    hasOfferedImportMock.mockReturnValue(false)

    const { rerender } = renderWithAuth({ status: 'authenticated', user: USER })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    rerender({ minutes: 45, timerSettings: DEFAULT_SETTINGS.timerSettings })

    expect(saveRemoteMock).not.toHaveBeenCalled()
    expect(hasOfferedImportMock).toHaveBeenCalledWith('user-1')
  })

  it('nouveau compte sans réglages distants : envoie une fois l’import invité tranché', async () => {
    loadRemoteMock.mockResolvedValue(null)
    hasOfferedImportMock.mockReturnValue(true)

    const { rerender } = renderWithAuth({ status: 'authenticated', user: USER })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    rerender({ minutes: 45, timerSettings: DEFAULT_SETTINGS.timerSettings })

    expect(saveRemoteMock).toHaveBeenCalled()
  })

  it('synchronise le jeu d’icônes de sessions choisi (timerSettings.tallyIconSet, LOT E3)', async () => {
    loadRemoteMock.mockResolvedValue({
      schemaVersion: 1,
      settings: DEFAULT_SETTINGS,
      updatedAt: 1,
    })
    loadLocalMock.mockResolvedValue({ schemaVersion: 1, settings: DEFAULT_SETTINGS, updatedAt: 2 })

    const { rerender } = renderWithAuth({ status: 'authenticated', user: USER })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    rerender({
      minutes: DEFAULT_SETTINGS.dailyGoalMinutes,
      timerSettings: { ...DEFAULT_SETTINGS.timerSettings, tallyIconSet: 'stethoscope' },
    })

    expect(saveRemoteMock).toHaveBeenCalled()
    const pushedSettings = saveRemoteMock.mock.calls.at(-1)?.[1]
    expect(pushedSettings.timerSettings.tallyIconSet).toBe('stethoscope')
  })

  it('enregistre toujours en local, même en mode invité', async () => {
    renderWithAuth({ status: 'guest', user: null })

    await act(async () => {
      await Promise.resolve()
    })

    expect(saveLocalMock).toHaveBeenCalled()
    expect(saveRemoteMock).not.toHaveBeenCalled()
  })
})
