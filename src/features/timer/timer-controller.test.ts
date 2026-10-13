import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createTimerState, start } from './engine/timer-engine'
import type { TimerState } from './engine/timer-engine'
import { TimerController } from './timer-controller'
import type { TimerStateRepository } from './storage/timer-state-repository'

class FakeTimerStateRepository implements TimerStateRepository {
  stored: TimerState | null = null
  save = vi.fn(async (state: TimerState) => {
    this.stored = state
  })
  async load() {
    return this.stored
  }
  async clear() {
    this.stored = null
  }
}

let repository: FakeTimerStateRepository

beforeEach(() => {
  repository = new FakeTimerStateRepository()
})

describe('TimerController — persistance uniquement sur action', () => {
  it('écrit une fois par action (start, pause, resume, reset), jamais lors d’une simple lecture', async () => {
    const controller = TimerController.createIdle(repository, 'pomodoro', 'focus', 25 * 60_000)

    await controller.start(1_000)
    expect(repository.save).toHaveBeenCalledTimes(1)

    for (let i = 0; i < 20; i++) {
      controller.getSnapshot(1_000 + i * 16)
    }
    expect(repository.save).toHaveBeenCalledTimes(1)

    await controller.pause(2_000)
    expect(repository.save).toHaveBeenCalledTimes(2)

    await controller.resume(3_000)
    expect(repository.save).toHaveBeenCalledTimes(3)

    await controller.reset()
    expect(repository.save).toHaveBeenCalledTimes(4)
  })
})

describe('TimerController — restauration au démarrage', () => {
  it('reprend l’état persisté tel quel s’il n’est pas terminé', async () => {
    const persisted = start(createTimerState('countdown', 'countdown', 10 * 60_000), 1_000)
    repository.stored = persisted

    const controller = await TimerController.restore(
      repository,
      createTimerState('countdown', 'countdown', 10 * 60_000),
      1_000 + 60_000,
    )

    expect(controller.getState()).toEqual(persisted)
    expect(repository.save).not.toHaveBeenCalled()
  })

  it('bascule et persiste l’état « completed » si la session s’est terminée pendant l’absence', async () => {
    const durationMs = 25 * 60_000
    const persisted = start(createTimerState('pomodoro', 'focus', durationMs), 1_000)
    repository.stored = persisted

    const farLater = 1_000 + durationMs + 60_000
    const controller = await TimerController.restore(
      repository,
      createTimerState('pomodoro', 'focus', durationMs),
      farLater,
    )

    expect(controller.getState().status).toBe('completed')
    expect(repository.save).toHaveBeenCalledTimes(1)
    expect(repository.stored?.status).toBe('completed')
  })

  it('utilise l’état de repli quand rien n’est persisté', async () => {
    const fallback = createTimerState('stopwatch', 'stopwatch', null)
    const controller = await TimerController.restore(repository, fallback, 5_000)

    expect(controller.getState()).toEqual(fallback)
    expect(repository.save).not.toHaveBeenCalled()
  })
})
