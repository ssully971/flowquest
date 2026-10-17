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
import { useEffect, useRef, useState } from 'react'

import type { AppMode } from '@/app/useAppMode'
import type { ClockSettings } from '@/features/home/clock-settings'
import type { QuotesSettings } from '@/features/home/quotes-settings'
import type { TimerSettings } from '@/features/timer/timer-settings'
import { Logo } from '@/shared/design-system'
import type { BackgroundId } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { CHANGELOG } from './changelog'
import { getLastSeenChangelogVersion, markChangelogSeen } from './changelog-seen'
import type { ExtrasSettings } from './extras-settings'
import { getLastSettingsPage, setLastSettingsPage } from './last-page'
import type { SettingsPageId } from './page-id'
import { AccountPage } from './pages/AccountPage'
import { ChangelogPage } from './pages/ChangelogPage'
import { ClockPage } from './pages/ClockPage'
import { ExtrasPage } from './pages/ExtrasPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { QuotesPage } from './pages/QuotesPage'
import { StatsPage } from './pages/StatsPage'
import { SupportPage } from './pages/SupportPage'
import { ThemesPage } from './pages/ThemesPage'
import { TimerPage } from './pages/TimerPage'

type PageId = SettingsPageId

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
  dailyGoalMinutes: number
  onDailyGoalChange: (minutes: number) => void
  timerSettings: TimerSettings
  onTimerSettingsChange: (settings: TimerSettings) => void
  clockSettings: ClockSettings
  onClockSettingsChange: (settings: ClockSettings) => void
  quotesSettings: QuotesSettings
  onQuotesSettingsChange: (settings: QuotesSettings) => void
  extrasSettings: ExtrasSettings
  onExtrasSettingsChange: (settings: ExtrasSettings) => void
}

export function SettingsPanel({
  open,
  onClose,
  mode,
  onModeChange,
  backgroundSelection,
  onBackgroundSelect,
  dailyGoalMinutes,
  onDailyGoalChange,
  timerSettings,
  onTimerSettingsChange,
  clockSettings,
  onClockSettingsChange,
  quotesSettings,
  onQuotesSettingsChange,
  extrasSettings,
  onExtrasSettingsChange,
}: SettingsPanelProps) {
  // mounted suit `open` à l'ouverture, mais seulement à la fermeture complète (fin de
  // l'animation de la boîte de dialogue) pour laisser le temps à la transition de
  // glissement de jouer. Piloté par l'évènement transitionend plutôt qu'un
  // setTimeout à durée fixe : un minuteur fixe peut se déclencher après coup si le
  // panneau est rouvert entre-temps (course observée avec React 19 + StrictMode), et
  // referme alors le panneau qu'on venait de rouvrir.
  const [mounted, setMounted] = useState(open)
  const [entered, setEntered] = useState(false)
  const [activePage, setActivePage] = useState<PageId>(
    () => getLastSettingsPage() ?? extrasSettings.defaultSettingsTab,
  )
  const [lastSeenChangelogVersion, setLastSeenChangelogVersion] = useState(() =>
    getLastSeenChangelogVersion(),
  )
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const latestChangelogVersion = CHANGELOG[0]?.version
  const hasUnreadChangelog =
    latestChangelogVersion !== undefined && lastSeenChangelogVersion !== latestChangelogVersion

  if (open && !mounted) {
    setMounted(true)
    setActivePage(getLastSettingsPage() ?? extrasSettings.defaultSettingsTab)
  }
  if (!open && entered) {
    setEntered(false)
  }
  if (activePage === 'changelog' && hasUnreadChangelog && latestChangelogVersion !== undefined) {
    markChangelogSeen(latestChangelogVersion)
    setLastSeenChangelogVersion(latestChangelogVersion)
  }

  const handleSelectPage = (page: PageId) => {
    setActivePage(page)
    setLastSettingsPage(page)
  }

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement
      const id = requestAnimationFrame(() => setEntered(true))
      return () => cancelAnimationFrame(id)
    }
    previousFocusRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (entered) closeButtonRef.current?.focus()
  }, [entered])

  useEffect(() => {
    if (!open) return

    const getFocusable = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = getFocusable()
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const handleDialogTransitionEnd = () => {
    if (!open) setMounted(false)
  }

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{ background: 'var(--scrim)', opacity: entered ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={strings.settings.title}
        className="absolute inset-y-0 left-0 flex w-full max-w-[880px] flex-col transition-transform duration-[250ms] ease-out sm:flex-row"
        style={{
          background: 'var(--panel-surface)',
          transform: entered ? 'translateX(0)' : 'translateX(-100%)',
        }}
        onTransitionEnd={handleDialogTransitionEnd}
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
          <div className="hidden px-5 pb-2 pt-6 sm:block">
            <Logo tone="panel" className="h-5 w-auto" />
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activePage
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectPage(item.id)}
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
                {item.id === 'changelog' && hasUnreadChangelog ? (
                  <span
                    aria-label={strings.settings.changelog.unreadBadge}
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: 'var(--accent)' }}
                  />
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className="relative flex-1 overflow-y-auto p-6 sm:p-10">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={strings.settings.close}
            className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--panel-muted)] transition-colors duration-200 hover:text-[var(--panel-text)]"
          >
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>

          <div key={activePage} style={{ animation: 'screen-fade-in 200ms ease-out' }}>
            {activePage === 'themes' ? (
              <ThemesPage
                mode={mode}
                onModeChange={onModeChange}
                selection={backgroundSelection}
                onSelect={onBackgroundSelect}
                disableAnimatedThemes={extrasSettings.disableAnimatedThemes}
              />
            ) : activePage === 'account' ? (
              <AccountPage />
            ) : activePage === 'stats' ? (
              <StatsPage
                dailyGoalMinutes={dailyGoalMinutes}
                onDailyGoalChange={onDailyGoalChange}
              />
            ) : activePage === 'timer' ? (
              <TimerPage settings={timerSettings} onChange={onTimerSettingsChange} />
            ) : activePage === 'clock' ? (
              <ClockPage settings={clockSettings} onChange={onClockSettingsChange} />
            ) : activePage === 'quotes' ? (
              <QuotesPage settings={quotesSettings} onChange={onQuotesSettingsChange} />
            ) : activePage === 'extras' ? (
              <ExtrasPage settings={extrasSettings} onChange={onExtrasSettingsChange} />
            ) : activePage === 'support' ? (
              <SupportPage />
            ) : activePage === 'changelog' ? (
              <ChangelogPage />
            ) : (
              <PlaceholderPage
                title={NAV_ITEMS.find((item) => item.id === activePage)?.label ?? ''}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
