import { useEffect, useRef } from 'react'

import type { AppMode } from '@/app/useAppMode'
import { hasOfferedImport } from '@/features/auth/guest-import'
import { useAuth } from '@/features/auth/useAuth'
import type { ClockSettings } from '@/features/home/clock-settings'
import type { QuotesSettings } from '@/features/home/quotes-settings'
import type { TimerSettings } from '@/features/timer/timer-settings'
import type { Appearance, BackgroundId } from '@/shared/design-system'

import type { BackgroundDisplaySettings } from './background-display-settings'
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
  backgroundDisplaySettings: BackgroundDisplaySettings
  setBackgroundDisplaySettings: (settings: BackgroundDisplaySettings) => void
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
  backgroundDisplaySettings,
  setBackgroundDisplaySettings,
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
  // Vrai une fois que l'effet de tirage ci-dessous a résolu pour l'utilisateur courant
  // (compte distant lu, appliqué localement s'il était plus récent). Tant que ce n'est
  // pas le cas, l'effet d'envoi juste en dessous ne pousse rien vers le compte : sans
  // cette garde, le premier rendu après connexion pourrait pousser les valeurs encore
  // par défaut (pas encore remplacées par le tirage, qui est asynchrone) et écraser des
  // réglages de compte pourtant valides.
  const pullResolvedForUserRef = useRef<string | null>(null)
  // Vrai si le compte n'avait encore aucun réglage au moment du tirage (nouveau compte) :
  // dans ce cas précis, on attend aussi que GuestImportPrompt ait tranché (importer ou
  // ignorer les réglages invité) avant de pousser quoi que ce soit — sinon l'envoi
  // automatique ci-dessous court-circuiterait ce choix, proposé une seule fois.
  const remoteWasEmptyRef = useRef(false)

  useEffect(() => {
    const settings: AppSettings = {
      appearance,
      backgrounds,
      backgroundDisplaySettings,
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
      const pullResolved = pullResolvedForUserRef.current === user.id
      const waitingOnImportDecision = remoteWasEmptyRef.current && !hasOfferedImport(user.id)
      if (pullResolved && !waitingOnImportDecision) {
        void remoteRepo.save(user.id, settings, updatedAt)
      }
    }
  }, [
    appearance,
    backgrounds,
    backgroundDisplaySettings,
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
      const userId = user.id
      try {
        const [local, remote] = await Promise.all([localRepo.load(), remoteRepo.load(userId)])
        remoteWasEmptyRef.current = !remote
        if (!remote) return
        if (local && local.updatedAt >= remote.updatedAt) return

        setAppearance(remote.settings.appearance)
        for (const mode of Object.keys(remote.settings.backgrounds) as AppMode[]) {
          setBackground(mode, remote.settings.backgrounds[mode])
        }
        setBackgroundDisplaySettings(remote.settings.backgroundDisplaySettings)
        setActiveTaskId(remote.settings.activeTaskId)
        setDailyGoalMinutes(remote.settings.dailyGoalMinutes)
        setTimerSettings(remote.settings.timerSettings)
        setClockSettings(remote.settings.clockSettings)
        setQuotesSettings(remote.settings.quotesSettings)
        setExtrasSettings(remote.settings.extrasSettings)
      } finally {
        pullResolvedForUserRef.current = userId
      }
    })()
  }, [
    status,
    user,
    setAppearance,
    setBackground,
    setBackgroundDisplaySettings,
    setActiveTaskId,
    setDailyGoalMinutes,
    setTimerSettings,
    setClockSettings,
    setQuotesSettings,
    setExtrasSettings,
  ])
}
