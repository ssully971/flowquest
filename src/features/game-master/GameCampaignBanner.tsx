import { Sparkles, X } from 'lucide-react'
import { useState } from 'react'

import { useFeatureFlag } from '@/features/feature-flags/useFeatureFlag'
import { useGlobalTimerState } from '@/features/timer/useGlobalTimerState'
import { useTimerSettings } from '@/features/timer/timer-settings-context'
import { strings } from '@/shared/i18n'

import { useCurrentCampaign } from './useCurrentCampaign'

const DISMISSED_KEY_PREFIX = 'flowquest.campaignBannerDismissed:'

const END_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

function formatEndsAt(endsAt: string): string {
  const label = END_FORMATTER.format(new Date(endsAt))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function readDismissed(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

/**
 * Bandeau « Double XP » (lot I3, §6) : discret, fermable pour la session en cours (une
 * nouvelle campagne, identifiée par nom+date de fin, redevient visible même si une
 * précédente avait été fermée). Jamais affiché pendant l'écran Deep Focus — approximé ici
 * par « piliers de vie + Deep Focus activés et un segment de focus tourne actuellement »
 * (useGlobalTimerState), sans dépendre d'un état interne à FocusScreen.
 */
export function GameCampaignBanner() {
  const campaign = useCurrentCampaign()
  const deepFocusFlagEnabled = useFeatureFlag('deep_focus')
  const { settings: timerSettings } = useTimerSettings()
  const timerState = useGlobalTimerState()
  const dismissedKey = campaign
    ? `${DISMISSED_KEY_PREFIX}${campaign.name}:${campaign.ends_at}`
    : null
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set())

  if (!campaign || !dismissedKey) return null

  const likelyInDeepFocus =
    deepFocusFlagEnabled && timerSettings.deepFocusEnabled && timerState.liveState === 'focus'
  if (likelyInDeepFocus) return null

  if (dismissedKeys.has(dismissedKey) || readDismissed(dismissedKey)) return null

  const s = strings.gameMaster.banner

  const handleDismiss = () => {
    setDismissedKeys((prev) => new Set(prev).add(dismissedKey))
    try {
      window.sessionStorage.setItem(dismissedKey, 'true')
    } catch {
      // Stockage indisponible : le bandeau réapparaîtra au prochain rendu, tant pis.
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
      <div
        role="status"
        className="glass-panel pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-2.5"
      >
        <Sparkles
          size={18}
          strokeWidth={1.75}
          className="shrink-0 text-[var(--accent)]"
          aria-hidden="true"
        />
        <p className="flex-1 text-sm text-[var(--text)]">
          <span className="font-medium">
            ×{campaign.xp_multiplier} {s.xpSuffix}
          </span>{' '}
          {s.until} {formatEndsAt(campaign.ends_at)}
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={s.dismiss}
          className="-m-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
        >
          <X size={15} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
