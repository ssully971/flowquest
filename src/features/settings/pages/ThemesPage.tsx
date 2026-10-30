import { Monitor, Moon, Sun } from 'lucide-react'
import { useState } from 'react'

import type { AppMode } from '@/app/useAppMode'
import type { BackgroundSelections } from '@/app/background-selection'
import { blurPercentToPx } from '@/features/settings/background-display-settings'
import type { BackgroundDisplaySettings } from '@/features/settings/background-display-settings'
import {
  BACKGROUNDS,
  BigDigits,
  SegmentedControl,
  getBackgroundDefinition,
  useResolvedTheme,
  useTheme,
} from '@/shared/design-system'
import type { BackgroundCategory, BackgroundDefinition, BackgroundId } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { CategoryChip } from './CategoryChip'
import { CustomBackgroundSection } from './CustomBackgroundSection'

const CATEGORY_ORDER: BackgroundCategory[] = [
  'gradients',
  'abstract',
  'scenic',
  'nature',
  'urban',
  'interior',
  'minimal',
  'animated',
]

// Nombre de vignettes visibles par catégorie sur la page « Tous », avant « Tout voir (N) »
// (lot 3 bis, §2 — bibliothèque façon Flocus : une rangée par catégorie, défilement horizontal).
const PREVIEW_COUNT = 4

interface ThemesPageProps {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  selections: BackgroundSelections
  onSelect: (mode: AppMode, theme: 'dark' | 'light', id: BackgroundId) => void
  onLinkedChange: (mode: AppMode, linked: boolean) => void
  disableAnimatedThemes?: boolean
  backgroundDisplaySettings: BackgroundDisplaySettings
  onBackgroundDisplaySettingsChange: (settings: BackgroundDisplaySettings) => void
}

interface BackgroundTileProps {
  bg: BackgroundDefinition
  active: boolean
  onClick: () => void
  className?: string
}

function BackgroundTile({ bg, active, onClick, className = '' }: BackgroundTileProps) {
  const Tile = bg.Thumbnail ?? bg.Component
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={bg.credit}
      className={`relative aspect-square flex-none overflow-hidden rounded-xl border transition-shadow duration-200 ${
        active ? 'ring-2 ring-[var(--accent)]' : ''
      } ${className}`}
      style={{ borderColor: 'var(--panel-line)' }}
    >
      <Tile />
      <span
        className="absolute inset-x-0 bottom-0 px-2 py-1 text-left text-xs text-[var(--text)]"
        style={{ background: 'var(--scrim)' }}
      >
        {bg.label}
      </span>
    </button>
  )
}

