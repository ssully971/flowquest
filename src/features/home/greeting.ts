import { strings } from '@/shared/i18n'

export interface Greeting {
  primary: string
  secondary: string
}

const { secondary } = strings.home.greeting

export function getGreeting(now: Date, name?: string): Greeting {
  const hour = now.getHours()
  const day = now.getDay()
  const suffix = name ? `, ${name}` : ''

  if (day === 1 && hour >= 5 && hour < 12) {
    return { primary: `${strings.home.greeting.weekStart}${suffix}`, secondary }
  }
  if (day === 5 && hour >= 16) {
    return { primary: `${strings.home.greeting.weekendApproaching}${suffix}`, secondary }
  }
  if (hour >= 5 && hour < 12) {
    return { primary: `${strings.home.greeting.morning}${suffix}`, secondary }
  }
  if (hour >= 12 && hour < 18) {
    return { primary: `${strings.home.greeting.afternoon}${suffix}`, secondary }
  }
  if (hour >= 18 && hour < 22) {
    return { primary: `${strings.home.greeting.evening}${suffix}`, secondary }
  }
  return { primary: `${strings.home.greeting.night}${suffix} ?`, secondary }
}
