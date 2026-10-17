import { useCallback, useEffect, useRef, useState } from 'react'

import { AMBIENT_SOUNDS, MAX_SIMULTANEOUS_SOUNDS } from './sounds'

const DEFAULT_VOLUME = 0.6

export interface UseAmbientSoundsResult {
  activeIds: string[]
  volumes: Record<string, number>
  canActivateMore: boolean
  toggle: (id: string) => void
  setVolume: (id: string, volume: number) => void
  sleepTimerMinutes: number | null
  setSleepTimerMinutes: (minutes: number | null) => void
  remainingSleepMs: number | null
}

/** Moteur des sons d'ambiance : au plus deux sons simultanés, chargés à la demande
 * (aucun <audio> créé avant le premier démarrage), bouclés sans coupure, avec un volume
 * par son et un minuteur d'arrêt optionnel. */
export function useAmbientSounds(): UseAmbientSoundsResult {
  const [activeIds, setActiveIds] = useState<string[]>([])
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [sleepTimerMinutes, setSleepTimerMinutesState] = useState<number | null>(null)
  const [sleepEndAt, setSleepEndAt] = useState<number | null>(null)
  const [remainingSleepMs, setRemainingSleepMs] = useState<number | null>(null)
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())

  const getOrCreateAudio = useCallback(
    (id: string) => {
      const existing = audioElementsRef.current.get(id)
      if (existing) return existing
      const sound = AMBIENT_SOUNDS.find((candidate) => candidate.id === id)
      if (!sound) return null
      const audio = new Audio(sound.src)
      audio.loop = true
      audio.volume = volumes[id] ?? DEFAULT_VOLUME
      audioElementsRef.current.set(id, audio)
      return audio
    },
    [volumes],
  )

  const stopAll = useCallback(() => {
    for (const audio of audioElementsRef.current.values()) {
      audio.pause()
    }
    setActiveIds([])
  }, [])

  const toggle = useCallback(
    (id: string) => {
      if (activeIds.includes(id)) {
        audioElementsRef.current.get(id)?.pause()
        setActiveIds((prev) => prev.filter((activeId) => activeId !== id))
        return
      }
      if (activeIds.length >= MAX_SIMULTANEOUS_SOUNDS) return
      const audio = getOrCreateAudio(id)
      // play() renvoie une Promise selon les navigateurs (pas en jsdom) ; si elle est
      // rejetée (lecture bloquée faute d'interaction utilisateur), le son reste
      // simplement inactif plutôt que de faire planter l'appelant.
      const playResult = audio?.play()
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(() => {})
      }
      setActiveIds((prev) => [...prev, id])
    },
    [activeIds, getOrCreateAudio],
  )

  const setVolume = useCallback((id: string, volume: number) => {
    setVolumes((prev) => ({ ...prev, [id]: volume }))
    const audio = audioElementsRef.current.get(id)
    if (audio) audio.volume = volume
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

  // Coupe tous les sons au démontage (ex. en quittant le mode Ambiant).
  useEffect(() => {
    const elements = audioElementsRef.current
    return () => {
      for (const audio of elements.values()) {
        audio.pause()
      }
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
  }
}
