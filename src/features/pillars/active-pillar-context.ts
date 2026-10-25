import { createContext, useContext } from 'react'

export interface ActivePillarContextValue {
  activePillarId: string | null
  setActivePillarId: (id: string | null) => void
}

export const ActivePillarContext = createContext<ActivePillarContextValue | null>(null)

export function useActivePillar(): ActivePillarContextValue {
  const context = useContext(ActivePillarContext)
  if (!context) {
    throw new Error('useActivePillar doit être utilisé à l’intérieur de ActivePillarProvider')
  }
  return context
}
