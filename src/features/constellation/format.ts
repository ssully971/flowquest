/** « 8 h 45 », « 9 h », « 40 min » : durée courte pour les puces, indicateurs et l'inspecteur. */
export function formatShort(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`
}
