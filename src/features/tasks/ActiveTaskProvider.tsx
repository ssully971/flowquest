import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { ActiveTaskContext } from './active-task-context'
import { setActiveTaskIdRef } from './active-task-ref'

// Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
const STORAGE_KEY = 'flowquest.activeTaskId'

function readStored(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function ActiveTaskProvider({ children }: { children: ReactNode }) {
  const [activeTaskId, setActiveTaskIdState] = useState<string | null>(readStored)

  useEffect(() => {
    setActiveTaskIdRef(activeTaskId)
  }, [activeTaskId])

  const setActiveTaskId = useCallback((id: string | null) => {
    setActiveTaskIdState(id)
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id)
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Stockage indisponible (navigation privée) : le choix ne survit pas au rechargement.
    }
  }, [])

  const value = useMemo(() => ({ activeTaskId, setActiveTaskId }), [activeTaskId, setActiveTaskId])

  return <ActiveTaskContext.Provider value={value}>{children}</ActiveTaskContext.Provider>
}
