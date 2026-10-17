import { Monitor, Moon, Sun } from 'lucide-react'
import { useState } from 'react'

import type { AppMode } from '@/app/useAppMode'
import {
  BACKGROUNDS,
  BigDigits,
  SegmentedControl,
  getBackgroundDefinition,
  useTheme,
} from '@/shared/design-system'
import type { BackgroundCategory, BackgroundId } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { CategoryChip } from './CategoryChip'

const CATEGORY_ORDER: BackgroundCategory[] = [
  'gradients',
  'abstract',
  'scenic',
  'nature',
  'urban',
  'interior',
  'animated',
]

interface ThemesPageProps {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  selection: Record<AppMode, BackgroundId>
  onSelect: (mode: AppMode, id: BackgroundId) => void
  disableAnimatedThemes?: boolean
}

export function ThemesPage({
  mode,
  onModeChange,
  selection,
  onSelect,
  disableAnimatedThemes = false,
}: ThemesPageProps) {
  const { appearance, setAppearance } = useTheme()
  const [category, setCategory] = useState<BackgroundCategory | 'all'>('all')

  const categories = disableAnimatedThemes
    ? CATEGORY_ORDER.filter((cat) => cat !== 'animated')
    : CATEGORY_ORDER
  const availableBackgrounds = disableAnimatedThemes
    ? BACKGROUNDS.filter((bg) => bg.category !== 'animated')
    : BACKGROUNDS

  const currentId = selection[mode]
  const current = getBackgroundDefinition(currentId)
  const CurrentPreview = current.Thumbnail ?? current.Component
  const filtered =
    category === 'all'
      ? availableBackgrounds
      : availableBackgrounds.filter((bg) => bg.category === category)

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
          <CurrentPreview />
          <div className="relative flex h-full items-center justify-center">
            <BigDigits label="09:41" sizePx={56} />
          </div>
        </div>
      </div>

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

        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--panel-muted)]">
            {strings.settings.themes.emptyCategory}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {filtered.map((bg) => {
              const Tile = bg.Thumbnail ?? bg.Component
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => onSelect(mode, bg.id)}
                  aria-pressed={bg.id === currentId}
                  title={bg.credit}
                  className={`relative aspect-square overflow-hidden rounded-xl border transition-shadow duration-200 ${
                    bg.id === currentId ? 'ring-2 ring-[var(--accent)]' : ''
                  }`}
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
            })}
          </div>
        )}
      </div>
    </div>
  )
}
