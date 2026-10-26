import { useCallback, useEffect, useRef, useState } from 'react'

import { createCrossfadeLoop } from './crossfade-loop'
import type { CrossfadeLoopHandle } from './crossfade-loop'
import { AMBIENT_SOUNDS, CROSSFADE_OVERLAP_SECONDS, MAX_SIMULTANEOUS_SOUNDS } from './sounds'

const DEFAULT_VOLUME = 0.6

declare global {
  interface Window {
    // Repli Safari historique : certaines versions n'exposent AudioContext que sous ce
    // nom préfixé.
    webkitAudioContext?: typeof AudioContext
  }
}

export interface UseAmbientSoundsResult {
  activeIds: string[]
  volumes: Record<string, number>
  canActivateMore: boolean
  toggle: (id: string) => void
  setVolume: (id: string, volume: number) => void
  sleepTimerMinutes: number | null
  setSleepTimerMinutes: (minutes: number | null) => void
  remainingSleepMs: number | null
  /** Coupure globale (LOT G1, raccourci M) : passe par un GainNode maître plutôt que par
   * stop()/start() de chaque son — un AudioBufferSourceNode ne peut démarrer qu'une seule
   * fois (API Web Audio), le couper puis le relancer redémarrerait la boucle depuis le
   * début. Un gain maître à 0 garde la lecture en cours, juste inaudible, et la reprend
   * exactement là où elle en était au retour. N'affecte jamais `activeIds` : les sons
   * restent sélectionnés dans le panneau pendant la coupure. */
  muted: boolean
  toggleMute: () => void
}

interface ActiveSound {
  loop: CrossfadeLoopHandle
}

/**
 * Moteur des sons d'ambiance (LOT C3, fondu enchaîné lot 4 §1) : Web Audio API
 * (AudioContext + AudioBufferSourceNode) plutôt que `<audio loop>`, qui doit
 * recharger/resynchroniser le flux à chaque tour — un à-coup souvent audible à la
 * jonction, en particulier sur des MP3 qui ont un silence d'encodage en tête (repli LAME
 * courant). Chaque son boucle désormais via `createCrossfadeLoop` (voir crossfade-loop.ts)
 * plutôt que `source.loop = true` : un fondu enchaîné à puissance égale d'1 s masque le
 * raccord entre la fin et le début du fichier source, qu'une boucle native se contente de
 * recoller à l'échantillon près (sans masquer un défaut du fichier lui-même).
 *
 * Au plus deux sons simultanés (MAX_SIMULTANEOUS_SOUNDS), mémoire tampon décodée à la
 * demande et mise en cache (une seule fois par son, réutilisée d'une activation à
 * l'autre), volume par son via le `volumeGain` de la boucle (en aval de son enveloppe de
 * fondu, jamais perturbé par elle), et un minuteur d'arrêt optionnel.
 */
