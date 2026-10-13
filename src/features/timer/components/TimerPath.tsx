const PATH_D = 'M8 36 Q 90 10, 180 36 T 352 36'

interface TimerPathProps {
  progress: number
}

export function TimerPath({ progress }: TimerPathProps) {
  const percent = Math.min(100, Math.max(0, progress * 100))

  return (
    <div
      className="mx-auto w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4"
      aria-hidden="true"
    >
      <div className="relative h-[48px] w-full">
        <svg viewBox="0 0 360 48" className="h-full w-full" preserveAspectRatio="none">
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
          className="absolute left-0 top-0 h-3 w-3 rounded-full bg-[var(--accent)]"
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
