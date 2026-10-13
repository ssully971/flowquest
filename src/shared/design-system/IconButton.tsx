import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon
  label: string
}

export function IconButton({ icon: Icon, label, className = '', ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] transition-colors duration-200 hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
    </button>
  )
}
