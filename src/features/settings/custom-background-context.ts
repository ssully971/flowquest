import { createContext, useContext } from 'react'

import type { CustomBackgroundPosition } from '@/shared/storage/db'

import type { CustomBackgroundId } from './custom-photos'

export type CustomBackgroundStatus = 'loading' | 'ready' | 'uploading'

/** Une photo de la bibliothèque, prête à l'affichage. */
export interface CustomPhoto {
  id: string
  /** Identifiant utilisable comme fond d'un mode (`custom:<id>`). */
  backgroundId: CustomBackgroundId
  /** Image pleine résolution (URL d'objet). */
  url: string
  /** Vignette de la grille (URL d'objet). */
  thumbUrl: string
  position: CustomBackgroundPosition
  /** Poids stocké (octets). */
  size: number
}

export interface CustomBackgroundContextValue {
  status: CustomBackgroundStatus
  photos: CustomPhoto[]
  usedBytes: number
  maxPhotos: number
  maxBytes: number
  /** Redimensionne et ajoute une photo à la bibliothèque ; lève CustomBackgroundError (message
   * français) si le fichier est invalide ou si un plafond est atteint. */
  add: (file: File) => Promise<CustomPhoto>
  remove: (id: string) => Promise<void>
  setPosition: (id: string, position: CustomBackgroundPosition) => void
  getPhoto: (id: string) => CustomPhoto | null
}

export const CustomBackgroundContext = createContext<CustomBackgroundContextValue | null>(null)

export function useCustomBackground(): CustomBackgroundContextValue {
  const context = useContext(CustomBackgroundContext)
  if (!context) {
    throw new Error(
      'useCustomBackground doit être utilisé à l’intérieur de CustomBackgroundProvider',
    )
  }
  return context
}
