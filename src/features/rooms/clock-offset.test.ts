import { describe, expect, it } from 'vitest'

import {
  ABSORB_MS,
  MAX_RTT_MS,
  ServerClock,
  effectiveOffsetMs,
  pickBestSample,
  reconcileClockOffset,
  sampleFromExchange,
} from './clock-offset'

/** Échange simulé : l'appareil a `skewMs` d'avance, aller `upMs`, retour `downMs`. */
function exchange(sentAt: number, skewMs: number, upMs: number, downMs: number) {
  const serverNowMs = sentAt - skewMs + upMs // heure serveur à l'arrivée de la requête
  const receivedAt = sentAt + upMs + downMs
  return { sentAt, receivedAt, perfRttMs: upMs + downMs, serverNowMs }
}

describe('sampleFromExchange — milieu de l’aller-retour', () => {
  it('retrouve l’écart exact quand l’aller et le retour sont symétriques', () => {
    const sample = sampleFromExchange(exchange(1_000_000, 4_000, 25, 25))
    expect(sample.offsetMs).toBe(4_000)
    expect(sample.rttMs).toBe(50)
  })

  it('l’erreur ne dépasse jamais la moitié du RTT, même très asymétrique', () => {
    const sample = sampleFromExchange(exchange(1_000_000, 4_000, 10, 590))
    expect(Math.abs(sample.offsetMs - 4_000)).toBeLessThanOrEqual(sample.rttMs / 2)
  })

  it('retient le plus grand RTT des deux horloges (onglet suspendu pendant l’appel)', () => {
    const sample = sampleFromExchange({
      sentAt: 1_000,
      receivedAt: 31_000,
      perfRttMs: 40,
      serverNowMs: 1_000,
    })
    expect(sample.rttMs).toBe(30_000)
  })
})

describe('ServerClock — RTT variable de 50 ms à 20 s', () => {
  it('garde l’échantillon au plus faible RTT et ignore les réponses lentes', () => {
    const clock = new ServerClock()
    const skew = 3_000
    let t = 1_000_000
    const rtts = [800, 20_000, 120, 5_000, 50, 3_000, 15_000, 900]
    const estimates: number[] = []
    for (const rtt of rtts) {
      estimates.push(clock.addExchange(exchange(t, skew, rtt / 2, rtt / 2)))
      t += 10_000
    }
    // Après l'échantillon à 50 ms, l'estimation reste exacte quelles que soient les suivantes.
    expect(estimates.slice(4).every((value) => Math.abs(value - skew) <= 25)).toBe(true)
    expect(Math.abs(clock.offsetMs! - skew)).toBeLessThanOrEqual(25)
  })

  it('une réponse lente (> 2 s) ne remplace jamais un bon échantillon', () => {
    const best = sampleFromExchange(exchange(1_000_000, 1_000, 40, 40))
    const slow = sampleFromExchange(exchange(1_010_000, 1_900, 6_000, 6_000))
    expect(slow.rttMs).toBeGreaterThan(MAX_RTT_MS)
    expect(pickBestSample(best, slow)).toBe(best)
  })

  it('sans bon échantillon, la meilleure réponse lente sert de repli', () => {
    const first = sampleFromExchange(exchange(1_000_000, 1_000, 5_000, 5_000))
    const second = sampleFromExchange(exchange(1_010_000, 1_000, 3_000, 3_000))
    expect(pickBestSample(first, second)).toBe(second)
    expect(pickBestSample(second, first)).toBe(second)
  })

  it('un échantillon valide mais incohérent (heure de l’appareil changée) remplace le meilleur', () => {
    const best = sampleFromExchange(exchange(1_000_000, 1_000, 30, 30))
    const afterClockChange = sampleFromExchange(exchange(1_060_000, 31_000, 100, 100))
    expect(pickBestSample(best, afterClockChange)).toBe(afterClockChange)
  })

  it('un meilleur échantillon trop vieux est renouvelé', () => {
    const best = sampleFromExchange(exchange(1_000_000, 1_000, 30, 30))
    const later = sampleFromExchange(exchange(1_000_000 + 6 * 60_000, 1_040, 300, 300))
    expect(pickBestSample(best, later)).toBe(later)
  })
})

describe('reconcileClockOffset — jamais de saut visible', () => {
  const start = { targetMs: 1_000, residualMs: 0, slewStartedAt: 0 }

  it('première estimation ou changement d’état : appliquée telle quelle', () => {
    expect(reconcileClockOffset(null, 2_000, 10, true)).toEqual({
      targetMs: 2_000,
      residualMs: 0,
      slewStartedAt: 10,
    })
    expect(reconcileClockOffset(start, 9_000, 10, false).targetMs).toBe(9_000)
  })

  it('absorbe un recalage de moins de 1 s : l’écart affiché ne bouge pas', () => {
    const next = reconcileClockOffset(start, 1_000 + ABSORB_MS - 1, 5_000, true)
    expect(effectiveOffsetMs(next, 5_000)).toBe(1_000)
    expect(effectiveOffsetMs(next, 8_000)).toBe(1_000)
  })

  it('résorbe un grand recalage progressivement, sans jamais faire reculer le temps affiché', () => {
    for (const newTarget of [6_000, -4_000]) {
      const next = reconcileClockOffset(start, newTarget, 1_000, true)
      // À l'instant de la réponse, l'affichage est strictement inchangé.
      expect(effectiveOffsetMs(next, 1_000)).toBe(1_000)
      // L'écart affiché converge vers la cible…
      expect(effectiveOffsetMs(next, 1_000 + 60_000)).toBe(newTarget)
      // …et le temps écoulé affiché (now − écart) ne diminue jamais d'un instant au suivant.
      let previous = Number.NEGATIVE_INFINITY
      for (let now = 1_000; now <= 30_000; now += 100) {
        const shown = now - effectiveOffsetMs(next, now)
        expect(shown).toBeGreaterThanOrEqual(previous)
        previous = shown
      }
    }
  })
})
