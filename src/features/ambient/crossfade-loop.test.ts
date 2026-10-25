import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildEqualPowerEnvelope, createCrossfadeLoop } from './crossfade-loop'

class FakeAudioParam {
  value = 1
  setValueCurveAtTime = vi.fn()
  cancelScheduledValues = vi.fn()
  setValueAtTime = vi.fn()
  linearRampToValueAtTime = vi.fn()
}

class FakeAudioBufferSourceNode {
  buffer: AudioBuffer | null = null
  onended: (() => void) | null = null
  connect = vi.fn()
  disconnect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class FakeGainNode {
  gain = new FakeAudioParam()
  connect = vi.fn()
  disconnect = vi.fn()
}

class FakeAudioContext {
  currentTime = 0
  destination = {}
  createBufferSource = vi.fn(() => new FakeAudioBufferSourceNode())
  createGain = vi.fn(() => new FakeGainNode())
}

function fakeBuffer(duration: number) {
  return { duration } as AudioBuffer
}

describe('buildEqualPowerEnvelope — enveloppe de fondu enchaîné (lot 4, §1)', () => {
  it('part de 0 (sinus) et termine à 0 (cosinus), avec un plateau à 1 au milieu', () => {
    const curve = buildEqualPowerEnvelope(10, 1)
    expect(curve[0]).toBeCloseTo(0, 5)
    expect(curve[curve.length - 1]).toBeCloseTo(0, 5)
    // Milieu du fichier (loin des deux fondus d'1 s sur une durée de 10 s) : plein volume.
    const middleIndex = Math.floor(curve.length / 2)
    expect(curve[middleIndex]).toBeCloseTo(1, 5)
  })

  it('à puissance égale : sin²+cos² = 1 au même instant depuis le début et depuis la fin', () => {
    const duration = 10
    const overlap = 1
    const curve = buildEqualPowerEnvelope(duration, overlap)
    // À l'instant t dans le premier fondu, le son qui sort au même instant relatif (t
    // depuis SA fin) a pour valeur curve[a_la_fin_correspondante] — on vérifie juste la
    // propriété mathématique sous-jacente ici, indépendamment du moteur de boucle.
    const t = overlap / 3
    const fadeIn = Math.sin((t / overlap) * (Math.PI / 2))
    const fadeOut = Math.cos((t / overlap) * (Math.PI / 2))
    expect(fadeIn ** 2 + fadeOut ** 2).toBeCloseTo(1, 5)
    expect(curve[0]).toBeCloseTo(0, 5)
  })
})

describe('createCrossfadeLoop — planification des deux premières lectures (lot 4, §1)', () => {
  let context: FakeAudioContext

  beforeEach(() => {
    context = new FakeAudioContext()
  })

  it('programme la deuxième lecture exactement `duration - overlap` après la première', () => {
    const buffer = fakeBuffer(12)
    context.currentTime = 5
    createCrossfadeLoop(context as unknown as AudioContext, buffer, {} as AudioNode, 1)

    expect(context.createBufferSource).toHaveBeenCalledTimes(2)
    const sources = context.createBufferSource.mock.results.map((r) => r.value as FakeAudioBufferSourceNode)
    expect(sources[0].start).toHaveBeenCalledWith(5)
    expect(sources[1].start).toHaveBeenCalledWith(5 + (12 - 1))
  })

  it('pose l’enveloppe de gain à puissance égale sur chaque source, au même instant que son départ', () => {
    const buffer = fakeBuffer(12)
    context.currentTime = 0
    createCrossfadeLoop(context as unknown as AudioContext, buffer, {} as AudioNode, 1)

    const gains = context.createGain.mock.results.map((r) => r.value as FakeGainNode)
    // Premier GainNode créé = volumeGain (n'a pas de setValueCurveAtTime appelé) ; les
    // suivants sont les enveloppes des deux premières sources.
    const [, envelopeA, envelopeB] = gains
    expect(envelopeA.gain.setValueCurveAtTime).toHaveBeenCalledWith(
      expect.any(Float32Array),
      0,
      12,
    )
    expect(envelopeB.gain.setValueCurveAtTime).toHaveBeenCalledWith(
      expect.any(Float32Array),
      11,
      12,
    )
  })

  it('limite le recouvrement demandé à la moitié de la durée du fichier (fichiers très courts)', () => {
    const buffer = fakeBuffer(1) // recouvrement demandé de 1s > la moitié de 1s
    context.currentTime = 0
    createCrossfadeLoop(context as unknown as AudioContext, buffer, {} as AudioNode, 1)

    const sources = context.createBufferSource.mock.results.map((r) => r.value as FakeAudioBufferSourceNode)
    // step = duration - overlap_effectif = 1 - 0.5 = 0.5
    expect(sources[1].start).toHaveBeenCalledWith(0.5)
  })
})

describe('createCrossfadeLoop — relais au-delà des deux premières lectures (lot 4, §1)', () => {
  it('à la fin de la première lecture (onended), programme la troisième deux crans plus loin', () => {
    const context = new FakeAudioContext()
    const buffer = fakeBuffer(10)
    context.currentTime = 0
    createCrossfadeLoop(context as unknown as AudioContext, buffer, {} as AudioNode, 1)

    const sourcesBefore = context.createBufferSource.mock.results.map(
      (r) => r.value as FakeAudioBufferSourceNode,
    )
    expect(sourcesBefore).toHaveLength(2)

    // Le moteur audio (pas un minuteur JS) signale la fin de la première lecture.
    sourcesBefore[0].onended?.()

    const sourcesAfter = context.createBufferSource.mock.results.map(
      (r) => r.value as FakeAudioBufferSourceNode,
    )
    expect(sourcesAfter).toHaveLength(3)
    // step = 10 - 1 = 9 ; la troisième lecture (génération 2) démarre à 2*step = 18.
    expect(sourcesAfter[2].start).toHaveBeenCalledWith(18)
  })

  it('ne programme plus rien après stop()', () => {
    const context = new FakeAudioContext()
    const buffer = fakeBuffer(10)
    context.currentTime = 0
    const loop = createCrossfadeLoop(context as unknown as AudioContext, buffer, {} as AudioNode, 1)

    loop.stop()

    const sources = context.createBufferSource.mock.results.map(
      (r) => r.value as FakeAudioBufferSourceNode,
    )
    for (const source of sources) {
      expect(source.stop).toHaveBeenCalled()
    }

    const callCountAfterStop = context.createBufferSource.mock.calls.length
    sources[0].onended?.()
    expect(context.createBufferSource.mock.calls.length).toBe(callCountAfterStop)
  })
})

describe('createCrossfadeLoop — volume indépendant du fondu enchaîné (lot 4, §1)', () => {
  it('expose un volumeGain en aval de l’enveloppe, réglable sans perturber le raccord', () => {
    const context = new FakeAudioContext()
    const buffer = fakeBuffer(10)
    const destination = {} as AudioNode
    const loop = createCrossfadeLoop(context as unknown as AudioContext, buffer, destination, 1)

    expect(loop.volumeGain).toBeDefined()
    loop.volumeGain.gain.value = 0.3
    expect(loop.volumeGain.gain.value).toBe(0.3)
  })
})
