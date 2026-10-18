export const TIMER_DISPLAY_STYLES = [
  'default',
  'flip',
  'progress-bar',
  'gauge',
  'dot-matrix',
  'pie-chart',
] as const

export type TimerDisplayStyle = (typeof TIMER_DISPLAY_STYLES)[number]
