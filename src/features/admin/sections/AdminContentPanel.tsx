import { useState } from 'react'

import { strings } from '@/shared/i18n'

import { AdminChangelogPanel } from '../AdminChangelogPanel'
import { AdminQuotesPanel } from '../AdminQuotesPanel'

type ContentTab = 'quotes' | 'changelog'

/** Regroupe les deux panneaux de contenu existants (citations, nouveautés) sous une
 * même section (lot I2 : « Contenu (citations, changelog) ») — panneaux conservés tels
 * quels, seulement habillés par l'onglet commun ci-dessous. */
export function AdminContentPanel() {
  const s = strings.admin.tabs
  const [tab, setTab] = useState<ContentTab>('quotes')

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" className="flex gap-2 border-b border-[var(--line)] pb-2">
        {(['quotes', 'changelog'] as const).map((candidate) => (
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
            {s[candidate]}
          </button>
        ))}
      </div>

      {tab === 'quotes' ? <AdminQuotesPanel /> : <AdminChangelogPanel />}
    </div>
  )
}
