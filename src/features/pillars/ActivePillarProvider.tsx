import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { ActivePillarContext } from './active-pillar-context'
import { setActivePillarIdRef } from './active-pillar-ref'

// Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
const STORAGE_KEY = 'flowquest.activePillarId'

function readStored(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function ActivePillarProvider({ children }: { children: ReactNode }) {
  const [activePillarId, setActivePillarIdState] = useState<string | null>(readStored)

  useEffect(() => {
    setActivePillarIdRef(activePillarId)
  }, [activePillarId])

  const setActivePillarId = useCallback((id: string | null) => {
    setActivePillarIdState(id)
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id)
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Stockage indisponible (navigation privée) : le choix ne survit pas au rechargement.
    }
  }, [])

  const value = useMemo(
    () => ({ activePillarId, setActivePillarId }),
    [activePillarId, setActivePillarId],
  )

  return <ActivePillarContext.Provider value={value}>{children}</ActivePillarContext.Provider>
}
