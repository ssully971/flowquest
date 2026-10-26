/**
 * Coupe-circuits (lot I2, §1) : une clé par fonctionnalité qu'un administrateur peut
 * couper à distance. La valeur par défaut codée en dur ici est celle utilisée si les
 * drapeaux ne se chargent pas (panne du service, hors ligne) — l'application ne doit
 * jamais se couper elle-même faute de pouvoir joindre Supabase, voir useFeatureFlag.ts.
 * Tenue à jour manuellement en miroir des lignes insérées par
 * supabase/migrations/0039_feature_flags.sql.
 */
export const FLAG_KEYS = [
  'galaxy',
  'pillars',
  'deep_focus',
  'friends',
  'rooms',
  'leaderboard',
  'cheers',
  'avatar_upload',
  'signups',
  'maintenance',
] as const

export type FlagKey = (typeof FLAG_KEYS)[number]

export const FLAG_DEFAULTS: Record<FlagKey, boolean> = {
  galaxy: true,
  pillars: true,
  deep_focus: true,
  friends: true,
  rooms: true,
  leaderboard: true,
  cheers: true,
  avatar_upload: true,
  signups: true,
  maintenance: false,
}
