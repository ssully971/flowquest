interface CycleDotsProps {
  total: number
  completed: number
  currentIsFocus: boolean
}

export function CycleDots({ total, completed, currentIsFocus }: CycleDotsProps) {
  return (
    <div className="flex items-center" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => {
        const isDone = index < completed
        const isCurrent = index === completed && currentIsFocus
        return (
          <div key={index} className="flex items-center">
            {index > 0 ? <span className="h-px w-5 bg-[var(--line)]" /> : null}
            <span
              className={`h-2.5 w-2.5 rounded-full border ${
                isDone
                  ? 'border-[var(--accent)] bg-[var(--accent)]'
                  : isCurrent
                    ? 'border-[var(--accent)] bg-transparent'
                    : 'border-[var(--line)] bg-transparent'
              }`}
            />
          </div>
        )
      })}
    </div>
  )
}
