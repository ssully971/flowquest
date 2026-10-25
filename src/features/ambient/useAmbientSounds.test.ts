import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAmbientSounds } from './useAmbientSounds'

class FakeAudioBufferSourceNode {
  buffer: AudioBuffer | null = null
  loop = false
  connect = vi.fn().mockReturnThis()
  disconnect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class FakeGainNode {
  gain = { value: 1 }
  connect = vi.fn().mockReturnThis()
  disconnect = vi.fn()
}

class FakeAudioContext {
  state: 'running' | 'suspended' | 'closed' = 'running'
  destination = {}
  createBufferSource = vi.fn(() => new FakeAudioBufferSourceNode())
  createGain = vi.fn(() => new FakeGainNode())
  decodeAudioData = vi.fn().mockResolvedValue({} as AudioBuffer)
  resume = vi.fn(function (this: FakeAudioContext) {
    this.state = 'running'
    return Promise.resolve()
  })
  close = vi.fn().mockResolvedValue(undefined)
}

let lastContext: FakeAudioContext | null = null

describe('useAmbientSounds — moteur des sons d’ambiance, Web Audio API sans coupure (LOT C3)', () => {
  beforeEach(() => {
    // shouldAdvanceTime: waitFor()/findBy* de RTL interrogent via de vrais setTimeout —
    // sans cette option, de faux timers purs les font rester bloqués indéfiniment.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    lastContext = null
    // vi.fn() doit recevoir une "function" classique (pas une arrow function) pour être
    // utilisable via `new` — une arrow function ne peut pas servir de constructeur.
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        lastContext = new FakeAudioContext()
        return lastContext
      }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('démarre sans aucun son actif, avec de la place pour en activer', () => {
    const { result } = renderHook(() => useAmbientSounds())
    expect(result.current.activeIds).toEqual([])
    expect(result.current.canActivateMore).toBe(true)
  })

  it('active un son au premier basculement, le désactive au second', async () => {
    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.toggle('rain'))
    expect(result.current.activeIds).toEqual(['rain'])
    await waitFor(() => expect(lastContext?.createBufferSource).toHaveBeenCalled())

    act(() => result.current.toggle('rain'))
    expect(result.current.activeIds).toEqual([])
  })

  it('refuse un troisième son simultané (deux sons maximum)', () => {
    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.toggle('rain'))
    act(() => result.current.toggle('waves'))
    expect(result.current.canActivateMore).toBe(false)

    act(() => result.current.toggle('forest'))
    expect(result.current.activeIds).toEqual(['rain', 'waves'])
  })

  it('mémorise le volume réglé pour un son', () => {
    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.setVolume('rain', 0.2))
    expect(result.current.volumes.rain).toBe(0.2)
  })

  it('arrête tous les sons quand le minuteur d’arrêt expire', () => {
    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.toggle('rain'))
    act(() => result.current.setSleepTimerMinutes(15))
    expect(result.current.remainingSleepMs).toBe(15 * 60_000)

    act(() => {
      vi.advanceTimersByTime(15 * 60_000 + 1000)
    })

    expect(result.current.activeIds).toEqual([])
    expect(result.current.sleepTimerMinutes).toBeNull()
    expect(result.current.remainingSleepMs).toBeNull()
  })

  it('annule le minuteur d’arrêt si on le remet à « Aucun »', () => {
    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.setSleepTimerMinutes(15))
    act(() => result.current.setSleepTimerMinutes(null))

    expect(result.current.sleepTimerMinutes).toBeNull()
    expect(result.current.remainingSleepMs).toBeNull()
  })

  it('boucle via AudioBufferSourceNode.loop (pas <audio loop>), pour une lecture sans coupure', async () => {
    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.toggle('rain'))
    await waitFor(() => expect(lastContext?.createBufferSource).toHaveBeenCalled())

    const source = lastContext?.createBufferSource.mock.results[0]?.value as FakeAudioBufferSourceNode
    expect(source.loop).toBe(true)
    expect(source.start).toHaveBeenCalled()
  })

  it('règle le volume via un GainNode plutôt que le volume natif (absent sur AudioBufferSourceNode)', async () => {
    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.setVolume('rain', 0.3))
    act(() => result.current.toggle('rain'))
    await waitFor(() => expect(lastContext?.createGain).toHaveBeenCalled())

    const gain = lastContext?.createGain.mock.results[0]?.value as FakeGainNode
    expect(gain.gain.value).toBe(0.3)

    act(() => result.current.setVolume('rain', 0.8))
    expect(gain.gain.value).toBe(0.8)
  })

  it('arrête bien la source Web Audio en désactivant un son déjà démarré', async () => {
    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.toggle('rain'))
    await waitFor(() => expect(lastContext?.createBufferSource).toHaveBeenCalled())
    const source = lastContext?.createBufferSource.mock.results[0]?.value as FakeAudioBufferSourceNode

    act(() => result.current.toggle('rain'))
    expect(source.stop).toHaveBeenCalled()
  })

  it('ne démarre pas la lecture si le son a été désactivé pendant le décodage (annulation de la course)', async () => {
    let resolveDecode: (buffer: AudioBuffer) => void = () => {}
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        lastContext = new FakeAudioContext()
        lastContext.decodeAudioData = vi.fn(
          () => new Promise<AudioBuffer>((resolve) => (resolveDecode = resolve)),
        )
        return lastContext
      }),
    )

    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.toggle('rain'))
    act(() => result.current.toggle('rain'))
    expect(result.current.activeIds).toEqual([])

    await act(async () => {
      resolveDecode({} as AudioBuffer)
      await Promise.resolve()
    })

    expect(lastContext?.createBufferSource).not.toHaveBeenCalled()
  })

  it('couper/rétablir (LOT G1, raccourci M) passe par le gain maître, sans toucher activeIds', async () => {
    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.toggle('rain'))
    await waitFor(() => expect(lastContext?.createGain).toHaveBeenCalled())
    // Deux GainNode créés pour le premier son : le gain propre au son, puis le gain
    // maître (créé paresseusement au moment de la connexion).
    const masterGain = lastContext!.createGain.mock.results[1]!.value as { gain: { value: number } }

    expect(result.current.muted).toBe(false)
    act(() => result.current.toggleMute())
    expect(result.current.muted).toBe(true)
    expect(masterGain.gain.value).toBe(0)
    expect(result.current.activeIds).toEqual(['rain'])

    act(() => result.current.toggleMute())
    expect(result.current.muted).toBe(false)
    expect(masterGain.gain.value).toBe(1)
    expect(result.current.activeIds).toEqual(['rain'])
  })

  it('un nouveau son démarré pendant la coupure reste silencieux jusqu’au rétablissement', async () => {
    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.toggleMute())
    act(() => result.current.toggle('rain'))
    await waitFor(() => expect(lastContext?.createGain).toHaveBeenCalled())

    const masterGain = lastContext!.createGain.mock.results[1]!.value as { gain: { value: number } }
    expect(masterGain.gain.value).toBe(0)
  })
})
