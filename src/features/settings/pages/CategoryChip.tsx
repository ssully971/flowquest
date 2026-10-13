interface CategoryChipProps {
  label: string
  active: boolean
  onClick: () => void
}

export function CategoryChip({ label, active, onClick }: CategoryChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors duration-200 ${
        active
          ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]'
          : 'border-[var(--panel-line)] text-[var(--panel-muted)] hover:text-[var(--panel-text)]'
      }`}
    >
      {label}
    </button>
  )
}