export function useAmbientSounds(): UseAmbientSoundsResult {
  const [activeIds, setActiveIds] = useState<string[]>([])
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [sleepTimerMinutes, setSleepTimerMinutesState] = useState<number | null>(null)
  const [sleepEndAt, setSleepEndAt] = useState<number | null>(null)
  const [remainingSleepMs, setRemainingSleepMs] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)
  const mutedRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map())
  const activeSoundsRef = useRef<Map<string, ActiveSound>>(new Map())
  // Miroir synchrone de `activeIds` : contrairement à l'état React, lisible immédiatement
  // dans la continuation async de startSound pour savoir si le son est toujours voulu une
  // fois son décodage terminé (l'utilisateur a pu le désactiver entre-temps).
  const desiredRef = useRef<Set<string>>(new Set())

  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current) {
      const Ctor = window.AudioContext ?? window.webkitAudioContext
      audioContextRef.current = new Ctor()
    }
    return audioContextRef.current
  }, [])

  const getMasterGain = useCallback((context: AudioContext): GainNode => {
    if (!masterGainRef.current) {
      const gain = context.createGain()
      gain.gain.value = mutedRef.current ? 0 : 1
      gain.connect(context.destination)
      masterGainRef.current = gain
    }
    return masterGainRef.current
  }, [])

  const getOrDecodeBuffer = useCallback(
    async (id: string): Promise<AudioBuffer | null> => {
      const cached = buffersRef.current.get(id)
      if (cached) return cached
      const sound = AMBIENT_SOUNDS.find((candidate) => candidate.id === id)
      if (!sound) return null
      const context = getAudioContext()
      const response = await fetch(sound.src)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await context.decodeAudioData(arrayBuffer)
      buffersRef.current.set(id, audioBuffer)
      return audioBuffer
    },
    [getAudioContext],
  )

  const stopSound = useCallback((id: string) => {
    const active = activeSoundsRef.current.get(id)
    if (!active) return
    active.loop.stop()
    activeSoundsRef.current.delete(id)
  }, [])

  const startSound = useCallback(
    async (id: string) => {
      try {
        const context = getAudioContext()
        if (context.state === 'suspended') await context.resume()
        const buffer = await getOrDecodeBuffer(id)
        // Désactivé entre-temps (pendant le décodage, asynchrone), ou son inconnu : ne
        // pas démarrer une lecture qui ne correspond plus à l'état voulu.
        if (!buffer || !desiredRef.current.has(id)) return

        const loop = createCrossfadeLoop(
          context,
          buffer,
          getMasterGain(context),
          CROSSFADE_OVERLAP_SECONDS,
        )
        loop.volumeGain.gain.value = volumes[id] ?? DEFAULT_VOLUME
        activeSoundsRef.current.set(id, { loop })
      } catch {
        // Décodage, réseau ou API audio indisponible : le son reste simplement inactif
        // plutôt que de faire planter l'appelant.
        desiredRef.current.delete(id)
        setActiveIds((prev) => prev.filter((activeId) => activeId !== id))
      }
    },
    [getAudioContext, getOrDecodeBuffer, getMasterGain, volumes],
  )

  const toggleMute = useCallback(() => {
    setMuted((previous) => {
      const next = !previous
      mutedRef.current = next
      if (masterGainRef.current) masterGainRef.current.gain.value = next ? 0 : 1
      return next
    })
  }, [])

  const stopAll = useCallback(() => {
    for (const id of Array.from(activeSoundsRef.current.keys())) {
      stopSound(id)
    }
    desiredRef.current.clear()
    setActiveIds([])
  }, [stopSound])

  const toggle = useCallback(
    (id: string) => {
      if (desiredRef.current.has(id)) {
        desiredRef.current.delete(id)
        setActiveIds((prev) => prev.filter((activeId) => activeId !== id))
        stopSound(id)
        return
      }
      if (desiredRef.current.size >= MAX_SIMULTANEOUS_SOUNDS) return
      desiredRef.current.add(id)
      setActiveIds((prev) => [...prev, id])
      void startSound(id)
    },
    [stopSound, startSound],
  )

  const setVolume = useCallback((id: string, volume: number) => {
    setVolumes((prev) => ({ ...prev, [id]: volume }))
    const active = activeSoundsRef.current.get(id)
    if (active) active.loop.volumeGain.gain.value = volume
  }, [])

  const setSleepTimerMinutes = useCallback((minutes: number | null) => {
    if (minutes === null) {
      setSleepTimerMinutesState(null)
      setSleepEndAt(null)
      setRemainingSleepMs(null)
      return
    }
    setSleepTimerMinutesState(minutes)
    setSleepEndAt(Date.now() + minutes * 60_000)
    setRemainingSleepMs(minutes * 60_000)
  }, [])

  useEffect(() => {
    if (sleepEndAt === null) return
    const interval = window.setInterval(() => {
      const remaining = sleepEndAt - Date.now()
      if (remaining <= 0) {
        stopAll()
        setSleepTimerMinutesState(null)
        setSleepEndAt(null)
        setRemainingSleepMs(null)
        return
      }
      setRemainingSleepMs(remaining)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [sleepEndAt, stopAll])

  // Coupe tous les sons et ferme le contexte audio au démontage (ex. en quittant le mode
  // Ambiant).
  useEffect(() => {
    const activeSounds = activeSoundsRef.current
    const audioContext = audioContextRef
    return () => {
      for (const active of activeSounds.values()) {
        active.loop.stop()
      }
      void audioContext.current?.close().catch(() => {})
    }
  }, [])

  return {
    activeIds,
    volumes,
    canActivateMore: activeIds.length < MAX_SIMULTANEOUS_SOUNDS,
    toggle,
    setVolume,
    sleepTimerMinutes,
    setSleepTimerMinutes,
    remainingSleepMs,
    muted,
    toggleMute,
  }
}
