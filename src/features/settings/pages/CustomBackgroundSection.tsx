import type { ChangeEvent } from 'react'
import { useRef } from 'react'

import type { AppMode } from '@/app/useAppMode'
import type { BackgroundId } from '@/shared/design-system'
import type { CustomBackgroundPosition } from '@/shared/storage/db'
import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import { CustomBackgroundError } from '../custom-background'
import { useCustomBackground } from '../custom-background-context'
import { CategoryChip } from './CategoryChip'

const OBJECT_POSITION: Record<CustomBackgroundPosition, string> = {
  top: 'center top',
  center: 'center center',
  bottom: 'center bottom',
}

interface CustomBackgroundSectionProps {
  mode: AppMode
  currentId: BackgroundId
  onSelect: (mode: AppMode, id: BackgroundId) => void
}

export function CustomBackgroundSection({
  mode,
  currentId,
  onSelect,
}: CustomBackgroundSectionProps) {
  const { status, objectUrl, position, upload, setPosition, remove } = useCustomBackground()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const s = strings.settings.themes.customBackground
  const isActive = currentId === 'custom'
  const isUploading = status === 'uploading'

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      await upload(file)
    } catch (error) {
      const message =
        error instanceof CustomBackgroundError
          ? error.message
          : 'Le téléversement a échoué. Réessaie.'
      showToast({ type: 'error', message })
    }
  }

  if (status === 'loading') return null

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">{s.title}</p>
      <div className="flex max-w-sm flex-col gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] p-4">
        <p className="text-xs text-[var(--panel-muted)]">{s.description}</p>

        {objectUrl ? (
          <div className="relative h-28 w-full overflow-hidden rounded-xl">
            <img
              src={objectUrl}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: OBJECT_POSITION[position] }}
            />
          </div>
        ) : null}

        {objectUrl ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--panel-muted)]">{s.position}</span>
            <div className="flex gap-2">
              <CategoryChip
                label={s.positionTop}
                active={position === 'top'}
                onClick={() => setPosition('top')}
              />
              <CategoryChip
                label={s.positionCenter}
                active={position === 'center'}
                onClick={() => setPosition('center')}
              />
              <CategoryChip
                label={s.positionBottom}
                active={position === 'bottom'}
                onClick={() => setPosition('bottom')}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="h-10 rounded-xl border border-[var(--panel-line)] px-4 text-sm font-medium text-[var(--panel-text)] transition-opacity duration-200 disabled:opacity-50"
          >
            {isUploading ? s.uploading : objectUrl ? s.replace : s.upload}
          </button>
          {objectUrl ? (
            <button
              type="button"
              onClick={() => onSelect(mode, 'custom')}
              disabled={isActive}
              className="h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-50"
            >
              {isActive ? s.inUse : s.use}
            </button>
          ) : null}
          {objectUrl ? (
            <button
              type="button"
              onClick={() => void remove()}
              className="h-10 rounded-xl border border-[#E5484D]/40 px-4 text-sm font-medium text-[#E5484D] transition-colors duration-200 hover:bg-[#E5484D]/10"
            >
              {s.remove}
            </button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void handleFileSelected(event)}
          />
        </div>
      </div>
    </div>
  )
}
