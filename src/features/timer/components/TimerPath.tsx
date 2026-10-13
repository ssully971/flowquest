const PATH_D = 'M2 10 L358 10'

interface TimerPathProps {
  progress: number
}

export function TimerPath({ progress }: TimerPathProps) {
  const percent = Math.min(100, Math.max(0, progress * 100))

  return (
    <div className="mx-auto w-full max-w-md" aria-hidden="true">
      <div className="relative h-5 w-full">
        <svg viewBox="0 0 360 20" className="h-full w-full" preserveAspectRatio="none">
          <path
            d={PATH_D}
            pathLength={100}
            fill="none"
            stroke="var(--line)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d={PATH_D}
            pathLength={100}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="100"
            strokeDashoffset={100 - percent}
            style={{ transition: 'stroke-dashoffset 200ms linear' }}
          />
        </svg>
        <div
          className="absolute left-0 top-0 h-2 w-2 rounded-full bg-[var(--accent)]"
          style={{
            offsetPath: `path("${PATH_D}")`,
            offsetDistance: `${percent}%`,
            transform: 'translate(-50%, -50%)',
            transition: 'offset-distance 200ms linear',
          }}
        />
      </div>
    </div>
  )
}
