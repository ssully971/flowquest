import { X } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useRef } from 'react'

import type { AppMode } from '@/app/useAppMode'
import type { BackgroundSelections } from '@/app/background-selection'
import type { BackgroundId } from '@/shared/design-system'
import type { CustomBackgroundPosition } from '@/shared/storage/db'
import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import { CustomBackgroundError } from '../custom-background'
import { useCustomBackground } from '../custom-background-context'
import type { CustomPhoto } from '../custom-background-context'
import { formatMegabytes } from '../custom-photos'
import { CategoryChip } from './CategoryChip'

const MODES: AppMode[] = ['home', 'focus', 'ambient']
const MODE_LABELS: Record<AppMode, string> = {
  home: strings.common.modeHome,
  focus: strings.common.modeFocus,
  ambient: strings.common.modeAmbient,
}
const DEFAULT_BACKGROUND: Record<'dark' | 'light', BackgroundId> = {
  dark: 'photo-aurore',
  light: 'photo-lueur',
}

interface CustomBackgroundSectionProps {
  /** Mode en cours de réglage (le sélecteur de mode de la page). */
  mode: AppMode
  /** Thème pour lequel on choisit un fond. */
  theme: 'dark' | 'light'
  selections: BackgroundSelections
  onSelect: (mode: AppMode, theme: 'dark' | 'light', id: BackgroundId) => void
}

/**
 * Bibliothèque de photos personnelles : une grille de vignettes (ajout, suppression), plafonnée
 * (nombre de photos et poids total, avec message clair). Un clic affecte la photo au MODE réglé en
 * haut de la page ; chaque mode garde son propre fond et la photo reste mémorisée quand on change
 * de fond ou de mode.
 */
export function CustomBackgroundSection({
  mode,
  theme,
  selections,
  onSelect,
}: CustomBackgroundSectionProps) {
  const { status, photos, usedBytes, maxPhotos, maxBytes, add, remove, setPosition } =
    useCustomBackground()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const s = strings.settings.themes.customBackground
  const isUploading = status === 'uploading'
  const isFull = photos.length >= maxPhotos
  const currentId = selections[mode][theme]
  const selectedPhoto = photos.find((photo) => photo.backgroundId === currentId) ?? null

  const modesUsing = (photo: CustomPhoto): AppMode[] =>
    MODES.filter((candidate) => selections[candidate][theme] === photo.backgroundId)

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const photo = await add(file)
      // Une photo qu'on vient d'ajouter est aussitôt utilisée pour le mode réglé.
      onSelect(mode, theme, photo.backgroundId)
    } catch (error) {
      const message =
        error instanceof CustomBackgroundError
          ? error.message
          : 'Le téléversement a échoué. Réessaie.'
      showToast({ type: 'error', message })
    }
  }

  const handleRemove = async (photo: CustomPhoto) => {
    if (!window.confirm(s.confirmRemove)) return
    await remove(photo.id)
    // Les modes qui utilisaient cette photo reprennent un fond par défaut (une seule fois par mode
    // quand les deux thèmes sont liés : sinon le second appel écraserait le premier).
    for (const candidate of MODES) {
      const selection = selections[candidate]
      if (selection.linked) {
        if (selection.dark === photo.backgroundId)
          onSelect(candidate, 'dark', DEFAULT_BACKGROUND.dark)
        continue
      }
      for (const candidateTheme of ['dark', 'light'] as const) {
        if (selection[candidateTheme] === photo.backgroundId) {
          onSelect(candidate, candidateTheme, DEFAULT_BACKGROUND[candidateTheme])
        }
      }
    }
  }

  if (status === 'loading') return null

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">{s.title}</p>
      <div className="flex max-w-xl flex-col gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] p-4">
        <p className="text-xs text-[var(--panel-muted)]">{s.description}</p>

        {photos.length === 0 ? (
          <p className="text-sm text-[var(--panel-muted)]">{s.empty}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {photos.map((photo, index) => {
              const active = photo.backgroundId === currentId
              const using = modesUsing(photo)
              return (
                <li key={photo.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelect(mode, theme, photo.backgroundId)}
                    aria-pressed={active}
                    aria-label={`${s.photoLabel} ${index + 1}${
                      using.length > 0
                        ? ` — ${s.usedBy}${using.map((m) => MODE_LABELS[m]).join(', ')}`
                        : ''
                    }`}
                    className={`relative block aspect-square w-full overflow-hidden rounded-xl border transition-shadow duration-200 ${
                      active ? 'ring-2 ring-[var(--accent)]' : ''
                    }`}
                    style={{ borderColor: 'var(--panel-line)' }}
                  >
                    <img
                      src={photo.thumbUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {using.length > 0 ? (
                      <span
                        className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-left text-[10px] leading-tight text-[var(--text)]"
                        style={{ background: 'var(--scrim)' }}
                      >
                        {using.map((m) => MODE_LABELS[m]).join(' · ')}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemove(photo)}
                    aria-label={`${s.removeLabel} (${s.photoLabel} ${index + 1})`}
                    className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-white transition-opacity duration-200 hover:opacity-90"
                    style={{ background: 'rgba(0, 0, 0, 0.55)' }}
                  >
                    <X size={12} strokeWidth={2.25} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {selectedPhoto ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--panel-muted)]">{s.position}</span>
            <div className="flex gap-2">
              {(
                [
                  ['top', s.positionTop],
                  ['center', s.positionCenter],
                  ['bottom', s.positionBottom],
                ] as [CustomBackgroundPosition, string][]
              ).map(([value, label]) => (
                <CategoryChip
                  key={value}
                  label={label}
                  active={selectedPhoto.position === value}
                  onClick={() => setPosition(selectedPhoto.id, value)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isFull}
            className="h-10 rounded-xl border border-[var(--panel-line)] px-4 text-sm font-medium text-[var(--panel-text)] transition-opacity duration-200 disabled:opacity-50"
          >
            {isUploading ? s.uploading : s.upload}
          </button>
          <span className="text-xs text-[var(--panel-muted)]" data-testid="photo-usage">
            {s.usage
              .replace('{count}', String(photos.length))
              .replace('{max}', String(maxPhotos))
              .replace('{used}', formatMegabytes(usedBytes))
              .replace('{total}', formatMegabytes(maxBytes))}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid="photo-file-input"
            onChange={(event) => void handleFileSelected(event)}
          />
        </div>
        {isFull ? (
          <p role="status" className="text-xs text-[var(--panel-muted)]">
            {s.limitCount.replace('{max}', String(maxPhotos))}
          </p>
        ) : null}
      </div>
    </div>
  )
}
