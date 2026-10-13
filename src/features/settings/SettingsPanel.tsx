import {
  BarChart3,
  Clock,
  LifeBuoy,
  Megaphone,
  Palette,
  Quote,
  Sparkles,
  Timer,
  User,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { AppMode } from '@/app/useAppMode'
import type { BackgroundId } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { PlaceholderPage } from './pages/PlaceholderPage'
import { ThemesPage } from './pages/ThemesPage'

type PageId =
  'themes' | 'clock' | 'timer' | 'stats' | 'quotes' | 'extras' | 'account' | 'support' | 'changelog'

const NAV_ITEMS: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: 'themes', label: strings.settings.nav.themes, icon: Palette },
  { id: 'clock', label: strings.settings.nav.clock, icon: Clock },
  { id: 'timer', label: strings.settings.nav.timer, icon: Timer },
  { id: 'stats', label: strings.settings.nav.stats, icon: BarChart3 },
  { id: 'quotes', label: strings.settings.nav.quotes, icon: Quote },
  { id: 'extras', label: strings.settings.nav.extras, icon: Sparkles },
  { id: 'account', label: strings.settings.nav.account, icon: User },
  { id: 'support', label: strings.settings.nav.support, icon: LifeBuoy },
  { id: 'changelog', label: strings.settings.nav.changelog, icon: Megaphone },
]

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  backgroundSelection: Record<AppMode, BackgroundId>
  onBackgroundSelect: (mode: AppMode, id: BackgroundId) => void
}

export function SettingsPanel({
  open,
  onClose,
  mode,
  onModeChange,
  backgroundSelection,
  onBackgroundSelect,
}: SettingsPanelProps) {
  const [trackedOpen, setTrackedOpen] = useState(open)
  const [mounted, setMounted] = useState(open)
  const [entered, setEntered] = useState(false)
  const [activePage, setActivePage] = useState<PageId>('themes')

  if (open !== trackedOpen) {
    setTrackedOpen(open)
    if (open) {
      setMounted(true)
    } else {
      setEntered(false)
    }
  }

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setEntered(true))
      return () => cancelAnimationFrame(id)
    }
    const timeoutId = window.setTimeout(() => setMounted(false), 250)
    return () => window.clearTimeout(timeoutId)
  }, [open])

  useEffect(() => {
    if (!mounted) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mounted, onClose])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{ background: 'var(--scrim)', opacity: entered ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={strings.settings.title}
        className="absolute inset-y-0 left-0 flex w-full max-w-[880px] flex-col transition-transform duration-[250ms] ease-out sm:flex-row"
        style={{
          background: 'var(--panel-surface)',
          transform: entered ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <nav
          className="flex shrink-0 flex-row overflow-x-auto border-b sm:w-[264px] sm:flex-col sm:overflow-x-visible sm:border-b-0 sm:border-r"
          style={{ borderColor: 'var(--panel-line)' }}
        >
          <div className="flex items-center justify-between px-5 py-4 sm:hidden">
            <span className="text-sm font-semibold text-[var(--panel-text)]">
              {strings.settings.title}
            </span>
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activePage
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActivePage(item.id)}
                className={`flex shrink-0 items-center gap-3 border-l-[3px] px-5 py-3 text-left text-sm transition-colors duration-200 ${
                  isActive
                    ? 'text-[var(--panel-text)]'
                    : 'border-transparent text-[var(--panel-muted)] hover:text-[var(--panel-text)]'
                }`}
                style={
                  isActive
                    ? { borderColor: 'var(--accent)', background: 'var(--panel-surface-2)' }
                    : undefined
                }
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="relative flex-1 overflow-y-auto p-6 sm:p-10">
          <button
            type="button"
            onClick={onClose}
            aria-label={strings.settings.close}
            className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--panel-muted)] transition-colors duration-200 hover:text-[var(--panel-text)]"
          >
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>

          {activePage === 'themes' ? (
            <ThemesPage
              mode={mode}
              onModeChange={onModeChange}
              selection={backgroundSelection}
              onSelect={onBackgroundSelect}
            />
          ) : (
            <PlaceholderPage
              title={NAV_ITEMS.find((item) => item.id === activePage)?.label ?? ''}
            />
          )}
        </div>
      </div>
    </div>
  )
}
