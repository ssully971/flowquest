import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  onFocusRequested,
  onFocusRequestPending,
  onOpenTasksRequested,
  peekPendingFocusRequest,
  requestFocusOnTask,
  requestOpenTasks,
  takePendingFocusRequest,
} from './panel-requests'

describe('panel-requests', () => {
  beforeEach(() => {
    takePendingFocusRequest()
  })

  it('prévient les écouteurs de l’ouverture du panneau des tâches, jusqu’au désabonnement', () => {
    const listener = vi.fn()
    const off = onOpenTasksRequested(listener)
    requestOpenTasks()
    off()
    requestOpenTasks()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('une demande de focus est notifiée puis consommée une seule fois', () => {
    const requested = vi.fn()
    const pending = vi.fn()
    const offA = onFocusRequested(requested)
    const offB = onFocusRequestPending(pending)

    requestFocusOnTask('t1')
    expect(requested).toHaveBeenCalledWith('t1')
    expect(pending).toHaveBeenCalledTimes(1)
    expect(peekPendingFocusRequest()).toBe('t1')
    expect(takePendingFocusRequest()).toBe('t1')
    expect(takePendingFocusRequest()).toBeNull()
    offA()
    offB()
  })

  it('la dernière demande l’emporte', () => {
    requestFocusOnTask('a')
    requestFocusOnTask('b')
    expect(takePendingFocusRequest()).toBe('b')
  })
})
