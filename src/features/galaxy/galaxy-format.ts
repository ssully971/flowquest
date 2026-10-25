import { formatFocusDuration } from '@/features/stats/format'

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const TIME_FORMATTER = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** Date lisible pour l'info-bulle d'une étoile (LOT G4), ex. « 15 janv. à 10:32 ». */
export function formatGalaxyDate(timestamp: number): string {
  return `${DATE_FORMATTER.format(timestamp)} à ${TIME_FORMATTER.format(timestamp)}`
}

export function formatGalaxyDuration(totalSeconds: number): string {
  return formatFocusDuration(totalSeconds)
}
