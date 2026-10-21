import type { ClockStyleCss } from '@/features/home/clock-settings'

import type { TimerDisplayStyle } from '../timer-display-style'
import { DefaultDisplay } from './displays/DefaultDisplay'
import { DotMatrixDisplay } from './displays/DotMatrixDisplay'
import { FlipDisplay } from './displays/FlipDisplay'
import { GaugeDisplay } from './displays/GaugeDisplay'
import { PieChartDisplay } from './displays/PieChartDisplay'
import { ProgressBarDisplay } from './displays/ProgressBarDisplay'

interface TimerFaceProps {
  style: TimerDisplayStyle
  /** Toujours le temps lisible en texte (ex. « 24:59 ») — quel que soit le style visuel. */
  label: string
  /** 0 à 1 (temps écoulé / durée totale), ou `null` pour un temps non borné (chronomètre). */
  progress: number | null
  /** `true` pour les vignettes d'aperçu de Réglages > Minuteur : version réduite. */
  compact?: boolean
  /** Multiplicateur de taille (Réglages > Horloge, CLOCK_SIZE_SCALE) : ignoré en mode
   * compact, qui a ses propres dimensions fixes de vignette. */
  sizeScale?: number
  /** Couleur personnalisée (Réglages > Horloge, LOT B10) : ignorée en mode compact, comme
   * sizeScale, pour que les vignettes d'aperçu restent comparables entre elles. */
  color?: string
  /** Police choisie (Réglages > Horloge, CLOCK_STYLE_CSS — LOT E2, source unique utilisée
   * partout où l'horloge s'affiche) : ignorée en mode compact, les vignettes d'aperçu de
   * Réglages > Minuteur comparant des styles d'affichage, pas des polices. */
  styleCss?: ClockStyleCss
}

/** Dispatcheur purement visuel : le moteur du minuteur ne change jamais, seul l'affichage
 * change selon le style choisi (lot 4). Le texte du temps reste toujours un vrai nœud
 * texte, dans les six styles, jamais remplacé par une image ou un canvas. */
export function TimerFace({
  style,
  label,
  progress,
  compact = false,
  sizeScale = 1,
  color,
  styleCss,
}: TimerFaceProps) {
  const boundedProgress = progress ?? 0
  const effectiveColor = compact ? undefined : color
  const effectiveStyleCss = compact ? undefined : styleCss

  switch (style) {
    case 'flip':
      return (
        <FlipDisplay
          label={label}
          compact={compact}
          sizeScale={sizeScale}
          color={effectiveColor}
          styleCss={effectiveStyleCss}
        />
      )
    case 'progress-bar':
      return (
        <ProgressBarDisplay
          label={label}
          progress={boundedProgress}
          compact={compact}
          sizeScale={sizeScale}
          color={effectiveColor}
          styleCss={effectiveStyleCss}
        />
      )
    case 'gauge':
      return (
        <GaugeDisplay
          label={label}
          progress={boundedProgress}
          compact={compact}
          sizeScale={sizeScale}
          color={effectiveColor}
          styleCss={effectiveStyleCss}
        />
      )
    case 'dot-matrix':
      return (
        <DotMatrixDisplay
          label={label}
          progress={boundedProgress}
          compact={compact}
          sizeScale={sizeScale}
          color={effectiveColor}
          styleCss={effectiveStyleCss}
        />
      )
    case 'pie-chart':
      return (
        <PieChartDisplay
          label={label}
          progress={boundedProgress}
          compact={compact}
          sizeScale={sizeScale}
          color={effectiveColor}
          styleCss={effectiveStyleCss}
        />
      )
    default:
      return (
        <DefaultDisplay
          label={label}
          compact={compact}
          sizeScale={sizeScale}
          color={effectiveColor}
          styleCss={effectiveStyleCss}
        />
      )
  }
}
