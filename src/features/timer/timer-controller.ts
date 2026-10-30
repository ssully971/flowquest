import {
  confirmPresence,
  createTimerState,
  getSnapshot,
  pause,
  reset,
  resume,
  settle,
  start,
} from './engine/timer-engine'
import type { SegmentKind, TimerMode, TimerSnapshot, TimerState } from './engine/timer-engine'
import type { TimerStateRepository } from './storage/timer-state-repository'

export class TimerController {
  private state: TimerState
  private readonly repository: TimerStateRepository

  private constructor(repository: TimerStateRepository, initialState: TimerState) {
    this.repository = repository
    this.state = initialState
  }

  static async restore(
    repository: TimerStateRepository,
    fallback: TimerState,
    now: number = Date.now(),
  ): Promise<TimerController> {
    const stored = await repository.load()
    const controller = new TimerController(repository, stored ?? fallback)
    if (stored) {
      await controller.settleIfFinished(now)
    }
    return controller
  }

  static createIdle(
    repository: TimerStateRepository,
    mode: TimerMode,
    segment: SegmentKind,
    durationMs: number | null,
    guardCarryMs = 0,
  ): TimerController {
    return new TimerController(
      repository,
      createTimerState(mode, segment, durationMs, guardCarryMs),
    )
  }

  getState(): TimerState {
    return this.state
  }

  getSnapshot(now: number = Date.now()): TimerSnapshot {
    return getSnapshot(this.state, now)
  }

  async start(now: number = Date.now()): Promise<TimerState> {
    this.state = start(this.state, now)
    await this.persist()
    return this.state
  }

  async pause(now: number = Date.now()): Promise<TimerState> {
    this.state = pause(this.state, now)
    await this.persist()
    return this.state
  }

  async resume(now: number = Date.now()): Promise<TimerState> {
    this.state = resume(this.state, now)
    await this.persist()
    return this.state
  }

  /** « Je suis là » après la garde de 4 h : le temps d'absence devient du temps de pause. */
  async confirmPresence(now: number = Date.now()): Promise<TimerState> {
    this.state = confirmPresence(this.state, now)
    await this.persist()
    return this.state
  }

  async reset(): Promise<TimerState> {
    this.state = reset(this.state)
    await this.persist()
    return this.state
  }

  async settleIfFinished(now: number = Date.now()): Promise<TimerState> {
    const next = settle(this.state, now)
    if (next !== this.state) {
      this.state = next
      await this.persist()
    }
    return this.state
  }

  private async persist(): Promise<void> {
    await this.repository.save(this.state)
  }
}
