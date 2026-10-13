import { Flame, ListTodo, Maximize2, Minimize2, NotebookPen, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { SettingsPanel } from '@/features/settings/SettingsPanel'
import { IconButton, SegmentedControl, getBackgroundDefinition } from '@/shared/design-system'
import { useFullscreen } from '@/shared/hooks/useFullscreen'
import { strings } from '@/shared/i18n'

import type { AppMode } from './useAppMode'
import { useBackgroundSettings } from './useBackgroundSettings'

interface AppShellProps {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  children: ReactNode
}

const MODE_OPTIONS: { value: AppMode; label: string }[] = [
  { value: 'home', label: strings.common.modeHome },
  { value: 'focus', label: strings.common.modeFocus },
]

export function AppShell({ mode, onModeChange, children }: AppShellProps) {
  const fullscreen = useFullscreen()
  const { selection, setBackground } = useBackgroundSettings()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const CurrentBackground = getBackgroundDefinition(selection[mode]).Component

  return (
    <div className="relative min-h-svh overflow-hidden">
      <CurrentBackground />
      <div className="relative flex min-h-svh flex-col">
        <div className="relative flex-1">{children}</div>

        <div className="flex items-center justify-between gap-4 px-6 pb-6 sm:px-10">
          <div className="flex items-center gap-3">
            <IconButton icon={ListTodo} label={strings.common.tasks} disabled />
            <IconButton icon={NotebookPen} label={strings.common.notes} disabled />
          </div>

          <div className="flex items-center gap-3">
            <div
              className="flex h-12 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-sm text-[var(--muted)]"
              aria-label={`${strings.common.streak} : 0`}
            >
              <Flame size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>0</span>
            </div>
            <SegmentedControl
              ariaLabel={strings.common.mode}
              value={mode}
              onChange={onModeChange}
              options={MODE_OPTIONS}
            />
            <IconButton
              icon={Settings}
              label={strings.common.settings}
              onClick={() => setIsSettingsOpen(true)}
            />
            <IconButton
              icon={fullscreen.isFullscreen ? Minimize2 : Maximize2}
              label={
                fullscreen.isFullscreen ? strings.common.exitFullscreen : strings.common.fullscreen
              }
              onClick={fullscreen.toggle}
            />
          </div>
        </div>
      </div>

      <SettingsPanel
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        mode={mode}
        onModeChange={onModeChange}
        backgroundSelection={selection}
        onBackgroundSelect={setBackground}
      />
    </div>
  )
}
