let nextPatternId = 0

interface ContourPatternProps {
  opacity?: number
}

export function ContourPattern({ opacity = 1 }: ContourPatternProps) {
  const patternId = `flowquest-contour-${++nextPatternId}`

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      style={{ opacity }}
    >
      <defs>
        <pattern id={patternId} width="240" height="120" patternUnits="userSpaceOnUse">
          <path
            d="M-20 50 Q 40 10, 100 50 T 220 50 T 340 50"
            fill="none"
            stroke="var(--contour)"
            strokeWidth="1.5"
          />
          <path
            d="M-20 85 Q 40 45, 100 85 T 220 85 T 340 85"
            fill="none"
            stroke="var(--contour)"
            strokeWidth="1.5"
          />
          <path
            d="M-20 20 Q 40 -15, 100 20 T 220 20 T 340 20"
            fill="none"
            stroke="var(--contour)"
            strokeWidth="1.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}
