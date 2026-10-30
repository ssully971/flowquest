import { Info, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { strings } from '@/shared/i18n'

/** Durée d'affichage avant disparition automatique. */
export const GUARD_ANNOUNCEMENT_MS = 8_000

interface GuardAnnouncementProps {
  /** Change à chaque lancement de session / confirmation (0 = jamais). */
  triggerKey: number
  /** Réglage « Annoncer le contrôle des 4 h » (le contrôle, lui, reste toujours actif). */
  enabled: boolean
}

/**
 * Petite carte NON bloquante sur le côté de l'écran : « Dans 4 h de focus, on te demandera si tu es
 * toujours là. » Disparaît toute seule après ~8 s, fermable. Réaffichée après chaque confirmation.
 */
export function GuardAnnouncement({ triggerKey, enabled }: GuardAnnouncementProps) {
  const [seenKey, setSeenKey] = useState(triggerKey)
  const [visible, setVisible] = useState(false)

  // Nouveau déclencheur : on (ré)affiche — ajusté pendant le rendu plutôt que dans un effet.
  if (triggerKey !== seenKey) {
    setSeenKey(triggerKey)
    setVisible(enabled && triggerKey > 0)
  }

  useEffect(() => {
    if (!visible) return
    const timer = window.setTimeout(() => setVisible(false), GUARD_ANNOUNCEMENT_MS)
    return () => window.clearTimeout(timer)
  }, [visible, seenKey])

  if (!visible) return null

  return (
    <div
      role="status"
      className="glass-panel fixed bottom-28 left-3 z-[55] flex max-w-[16rem] items-start gap-2 rounded-2xl px-3.5 py-3 text-xs"
      style={{ color: 'var(--text)' }}
    >
      <Info
        size={14}
        strokeWidth={2}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-[var(--accent)]"
      />
      <p className="flex-1">{strings.focus.presence.announcement}</p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label={strings.focus.presence.announcementClose}
        className="-m-1 shrink-0 rounded-full p-1 text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
      >
        <X size={12} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