export function ThemesPage({
  mode,
  onModeChange,
  selections,
  onSelect,
  onLinkedChange,
  disableAnimatedThemes = false,
  backgroundDisplaySettings,
  onBackgroundDisplaySettingsChange,
}: ThemesPageProps) {
  const { appearance, setAppearance } = useTheme()
  const resolvedTheme = useResolvedTheme()
  const [category, setCategory] = useState<BackgroundCategory | 'all'>('all')
  // Thème pour lequel on choisit un fond (lot 3 bis, §3) : démarre sur le thème actif de
  // l'app, mais reste indépendant ensuite — on doit pouvoir préparer le fond sombre tout en
  // naviguant l'app en thème clair, sans que l'aperçu change de cible sous nos pieds.
  const [editingTheme, setEditingTheme] = useState<'dark' | 'light'>(resolvedTheme)

  const modeSelection = selections[mode]
  const categories = disableAnimatedThemes
    ? CATEGORY_ORDER.filter((cat) => cat !== 'animated')
    : CATEGORY_ORDER
  // Les photos personnelles ne font pas partie du catalogue : elles se choisissent depuis leur
  // propre section (voir <CustomBackgroundSection>).
  const catalogBackgrounds = BACKGROUNDS
  const availableBackgrounds = disableAnimatedThemes
    ? catalogBackgrounds.filter((bg) => bg.category !== 'animated')
    : catalogBackgrounds

  const currentId = modeSelection[editingTheme]
  const current = getBackgroundDefinition(currentId)
  const CurrentPreview = current.Thumbnail ?? current.Component
  const previewBlurPx = blurPercentToPx(backgroundDisplaySettings.blurPercent)
  const filtered =
    category === 'all'
      ? availableBackgrounds
      : availableBackgrounds.filter((bg) => bg.category === category)

  const selectBackground = (id: BackgroundId) => onSelect(mode, editingTheme, id)

  return (
    <div className="flex flex-col gap-8">
      <h2
        className="text-[40px] font-extrabold text-[var(--panel-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {strings.settings.themes.title}
      </h2>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">
          {strings.settings.themes.appearance}
        </p>
        <SegmentedControl
          ariaLabel={strings.appearance.label}
          value={appearance}
          onChange={setAppearance}
          options={[
            { value: 'dark', label: strings.appearance.dark, icon: Moon },
            { value: 'light', label: strings.appearance.light, icon: Sun },
            { value: 'system', label: strings.appearance.system, icon: Monitor },
          ]}
        />
      </div>

      <div>
        <SegmentedControl
          ariaLabel={strings.common.mode}
          value={mode}
          onChange={onModeChange}
          options={[
            { value: 'home', label: strings.common.modeHome },
            { value: 'focus', label: strings.common.modeFocus },
            { value: 'ambient', label: strings.common.modeAmbient },
          ]}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">
          {strings.settings.themes.preview}
        </p>
        <div
          className="relative h-40 w-full max-w-sm overflow-hidden rounded-2xl border"
          style={{ borderColor: 'var(--panel-line)' }}
        >
          <div
            className="absolute inset-0"
            style={
              previewBlurPx > 0
                ? { filter: `blur(${previewBlurPx}px)`, transform: 'scale(1.1)' }
                : undefined
            }
          >
            <CurrentPreview />
          </div>
          <div className="relative flex h-full items-center justify-center">
            <BigDigits label="09:41" sizePx={56} />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--panel-muted)]">
            {strings.settings.themes.editingFor}
          </span>
          <CategoryChip
            label={strings.settings.themes.editingForDark}
            active={editingTheme === 'dark'}
            onClick={() => setEditingTheme('dark')}
          />
          <CategoryChip
            label={strings.settings.themes.editingForLight}
            active={editingTheme === 'light'}
            onClick={() => setEditingTheme('light')}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--panel-muted)]">
          <input
            type="checkbox"
            checked={modeSelection.linked}
            onChange={(event) => onLinkedChange(mode, event.target.checked)}
            className="h-4 w-4 rounded border-[var(--panel-line)] accent-[var(--accent)]"
          />
          {strings.settings.themes.sameForBothThemes}
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-[var(--panel-muted)]">
            {strings.settings.themes.blur}
          </p>
          <span className="text-xs text-[var(--panel-muted)]">
            {backgroundDisplaySettings.blurPercent}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={backgroundDisplaySettings.blurPercent}
          onChange={(event) =>
            onBackgroundDisplaySettingsChange({
              ...backgroundDisplaySettings,
              blurPercent: Number(event.target.value),
            })
          }
          aria-label={strings.settings.themes.blur}
          className="w-full max-w-sm"
        />
        <p className="mt-1 text-xs text-[var(--panel-muted)]">{strings.settings.themes.blurHint}</p>
      </div>

      <CustomBackgroundSection
        mode={mode}
        theme={editingTheme}
        selections={selections}
        onSelect={onSelect}
      />

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--panel-muted)]">
          {strings.settings.themes.library}
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <CategoryChip
            label={strings.settings.themes.allCategories}
            active={category === 'all'}
            onClick={() => setCategory('all')}
          />
          {categories.map((cat) => (
            <CategoryChip
              key={cat}
              label={strings.settings.themes.categories[cat]}
              active={category === cat}
              onClick={() => setCategory(cat)}
            />
          ))}
        </div>

        {category === 'all' ? (
          <div className="flex flex-col gap-6">
            {categories.map((cat) => {
              const items = availableBackgrounds.filter((bg) => bg.category === cat)
              if (items.length === 0) return null
              const preview = items.slice(0, PREVIEW_COUNT)
              return (
                <div key={cat}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--panel-text)]">
                      {strings.settings.themes.categories[cat]}
                    </p>
                    {items.length > PREVIEW_COUNT ? (
                      <button
                        type="button"
                        onClick={() => setCategory(cat)}
                        className="shrink-0 text-xs font-medium text-[var(--accent)] transition-opacity duration-200 hover:opacity-80"
                      >
                        {strings.settings.themes.seeAll} ({items.length})
                      </button>
                    ) : null}
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {preview.map((bg) => (
                      <BackgroundTile
                        key={bg.id}
                        bg={bg}
                        active={bg.id === currentId}
                        onClick={() => selectBackground(bg.id)}
                        className="w-28 sm:w-32"
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--panel-muted)]">
            {strings.settings.themes.emptyCategory}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {filtered.map((bg) => (
              <BackgroundTile
                key={bg.id}
                bg={bg}
                active={bg.id === currentId}
                onClick={() => selectBackground(bg.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
