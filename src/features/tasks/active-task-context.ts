import { createContext, useContext } from 'react'

export interface ActiveTaskContextValue {
  activeTaskId: string | null
  setActiveTaskId: (id: string | null) => void
}

export const ActiveTaskContext = createContext<ActiveTaskContextValue | null>(null)

export function useActiveTask(): ActiveTaskContextValue {
  const context = useContext(ActiveTaskContext)
  if (!context) {
    throw new Error('useActiveTask doit être utilisé à l’intérieur de ActiveTaskProvider')
  }
  return context
}
