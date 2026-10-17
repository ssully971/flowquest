import { useEffect, useRef } from 'react'

import type { AppMode } from '@/app/useAppMode'
import { useAuth } from '@/features/auth/useAuth'
import type { ClockSettings } from '@/features/home/clock-settings'
import type { QuotesSettings } from '@/features/home/quotes-settings'
import type { TimerSettings } from '@/features/timer/timer-settings'
import type { Appearance, BackgroundId } from '@/shared/design-system'

import type { ExtrasSettings } from './extras-settings'
import { IndexedDbSettingsRepository } from './storage/indexed-db-settings-repository'
import { SupabaseSettingsRepository } from './storage/supabase-settings-repository'
import type { AppSettings } from './types'

const localRepo = new IndexedDbSettingsRepository()
const remoteRepo = new SupabaseSettingsRepository()

interface UseSettingsSyncParams {
  appearance: Appearance
  setAppearance: (value: Appearance) => void
  backgrounds: Record<AppMode, BackgroundId>
  setBackground: (mode: AppMode, id: BackgroundId) => void
  activeTaskId: string | null
  setActiveTaskId: (id: string | null) => void
  dailyGoalMinutes: number
  setDailyGoalMinutes: (minutes: number) => void
  timerSettings: TimerSettings
  setTimerSettings: (settings: TimerSettings) => void
  clockSettings: ClockSettings
  setClockSettings: (settings: ClockSettings) => void
  quotesSettings: QuotesSettings
  setQuotesSettings: (settings: QuotesSettings) => void
  extrasSettings: ExtrasSettings
  setExtrasSettings: (settings: ExtrasSettings) => void
}

/**
 * Local d'abord (IndexedDB à chaque changement), puis envoi vers Supabase si connecté
 * (file d'attente hors ligne). À la connexion, tire une seule fois les réglages distants
 * et les applique seulement s'ils sont plus récents que la copie locale (dernier
 * horodatage gagne — voir docs/SECURITE.md).
 */
export function useSettingsSync({
  appearance,
  setAppearance,
  backgrounds,
  setBackground,
  activeTaskId,
  setActiveTaskId,
  dailyGoalMinutes,
  setDailyGoalMinutes,
  timerSettings,
  setTimerSettings,
  clockSettings,
  setClockSettings,
  quotesSettings,
  setQuotesSettings,
  extrasSettings,
  setExtrasSettings,
}: UseSettingsSyncParams): void {
  const { status, user } = useAuth()
  const pulledForUserRef = useRef<string | null>(null)

  useEffect(() => {
    const settings: AppSettings = {
      appearance,
      backgrounds,
      activeTaskId,
      dailyGoalMinutes,
      timerSettings,
      clockSettings,
      quotesSettings,
      extrasSettings,
    }
    const updatedAt = Date.now()
    void localRepo.save(settings, updatedAt)
    if (status === 'authenticated' && user) {
      void remoteRepo.save(user.id, settings, updatedAt)
    }
  }, [
    appearance,
    backgrounds,
    activeTaskId,
    dailyGoalMinutes,
    timerSettings,
    clockSettings,
    quotesSettings,
    extrasSettings,
    status,
    user,
  ])

  useEffect(() => {
    if (status !== 'authenticated' || !user) return
    if (pulledForUserRef.current === user.id) return
    pulledForUserRef.current = user.id

    void (async () => {
      const [local, remote] = await Promise.all([localRepo.load(), remoteRepo.load(user.id)])
      if (!remote) return
      if (local && local.updatedAt >= remote.updatedAt) return

      setAppearance(remote.settings.appearance)
      for (const mode of Object.keys(remote.settings.backgrounds) as AppMode[]) {
        setBackground(mode, remote.settings.backgrounds[mode])
      }
      setActiveTaskId(remote.settings.activeTaskId)
      setDailyGoalMinutes(remote.settings.dailyGoalMinutes)
      setTimerSettings(remote.settings.timerSettings)
      setClockSettings(remote.settings.clockSettings)
      setQuotesSettings(remote.settings.quotesSettings)
      setExtrasSettings(remote.settings.extrasSettings)
    })()
  }, [
    status,
    user,
    setAppearance,
    setBackground,
    setActiveTaskId,
    setDailyGoalMinutes,
    setTimerSettings,
    setClockSettings,
    setQuotesSettings,
    setExtrasSettings,
  ])
}
