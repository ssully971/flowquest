import { Download, X } from 'lucide-react'

import { strings } from '@/shared/i18n'

import { useInstallPrompt } from './useInstallPrompt'

export function InstallPrompt() {
  const { visible, isIOS, canInstallDirectly, install, dismiss } = useInstallPrompt()
  const s = strings.pwa

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex justify-center px-4 sm:bottom-28">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--text)] shadow-[0_10px_24px_var(--glow)]"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="flex-1">{s.installMessage}</p>
          <button
            type="button"
            onClick={dismiss}
            aria-label={s.dismiss}
            className="shrink-0 text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
          >
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {isIOS ? <p className="text-xs text-[var(--muted)]">{s.iosInstructions}</p> : null}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="h-9 rounded-xl px-3 text-sm font-medium text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
          >
            {s.later}
          </button>
          {canInstallDirectly ? (
            <button
              type="button"
              onClick={install}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--on-accent)]"
            >
              <Download size={16} strokeWidth={1.75} aria-hidden="true" />
              {s.installAction}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
