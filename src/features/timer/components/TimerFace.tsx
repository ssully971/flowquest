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
}

/** Dispatcheur purement visuel : le moteur du minuteur ne change jamais, seul l'affichage
 * change selon le style choisi (lot 4). Le texte du temps reste toujours un vrai nœud
 * texte, dans les six styles, jamais remplacé par une image ou un canvas. */
export function TimerFace({ style, label, progress, compact = false }: TimerFaceProps) {
  const boundedProgress = progress ?? 0

  switch (style) {
    case 'flip':
      return <FlipDisplay label={label} compact={compact} />
    case 'progress-bar':
      return <ProgressBarDisplay label={label} progress={boundedProgress} compact={compact} />
    case 'gauge':
      return <GaugeDisplay label={label} progress={boundedProgress} compact={compact} />
    case 'dot-matrix':
      return <DotMatrixDisplay label={label} progress={boundedProgress} compact={compact} />
    case 'pie-chart':
      return <PieChartDisplay label={label} progress={boundedProgress} compact={compact} />
    default:
      return <DefaultDisplay label={label} compact={compact} />
  }
}
