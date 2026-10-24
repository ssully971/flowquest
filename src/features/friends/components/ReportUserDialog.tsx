import type { FormEvent } from 'react'
import { useState } from 'react'

import { GlassCard } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

interface ReportUserDialogProps {
  onCancel: () => void
  onSubmit: (reason: string) => Promise<boolean>
}

export function ReportUserDialog({ onCancel, onSubmit }: ReportUserDialogProps) {
  const s = strings.friends.report
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (reason.trim().length === 0) return
    setIsSubmitting(true)
    const ok = await onSubmit(reason.trim())
    setIsSubmitting(false)
    if (ok) onCancel()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'var(--scrim)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
        onClick={onCancel}
      />
      <GlassCard
        role="dialog"
        aria-label={s.title}
        className="relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-[28px] p-6"
      >
        <h2 className="text-sm font-semibold text-[var(--text)]">{s.title}</h2>
        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-3">
          <label htmlFor="report-reason" className="sr-only">
            {s.reasonLabel}
          </label>
          <textarea
            id="report-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={s.reasonLabel}
            rows={4}
            maxLength={2000}
            className="w-full resize-none rounded-xl border border-[var(--line)] bg-transparent p-3 text-sm text-[var(--text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="h-10 rounded-xl border border-[var(--line)] px-4 text-sm font-medium text-[var(--text)] transition-opacity duration-200 disabled:opacity-40"
            >
              {s.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || reason.trim().length === 0}
              className="h-10 rounded-xl bg-[#E5484D] px-4 text-sm font-medium text-white transition-opacity duration-200 disabled:opacity-40"
            >
              {s.submit}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  )
}
