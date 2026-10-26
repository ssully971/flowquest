import type { ReactNode } from 'react'

import { Logo } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

export interface LegalSection {
  id: string
  title: string
}

interface LegalLayoutProps {
  title: string
  lastUpdated: string
  sections: LegalSection[]
  children: ReactNode
}

/**
 * Habillage commun des 3 pages légales (lot I1, §3) : page autonome, accessible sans
 * connexion (voir App.tsx), jamais à l'intérieur du panneau de Réglages. Sommaire généré
 * à partir de `sections` (ancres `#id`), même ordre que les `<section id>` du contenu.
 */
export function LegalLayout({ title, lastUpdated, sections, children }: LegalLayoutProps) {
  const s = strings.legal

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10 sm:py-14">
        <div className="flex flex-col gap-4">
          <a href="/" className="inline-flex w-fit items-center gap-2">
            <Logo className="h-7 w-auto" />
          </a>
          <div>
            <h1
              className="text-3xl font-extrabold sm:text-4xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {title}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {s.lastUpdated} {lastUpdated}
            </p>
          </div>
        </div>

        <nav aria-label={s.tocLabel} className="rounded-2xl border border-[var(--line)] p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {s.tocLabel}
          </p>
          <ol className="flex flex-col gap-1.5 text-sm">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  {index + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex flex-col gap-10 text-sm leading-relaxed text-[var(--text)]">
          {children}
        </div>

        <a
          href="/"
          className="font-brand w-fit text-sm text-[var(--accent)] underline-offset-2 hover:underline"
        >
          {s.backHome}
        </a>
      </div>
    </div>
  )
}
