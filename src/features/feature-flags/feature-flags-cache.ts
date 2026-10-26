import { isSupabaseConfigured, supabase } from '@/shared/supabase/client'

import { FLAG_DEFAULTS } from './flag-defaults'
import type { FlagKey } from './flag-defaults'

// Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
const STORAGE_KEY = 'flowquest.featureFlags'

/**
 * Cache mémoire (lot I2, §1) : partagé par toutes les instances de useFeatureFlag() de la
 * page, rempli par un seul appel réseau (ensureFlagsFetched, dédupliqué comme
 * ensureDefaultPillar dans usePillars.ts) même si l'app monte des dizaines de
 * FeatureGate. `null` tant que rien n'a encore été lu (ni mémoire, ni stockage local).
 */
let memoryCache: Partial<Record<FlagKey, boolean>> | null = null
let fetchPromise: Promise<void> | null = null

function readLocalStorageCache(): Partial<Record<FlagKey, boolean>> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as Partial<Record<FlagKey, boolean>>
  } catch {
    return {}
  }
}

function writeLocalStorageCache(flags: Partial<Record<FlagKey, boolean>>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(flags))
  } catch {
    // Stockage indisponible (navigation privée, quota) : le cache mémoire de cette
    // session suffit, jamais bloquant.
  }
}

/** Lit un drapeau : mémoire d'abord, puis stockage local (persiste entre sessions, utile
 * tant que le premier appel réseau de cette session n'a pas encore répondu), puis la
 * valeur par défaut codée en dur — jamais `undefined`, jamais d'attente. */
export function getCachedFlag(key: FlagKey): boolean {
  if (memoryCache && key in memoryCache) return memoryCache[key] as boolean
  const stored = readLocalStorageCache()
  if (key in stored) return stored[key] as boolean
  return FLAG_DEFAULTS[key]
}

export function setCachedFlag(key: FlagKey, enabled: boolean): void {
  memoryCache = { ...(memoryCache ?? readLocalStorageCache()), [key]: enabled }
  writeLocalStorageCache(memoryCache)
}

/** Un seul appel réseau par session, dédupliqué entre instances concurrentes de
 * useFeatureFlag() (même principe que ensureDefaultPillar dans usePillars.ts) — se
 * réinitialise après l'appel pour qu'un rechargement manuel (tests, cas limites) reste
 * possible. Échec ou absence de Supabase : résout sans rien changer, le cache garde ses
 * valeurs par défaut — la panne du service de drapeaux ne doit jamais couper l'app. */
export function ensureFlagsFetched(): Promise<void> {
  if (fetchPromise) return fetchPromise
  fetchPromise = (async () => {
    if (!isSupabaseConfigured || !supabase) return
    try {
      const { data, error } = await supabase.from('feature_flags').select('key, enabled')
      if (error || !data) return
      const next: Partial<Record<FlagKey, boolean>> = {
        ...(memoryCache ?? readLocalStorageCache()),
      }
      for (const row of data) next[row.key as FlagKey] = row.enabled
      memoryCache = next
      writeLocalStorageCache(next)
    } catch {
      // Hors ligne ou service indisponible : on garde les valeurs par défaut.
    } finally {
      fetchPromise = null
    }
  })()
  return fetchPromise
}
