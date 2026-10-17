import { useState } from 'react'

import { strings } from '@/shared/i18n'

import { AdminChangelogPanel } from './AdminChangelogPanel'
import { AdminQuotesPanel } from './AdminQuotesPanel'
import { AdminSupportPanel } from './AdminSupportPanel'

type AdminTab = 'quotes' | 'changelog' | 'support'

const TABS: AdminTab[] = ['quotes', 'changelog', 'support']

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('quotes')
  const s = strings.admin

  return (
    <div className="flex min-h-dvh flex-col gap-6 bg-[var(--bg)] p-6 text-[var(--text)]">
      <h1
        className="text-2xl font-semibold"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {s.title}
      </h1>

      <div role="tablist" className="flex gap-2 border-b border-[var(--line)] pb-2">
        {TABS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="tab"
            aria-selected={tab === candidate}
            onClick={() => setTab(candidate)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
              tab === candidate
                ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {s.tabs[candidate]}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'quotes' ? <AdminQuotesPanel /> : null}
        {tab === 'changelog' ? <AdminChangelogPanel /> : null}
        {tab === 'support' ? <AdminSupportPanel /> : null}
      </div>
    </div>
  )
}
