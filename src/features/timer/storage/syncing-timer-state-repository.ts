import type { TimerState } from '../engine/timer-engine'
import { IndexedDbTimerStateRepository } from './indexed-db-timer-state-repository'
import { SupabaseTimerStateRepository } from './supabase-timer-state-repository'
import type { TimerStateRepository } from './timer-state-repository'

/**
 * Local d'abord (IndexedDB, toujours à jour instantanément), puis file d'attente vers
 * Supabase si un utilisateur est connecté au moment de l'écriture. getUserId est un
 * accesseur dynamique (pas une valeur figée à la construction) car ce dépôt est un
 * singleton créé avant que l'état de connexion soit connu.
 */
export class SyncingTimerStateRepository implements TimerStateRepository {
  private readonly local = new IndexedDbTimerStateRepository()
  private readonly remote = new SupabaseTimerStateRepository()
  private readonly getUserId: () => string | null

  constructor(getUserId: () => string | null) {
    this.getUserId = getUserId
  }

  async load(): Promise<TimerState | null> {
    return this.local.load()
  }

  async save(state: TimerState, updatedAt: number = Date.now()): Promise<void> {
    await this.local.save(state, updatedAt)
    const userId = this.getUserId()
    if (userId) {
      await this.remote.save(userId, state, updatedAt)
    }
  }

  async clear(): Promise<void> {
    await this.local.clear()
  }
}
