import { useCallback, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/shared/toast'

import { removeAvatarFiles, uploadAvatar } from './avatar-repository'
import {
  AvatarProcessingError,
  cropAndEncodeAvatar,
  loadAvatarImageBitmap,
} from './process-avatar'

export type AvatarUploadStep = 'idle' | 'cropping' | 'uploading'

export interface AvatarCropConfirmTransform {
  viewportSize: number
  zoom: number
  panX: number
  panY: number
}

/** Orchestre le flux complet de la photo de profil (LOT F1) : sélection → recadrage →
 * réduction/encodage côté navigateur → envoi au bucket Storage → mise à jour de
 * profiles.avatar_url. Rien n'est jamais envoyé avant le recadrage confirmé par
 * l'utilisateur (confirmCrop), jamais le fichier d'origine tel quel. */
export function useAvatarUpload() {
  const { user, updateProfile } = useAuth()
  const { showToast } = useToast()
  const [step, setStep] = useState<AvatarUploadStep>('idle')
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectFile = useCallback(async (file: File) => {
    setError(null)
    try {
      const loaded = await loadAvatarImageBitmap(file)
      setBitmap(loaded)
      setStep('cropping')
    } catch (err) {
      setError(err instanceof AvatarProcessingError ? err.message : 'Impossible de lire cette image.')
    }
  }, [])

  const cancelCrop = useCallback(() => {
    bitmap?.close()
    setBitmap(null)
    setStep('idle')
    setError(null)
  }, [bitmap])

  const confirmCrop = useCallback(
    async (transform: AvatarCropConfirmTransform) => {
      if (!bitmap || !user) return
      setStep('uploading')
      setError(null)
      try {
        const processed = await cropAndEncodeAvatar(bitmap, transform)
        const url = await uploadAvatar(user.id, processed)
        await updateProfile({ avatar_url: url })
        showToast({ type: 'success', message: 'Photo de profil mise à jour.' })
        setStep('idle')
      } catch (err) {
        const message =
          err instanceof AvatarProcessingError
            ? err.message
            : 'Impossible d’enregistrer cette photo. Réessaie.'
        setError(message)
        showToast({ type: 'error', message })
        setStep('cropping')
      } finally {
        bitmap.close()
        setBitmap(null)
      }
    },
    [bitmap, user, updateProfile, showToast],
  )

  const removeAvatar = useCallback(async () => {
    if (!user) return
    try {
      await removeAvatarFiles(user.id)
      await updateProfile({ avatar_url: null })
      showToast({ type: 'success', message: 'Photo de profil supprimée.' })
    } catch {
      showToast({ type: 'error', message: 'Impossible de supprimer la photo. Réessaie.' })
    }
  }, [user, updateProfile, showToast])

  return { step, bitmap, error, selectFile, cancelCrop, confirmCrop, removeAvatar }
}
