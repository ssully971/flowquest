import { createContext, useContext } from 'react'

import type { CustomBackgroundPosition } from '@/shared/storage/db'

export type CustomBackgroundStatus = 'loading' | 'empty' | 'uploading' | 'ready'

export interface CustomBackgroundContextValue {
  status: CustomBackgroundStatus
  objectUrl: string | null
  position: CustomBackgroundPosition
  upload: (file: File) => Promise<void>
  setPosition: (position: CustomBackgroundPosition) => void
  remove: () => Promise<void>
}

export const CustomBackgroundContext = createContext<CustomBackgroundContextValue | null>(null)

export function useCustomBackground(): CustomBackgroundContextValue {
  const context = useContext(CustomBackgroundContext)
  if (!context) {
    throw new Error('useCustomBackground doit être utilisé à l’intérieur de CustomBackgroundProvider')
  }
  return context
}
