import { getCurrentUserId } from '@/features/auth/current-user'

import { getSnapshot, pause } from './engine/timer-engine'
import { SyncingTimerStateRepository } from './storage/syncing-timer-state-repository'

/**
 * Met en pause le minuteur PERSONNEL s'il tourne (LOT M3) : appelée quand une session de
 * groupe devient active alors qu'aucun écran Focus/Ambiant n'est monté (donc aucun
 * contrôleur en mémoire à piloter). Quand un écran est monté, c'est lui qui se met en pause
 * via son propre contrôleur (voir FocusScreen / AmbientScreen). Un minuteur déjà arrivé à
 * échéance n'est pas touché : useFocusTimer l'enregistrera normalement à la réouverture.
 */
export async function pauseStoredSoloTimerIfRunning(now: number = Date.now()): Promise<void> {
  const repository = new SyncingTimerStateRepository(getCurrentUserId)
  const state = await repository.load()
  if (!state || state.status !== 'running') return
  if (getSnapshot(state, now).isFinished) return
  await repository.save(pause(state, now))
}
