import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_CLOCK_SETTINGS } from '@/features/home/clock-settings'
import { DEFAULT_QUOTES_SETTINGS } from '@/features/home/quotes-settings'
import { DEFAULT_EXTRAS_SETTINGS } from '@/features/settings/extras-settings'
import { DEFAULT_TIMER_SETTINGS } from '@/features/timer/timer-settings'
import { getDb } from '@/shared/storage/db'

const upsertMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    from: () => ({ upsert: upsertMock }),
  },
}))

async function clearAllStores() {
  const db = await getDb()
  await db.delete('settings', 'current')
  await db.delete('timerState', 'current')
  const sessionKeys = await db.getAllKeys('focusSessions')
  await Promise.all(sessionKeys.map((key) => db.delete('focusSessions', key)))
  const queueKeys = await db.getAllKeys('syncQueue')
  await Promise.all(queueKeys.map((key) => db.delete('syncQueue', key)))
}

describe('hasLocalGuestData — ne propose l’import que s’il y a vraiment quelque chose', () => {
  beforeEach(async () => {
    upsertMock.mockReset()
    upsertMock.mockResolvedValue({ error: null })
    await clearAllStores()
  })

  it('faux sans aucune donnée locale', async () => {
    const { hasLocalGuestData } = await import('./guest-import')
    expect(await hasLocalGuestData()).toBe(false)
  })

  it('faux si les réglages locaux sont encore ceux par défaut', async () => {
    const { IndexedDbSettingsRepository } =
      await import('@/features/settings/storage/indexed-db-settings-repository')
    const { DEFAULT_SETTINGS } = await import('@/features/settings/types')
    await new IndexedDbSettingsRepository().save(DEFAULT_SETTINGS, Date.now())

    const { hasLocalGuestData } = await import('./guest-import')
    expect(await hasLocalGuestData()).toBe(false)
  })

  it('vrai si les réglages locaux diffèrent des valeurs par défaut', async () => {
    const { IndexedDbSettingsRepository } =
      await import('@/features/settings/storage/indexed-db-settings-repository')
    await new IndexedDbSettingsRepository().save(
      {
        appearance: 'dark',
        backgrounds: { home: 'brume', focus: 'horizon', ambient: 'horizon' },
        activeTaskId: null,
        dailyGoalMinutes: 120,
        timerSettings: DEFAULT_TIMER_SETTINGS,
        clockSettings: DEFAULT_CLOCK_SETTINGS,
        quotesSettings: DEFAULT_QUOTES_SETTINGS,
        extrasSettings: DEFAULT_EXTRAS_SETTINGS,
      },
      Date.now(),
    )

    const { hasLocalGuestData } = await import('./guest-import')
    expect(await hasLocalGuestData()).toBe(true)
  })

  it('vrai si un minuteur a déjà été démarré localement', async () => {
    const { IndexedDbTimerStateRepository } =
      await import('@/features/timer/storage/indexed-db-timer-state-repository')
    await new IndexedDbTimerStateRepository().save({
      mode: 'pomodoro',
      segment: 'focus',
      durationMs: 1_500_000,
      startedAt: Date.now(),
      pausedAt: null,
      pausedTotalMs: 0,
      status: 'running',
    })

    const { hasLocalGuestData } = await import('./guest-import')
    expect(await hasLocalGuestData()).toBe(true)
  })
})

describe('importGuestDataToAccount — pousse les données locales vers le compte, sans doublon', () => {
  beforeEach(async () => {
    upsertMock.mockReset()
    upsertMock.mockResolvedValue({ error: null })
    await clearAllStores()
  })

  it('importe les réglages modifiés et le minuteur en cours', async () => {
    const { IndexedDbSettingsRepository } =
      await import('@/features/settings/storage/indexed-db-settings-repository')
    const { IndexedDbTimerStateRepository } =
      await import('@/features/timer/storage/indexed-db-timer-state-repository')
    await new IndexedDbSettingsRepository().save(
      {
        appearance: 'dark',
        backgrounds: { home: 'brume', focus: 'horizon', ambient: 'horizon' },
        activeTaskId: null,
        dailyGoalMinutes: 120,
        timerSettings: DEFAULT_TIMER_SETTINGS,
        clockSettings: DEFAULT_CLOCK_SETTINGS,
        quotesSettings: DEFAULT_QUOTES_SETTINGS,
        extrasSettings: DEFAULT_EXTRAS_SETTINGS,
      },
      Date.now(),
    )
    await new IndexedDbTimerStateRepository().save({
      mode: 'pomodoro',
      segment: 'focus',
      durationMs: 1_500_000,
      startedAt: Date.now(),
      pausedAt: null,
      pausedTotalMs: 0,
      status: 'running',
    })

    const { importGuestDataToAccount } = await import('./guest-import')
    const summary = await importGuestDataToAccount('user-1')

    expect(summary.importedSettings).toBe(true)
    expect(summary.importedTimerState).toBe(true)
    expect(summary.importedSessions).toBe(0)
    expect(upsertMock).toHaveBeenCalledTimes(2)
  })

  it('un import relancé après échec ne crée pas de doublon (upsert, même id)', async () => {
    const db = await getDb()
    await db.put('focusSessions', {
      id: 'session-1',
      kind: 'focus',
      plannedSeconds: 1500,
      actualSeconds: 1500,
      startedAt: Date.now() - 1500_000,
      endedAt: Date.now(),
      completed: true,
      taskId: null,
      syncedAt: null,
    })

    const { importGuestDataToAccount } = await import('./guest-import')
    await importGuestDataToAccount('user-1')
    await importGuestDataToAccount('user-1')

    expect(upsertMock).toHaveBeenCalledTimes(2)
    const firstPayload = upsertMock.mock.calls[0][0]
    const secondPayload = upsertMock.mock.calls[1][0]
    expect(firstPayload.id).toBe('session-1')
    expect(secondPayload.id).toBe('session-1')
  })
})
