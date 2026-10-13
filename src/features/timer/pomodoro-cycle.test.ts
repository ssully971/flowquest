import { describe, expect, it } from 'vitest'

import { advancePomodoroCycle, createPomodoroCycle } from './pomodoro-cycle'

const config = { sessionsBeforeLongBreak: 4 }

describe('pomodoro-cycle', () => {
  it('passe de focus à pause courte et incrémente le compteur', () => {
    const next = advancePomodoroCycle(createPomodoroCycle(), config)
    expect(next).toEqual({ segment: 'short_break', completedFocusCount: 1 })
  })

  it('revient en focus après une pause courte, sans changer le compteur', () => {
    const afterBreak = advancePomodoroCycle(
      { segment: 'short_break', completedFocusCount: 1 },
      config,
    )
    expect(afterBreak).toEqual({ segment: 'focus', completedFocusCount: 1 })
  })

  it('déclenche une pause longue et réinitialise le compteur au 4e focus', () => {
    const next = advancePomodoroCycle({ segment: 'focus', completedFocusCount: 3 }, config)
    expect(next).toEqual({ segment: 'long_break', completedFocusCount: 0 })
  })

  it('revient en focus après une pause longue', () => {
    const next = advancePomodoroCycle({ segment: 'long_break', completedFocusCount: 0 }, config)
    expect(next).toEqual({ segment: 'focus', completedFocusCount: 0 })
  })
})
