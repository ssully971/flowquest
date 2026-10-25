import { useEffect, useRef } from 'react'

export interface UseDeepFocusParams {
  /** Vrai seulement quand Deep Focus est activé dans les réglages ET que l'écran est sur
   * une session de focus (Pomodoro, segment focus) — jamais sur un minuteur arrêté ou le
   * chronomètre libre : ce calcul reste à la charge de l'appelant (FocusScreen/
   * AmbientScreen). Volontairement indépendant du statut running/paused (voir
   * `isRunning`) : s'il en dépendait, la pause déclenchée par ce hook lui-même ferait
   * passer `enabled` à faux au milieu de l'absence, désinstallant l'écouteur avant le
   * retour sur l'onglet — et donc avant que le toast de reprise n'ait pu se déclencher.
   * Un futur écran de salon de groupe (Mode Amis) qui ne voudrait jamais de Deep Focus
   * n'a qu'à ne pas appeler ce hook, ou lui passer `enabled: false` en permanence.
   */
  enabled: boolean
  graceMs: number
  /** Vérifié au moment précis où l'onglet passe en arrière-plan : si la session n'est pas
   * déjà en cours d'exécution (pause manuelle, minuteur non démarré), ce passage en
   * arrière-plan n'arme aucune pause — Deep Focus n'agit jamais pendant une pause. */
  isRunning: () => boolean
  /** Appelé avec l'horodatage exact du passage en arrière-plan (jamais l'instant réel de
   * l'appel) — à transmettre tel quel à `timer.pause(at)`, le moteur à timestamps gèle
   * alors le temps écoulé à cet instant précis. */
  onPause: (hiddenAt: number) => void
  /** Appelé au retour sur l'onglet, uniquement si une pause a bien été déclenchée durant
   * l'absence (jamais pour un aller-retour pardonné par le délai de grâce). */
  onPausedWhileAway: () => void
}

interface HiddenPeriod {
  hiddenAt: number
  pausedAlready: boolean
}

/**
 * Deep Focus (LOT G2) : met en pause une session de focus quand l'onglet passe en
 * arrière-plan plus longtemps que le délai de grâce — un seul écouteur `visibilitychange`
 * par écran qui l'utilise (Focus, Ambiant), jamais de nouvelle instance du moteur.
 *
 * iPad/iOS gèle souvent l'exécution JS dès qu'un onglet passe en arrière-plan : un
 * `setTimeout` programmé à ce moment-là peut ne jamais se déclencher avant le retour,
 * parfois bien après le délai de grâce. Les deux chemins (le minuteur qui se déclenche
 * pendant que l'onglet est encore cached, ET le retour qui constate après coup que le
 * délai est déjà dépassé) convergent donc vers la même fonction `resolvePause`, gardée
 * idempotente par `pausedAlready` — jamais de double pause.
 */
export function useDeepFocus({
  enabled,
  graceMs,
  isRunning,
  onPause,
  onPausedWhileAway,
}: UseDeepFocusParams): void {
  const isRunningRef = useRef(isRunning)
  const onPauseRef = useRef(onPause)
  const onPausedWhileAwayRef = useRef(onPausedWhileAway)
  useEffect(() => {
    isRunningRef.current = isRunning
  }, [isRunning])
  useEffect(() => {
    onPauseRef.current = onPause
  }, [onPause])
  useEffect(() => {
    onPausedWhileAwayRef.current = onPausedWhileAway
  }, [onPausedWhileAway])

  useEffect(() => {
    if (!enabled) return

    let pending: HiddenPeriod | null = null
    let timeoutId: number | null = null

    const clearPendingTimeout = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    const resolvePause = () => {
      if (!pending || pending.pausedAlready) return
      pending.pausedAlready = true
      onPauseRef.current(pending.hiddenAt)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (!isRunningRef.current()) return
        pending = { hiddenAt: Date.now(), pausedAlready: false }
        // Fonctionne normalement sur ordinateur (le minuteur se déclenche pendant que
        // l'onglet est encore en arrière-plan) ; sur iOS, ce setTimeout peut rester gelé
        // jusqu'au retour — géré ci-dessous par le recalcul explicite à la reprise.
        timeoutId = window.setTimeout(resolvePause, graceMs)
        return
      }

      // Retour sur l'onglet.
      clearPendingTimeout()
      const current = pending
      if (!current) return
      if (Date.now() - current.hiddenAt >= graceMs) resolvePause()
      pending = null
      if (current.pausedAlready) onPausedWhileAwayRef.current()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearPendingTimeout()
    }
  }, [enabled, graceMs])
}
