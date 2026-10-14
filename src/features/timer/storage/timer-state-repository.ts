import type { TimerState } from '../engine/timer-engine'

export interface TimerStateRepository {
  load(): Promise<TimerState | null>
  save(state: TimerState, updatedAt?: number): Promise<void>
  clear(): Promise<void>
}
