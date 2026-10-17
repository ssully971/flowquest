import { Eye, EyeOff } from 'lucide-react'
import { useId, useState } from 'react'

import { strings } from '@/shared/i18n'

interface FormFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'password'
  autoComplete?: string
  hint?: string
  error?: string | null
}

export function FormField({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  hint,
  error,
}: FormFieldProps) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[var(--panel-text)]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && revealed ? 'text' : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
          aria-invalid={error ? true : undefined}
          className={`h-11 w-full rounded-xl border bg-transparent px-3.5 text-sm text-[var(--panel-text)] outline-none transition-colors duration-200 focus:border-[var(--accent)] ${
            isPassword ? 'pr-11' : ''
          } ${error ? 'border-[#E5484D]' : 'border-[var(--panel-line)]'}`}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((prev) => !prev)}
            aria-label={revealed ? strings.auth.fields.hidePassword : strings.auth.fields.showPassword}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--panel-muted)] transition-colors duration-200 hover:text-[var(--panel-text)]"
          >
            {revealed ? (
              <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Eye size={18} strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[#E5484D]">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-[var(--panel-muted)]">{hint}</p>
      ) : null}
    </div>
  )
}
