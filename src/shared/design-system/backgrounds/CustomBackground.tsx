import { useContext } from 'react'

import { CustomBackgroundContext } from '@/features/settings/custom-background-context'

import { BackgroundScrim } from './BackgroundScrim'

const OBJECT_POSITION: Record<'top' | 'center' | 'bottom', string> = {
  top: 'center top',
  center: 'center center',
  bottom: 'center bottom',
}

/** Fond d'une photo de la bibliothèque personnelle. Photo absente (supprimée, pas encore chargée) :
 * simple fond du thème, jamais d'erreur. */
export function CustomBackground({ photoId }: { photoId: string }) {
  const photo = useContext(CustomBackgroundContext)?.getPhoto(photoId) ?? null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {photo ? (
        <img
          src={photo.url}
          alt=""
          className="h-full w-full object-cover"
          style={{ objectPosition: OBJECT_POSITION[photo.position] }}
        />
      ) : null}
      <BackgroundScrim />
    </div>
  )
}
