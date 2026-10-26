import { LayoutDashboard, LifeBuoy, Quote, ScrollText, ToggleLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { Logo } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { AdminContentPanel } from './sections/AdminContentPanel'
import { AdminFeaturesPanel } from './sections/AdminFeaturesPanel'
import { AdminJournalPanel } from './sections/AdminJournalPanel'
import { AdminOverviewPanel } from './sections/AdminOverviewPanel'
import { AdminSupportPanel } from './AdminSupportPanel'

type Section = 'overview' | 'features' | 'content' | 'support' | 'journal'

const SECTIONS: { id: Section; icon: LucideIcon }[] = [
  { id: 'overview', icon: LayoutDashboard },
  { id: 'features', icon: ToggleLeft },
  { id: 'content', icon: Quote },
  { id: 'support', icon: LifeBuoy },
  { id: 'journal', icon: ScrollText },
]

/**
 * Panneau Admin refait (lot I2) : navigation latérale sur ordinateur, onglets
 * défilants sur mobile — même structure de section des deux côtés, seule la
 * présentation change (voir la nav dupliquée ci-dessous, chacune masquée à son
 * breakpoint). Esthétique sobre : tokens existants (--text/--muted/--line/--surface),
 * --accent réservé à l'état actif — jamais de violet en masse.
 */
export function AdminPage() {
  const [section, setSection] = useState<Section>('overview')
  const s = strings.admin

  const renderSection = () => {
    switch (section) {
      case 'overview':
        return <AdminOverviewPanel />
      case 'features':
        return <AdminFeaturesPanel />
      case 'content':
        return <AdminContentPanel />
      case 'support':
        return <AdminSupportPanel />
      case 'journal':
        return <AdminJournalPanel />
      default:
        return null
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)] text-[var(--text)] md:flex-row">
      <nav className="hidden w-60 shrink-0 flex-col gap-1 border-r border-[var(--line)] p-5 md:flex">
        <a href="/" className="mb-4 inline-flex w-fit items-center">
          <Logo className="h-6 w-auto" />
        </a>
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {s.title}
        </p>
        {SECTIONS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              aria-current={section === item.id ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors duration-200 ${
                section === item.id
                  ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
              }`}
            >
              <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
              {s.nav[item.id]}
            </button>
          )
        })}
      </nav>

      <nav
        role="tablist"
        aria-label={s.title}
        className="flex gap-2 overflow-x-auto border-b border-[var(--line)] p-3 md:hidden"
      >
        {SECTIONS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={section === item.id}
              onClick={() => setSection(item.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-colors duration-200 ${
                section === item.id
                  ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'border border-[var(--line)] text-[var(--muted)]'
              }`}
            >
              <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
              {s.nav[item.id]}
            </button>
          )
        })}
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto p-5 sm:p-8">
        <h1 className="mb-6 text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          {s.nav[section]}
        </h1>
        {renderSection()}
      </main>
    </div>
  )
}
