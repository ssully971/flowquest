import { useId } from 'react'

interface FormFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'password'
  autoComplete?: string
  hint?: string
}

export function FormField({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  hint,
}: FormFieldProps) {
  const id = useId()

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[var(--panel-text)]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required
        className="h-11 rounded-xl border border-[var(--panel-line)] bg-transparent px-3.5 text-sm text-[var(--panel-text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
      />
      {hint ? <p className="text-xs text-[var(--panel-muted)]">{hint}</p> : null}
    </div>
  )
}
