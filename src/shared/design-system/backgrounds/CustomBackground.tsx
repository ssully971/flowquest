import { useCustomBackground } from '@/features/settings/custom-background-context'

import { BackgroundScrim } from './BackgroundScrim'

const OBJECT_POSITION: Record<'top' | 'center' | 'bottom', string> = {
  top: 'center top',
  center: 'center center',
  bottom: 'center bottom',
}

export function CustomBackground() {
  const { objectUrl, position } = useCustomBackground()

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {objectUrl ? (
        <img
          src={objectUrl}
          alt=""
          className="h-full w-full object-cover"
          style={{ objectPosition: OBJECT_POSITION[position] }}
        />
      ) : null}
      <BackgroundScrim />
    </div>
  )
}
