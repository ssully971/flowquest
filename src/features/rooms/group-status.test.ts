import { describe, expect, it } from 'vitest'

import { participantLiveStatus } from './group-status'

const present = { status: 'joined' as const, isPresent: true }
const running = { status: 'running' as const, phase: 'focus' as const }

describe('participantLiveStatus — statut en direct dans l’horloge de groupe (LOT M3)', () => {
  it('concentré : salon qui tourne en phase de focus', () => {
    expect(participantLiveStatus(present, running)).toBe('focused')
  })

  it('en pause : salon en pause, ou pause Pomodoro', () => {
    expect(participantLiveStatus(present, { status: 'paused', phase: 'focus' })).toBe('paused')
    expect(participantLiveStatus(present, { status: 'running', phase: 'short_break' })).toBe('paused')
    expect(participantLiveStatus(present, { status: 'running', phase: 'long_break' })).toBe('paused')
  })

  it('parti : plus de signe de vie, ou a quitté / abandonné', () => {
    expect(participantLiveStatus({ status: 'joined', isPresent: false }, running)).toBe('away')
    expect(participantLiveStatus({ status: 'left', isPresent: true }, running)).toBe('away')
    expect(participantLiveStatus({ status: 'abandoned', isPresent: false }, running)).toBe('away')
  })

  it('prêt dans le lobby, invité, a refusé', () => {
    expect(participantLiveStatus(present, { status: 'lobby', phase: 'focus' })).toBe('ready')
    expect(participantLiveStatus({ status: 'invited', isPresent: false }, running)).toBe('invited')
    expect(participantLiveStatus({ status: 'declined', isPresent: false }, running)).toBe('declined')
  })
})
