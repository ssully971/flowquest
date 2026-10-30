import { describe, expect, it } from 'vitest'

import { GUARD_INTERVAL_MS, createTimerState } from './engine/timer-engine'
import { carryAfterSegment, isPomodoroPresenceDue, mustAskBeforeNextFocus } from './presence-guard'

const H = 3_600_000
const FOCUS = 25 * 60_000

describe('garde anti-oubli — Pomodoro (focus cumulé)', () => {
  it('seules les phases de focus alimentent le cumul, pas les pauses courtes ni longues', () => {
    expect(carryAfterSegment(0, 'focus', FOCUS)).toBe(FOCUS)
    expect(carryAfterSegment(FOCUS, 'short_break', 5 * 60_000)).toBe(FOCUS)
    expect(carryAfterSegment(FOCUS, 'long_break', 20 * 60_000)).toBe(FOCUS)
    expect(carryAfterSegment(FOCUS, 'focus', -5)).toBe(FOCUS)
  })

  it('simule un Pomodoro infini : la question tombe à la fin de la pause qui suit le focus franchissant 4 h', () => {
    // Focus de 25 min, pause courte de 5 min, pause longue de 20 min toutes les 4 sessions.
    let carry = 0
    let asks = 0
    let focusDone = 0
    for (let index = 0; index < 60; index += 1) {
      const isFocus = index % 2 === 0
      const kind = isFocus
        ? 'focus'
        : Math.floor(index / 2) % 4 === 3
          ? 'long_break'
          : 'short_break'
      carry = carryAfterSegment(carry, kind, isFocus ? FOCUS : 5 * 60_000)
      if (isFocus) focusDone += 1
      if (mustAskBeforeNextFocus(kind, carry)) {
        asks += 1
        // « Je suis là » : le compteur est réarmé.
        expect(focusDone * FOCUS).toBeGreaterThanOrEqual(GUARD_INTERVAL_MS)
        carry = 0
        focusDone = 0
      }
    }
    // 4 h = 9,6 focus de 25 min : la question tombe après le 10e focus (puis chaque 10 focus).
    expect(asks).toBe(3)
  })

  it('pas de question pendant un focus ni tant que 4 h ne sont pas atteintes', () => {
    expect(mustAskBeforeNextFocus('focus', 5 * H)).toBe(false)
    expect(mustAskBeforeNextFocus('short_break', 4 * H - 1)).toBe(false)
    expect(mustAskBeforeNextFocus('short_break', 4 * H)).toBe(true)
    expect(mustAskBeforeNextFocus('long_break', 9 * H)).toBe(true)
  })

  it('la confirmation est due pour un focus inactif portant 4 h cumulées (exact après rechargement)', () => {
    expect(isPomodoroPresenceDue(createTimerState('pomodoro', 'focus', FOCUS, 4 * H))).toBe(true)
    expect(isPomodoroPresenceDue(createTimerState('pomodoro', 'focus', FOCUS, 4 * H - 1))).toBe(
      false,
    )
    expect(
      isPomodoroPresenceDue(createTimerState('pomodoro', 'short_break', 5 * 60_000, 5 * H)),
    ).toBe(false)
    expect(
      isPomodoroPresenceDue({
        ...createTimerState('pomodoro', 'focus', FOCUS, 5 * H),
        status: 'running',
      }),
    ).toBe(false)
    expect(isPomodoroPresenceDue(createTimerState('stopwatch', 'stopwatch', null, 5 * H))).toBe(
      false,
    )
  })
})
