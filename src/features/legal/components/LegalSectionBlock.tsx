import type { ReactNode } from 'react'

interface LegalSectionBlockProps {
  id: string
  title: string
  children: ReactNode
}

export function LegalSectionBlock({ id, title, children }: LegalSectionBlockProps) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2
        className="mb-3 text-lg font-bold text-[var(--text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-[var(--text)]">{children}</div>
    </section>
  )
}
