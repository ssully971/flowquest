const DAY_MS = 24 * 60 * 60 * 1000

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1)
  return Math.round((date.getTime() - start.getTime()) / DAY_MS) + 1
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export interface YearRange {
  /** Ancrage passé à useDailyFocusHistory : aujourd'hui pour l'année en cours (le
   * calendrier s'arrête au jour présent, jamais de jours futurs), le 31 décembre pour
   * une année passée (calendrier complet). */
  anchor: number
  /** Nombre de jours à afficher, en remontant depuis `anchor`. */
  days: number
}

/** §9 : calendrier de régularité façon GitHub, navigable par année civile complète. */
export function getYearRange(year: number, now: Date = new Date()): YearRange {
  const currentYear = now.getFullYear()
  if (year >= currentYear) {
    return { anchor: now.getTime(), days: dayOfYear(now) }
  }
  const anchor = new Date(year, 11, 31, 12).getTime()
  return { anchor, days: isLeapYear(year) ? 366 : 365 }
}
