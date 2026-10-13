import { Maximize2, Monitor, Moon, Settings, Sun } from 'lucide-react'

import { HorizonBackground, IconButton, SegmentedControl, useTheme } from '@/shared/design-system'
import type { Appearance } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

const appearanceOptions: { value: Appearance; label: string; icon: typeof Moon }[] = [
  { value: 'dark', label: strings.appearance.dark, icon: Moon },
  { value: 'light', label: strings.appearance.light, icon: Sun },
  { value: 'system', label: strings.appearance.system, icon: Monitor },
]

export function App() {
  const { appearance, setAppearance } = useTheme()

  return (
    <div className="relative min-h-svh overflow-hidden">
      <HorizonBackground />
      <div className="relative flex min-h-svh flex-col items-center justify-center gap-8 px-4 text-center">
        <div>
          <h1 className="text-[40px] font-extrabold text-[var(--text)]">{strings.app.name}</h1>
          <p className="mt-2 text-base text-[var(--muted)]">{strings.app.tagline}</p>
        </div>

        <SegmentedControl
          ariaLabel={strings.appearance.label}
          options={appearanceOptions}
          value={appearance}
          onChange={setAppearance}
        />

        <div className="flex items-center gap-3">
          <IconButton icon={Settings} label="Réglages" />
          <IconButton icon={Maximize2} label="Plein écran" />
        </div>
      </div>
    </div>
  )
}
