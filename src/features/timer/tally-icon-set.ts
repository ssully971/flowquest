export const TALLY_ICON_SETS = [
  'dots',
  'stars',
  'flames',
  'leaves',
  'coffee',
  'stethoscope',
  'hearts',
  'pills',
] as const

export type TallyIconSet = (typeof TALLY_ICON_SETS)[number]
