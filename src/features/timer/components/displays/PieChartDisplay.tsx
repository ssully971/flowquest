import { BigDigits } from '@/shared/design-system'

interface PieChartDisplayProps {
  label: string
  progress: number
  compact?: boolean
  sizeScale?: number
  color?: string
}

export function PieChartDisplay({
  label,
  progress,
  compact = false,
  sizeScale = 1,
  color,
}: PieChartDisplayProps) {
  const scale = compact ? 1 : sizeScale
  const size = (compact ? 56 : 140) * scale
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100)

  return (
    <div className={`flex flex-col items-center ${compact ? 'gap-1.5' : 'gap-4'}`}>
      {/* Camembert plein (pas un anneau, pour rester visuellement distinct de la Jauge) :
          les chiffres vivent en dessous plutôt que par-dessus, pour ne jamais dépendre du
          contraste entre le texte et une tranche colorée. */}
      <div
        className="rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(var(--accent) ${percent}%, var(--line) ${percent}%)`,
        }}
      />
      <BigDigits label={label} sizePx={compact ? 20 : 72} sizeScale={scale} color={color} />
    </div>
  )
}
