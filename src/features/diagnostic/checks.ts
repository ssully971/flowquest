import { supabase } from '@/shared/supabase/client'
import type { Database } from '@/shared/supabase/database.types'

export interface EnvVarCheck {
  name: string
  present: boolean
}

/** Présence seulement — jamais la valeur, même pour un admin : cette page est publique. */
export function checkEnvVars(): EnvVarCheck[] {
  return [
    { name: 'VITE_SUPABASE_URL', present: Boolean(import.meta.env.VITE_SUPABASE_URL) },
    { name: 'VITE_SUPABASE_ANON_KEY', present: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY) },
    { name: 'VITE_GOOGLE_CLIENT_ID', present: Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID) },
  ]
}

export interface UrlFormatCheck {
  ok: boolean
  issues: string[]
}

/** null si VITE_SUPABASE_URL est absente (rien à vérifier). */
export function checkSupabaseUrlFormat(): UrlFormatCheck | null {
  const url: string | undefined = import.meta.env.VITE_SUPABASE_URL
  if (!url) return null
  const issues: string[] = []
  if (!url.startsWith('https://')) issues.push('ne commence pas par https://')
  if (url.endsWith('/')) issues.push('se termine par un / superflu')
  if (url.includes('/rest/v1')) issues.push('contient /rest/v1 (doit être la racine du projet)')
  return { ok: issues.length === 0, issues }
}

export const EXPECTED_FUNCTIONS = [
  'ensure_profile',
  'is_admin',
  'is_username_available',
  'delete_own_account',
] as const

export interface SchemaIntrospection {
  reachable: boolean
  status?: number
  error?: string
  paths: string[] | null
}

/**
 * Une requête GET sur la racine `/rest/v1/` d'un projet Supabase renvoie la spécification
 * OpenAPI générée par PostgREST, qui liste toutes les tables et fonctions exposées — un
 * moyen fiable et sans effet de bord de vérifier la joignabilité et l'existence des
 * fonctions SQL attendues, y compris `delete_own_account` qu'on ne veut surtout jamais
 * invoquer juste pour la tester.
 */
export async function fetchSchemaIntrospection(): Promise<SchemaIntrospection> {
  const url: string | undefined = import.meta.env.VITE_SUPABASE_URL
  const anonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return { reachable: false, paths: null }
  try {
    const response = await fetch(`${url}/rest/v1/`, { headers: { apikey: anonKey } })
    if (!response.ok) return { reachable: false, status: response.status, paths: null }
    const body: unknown = await response.json().catch(() => null)
    const paths =
      body && typeof body === 'object' && 'paths' in body && body.paths && typeof body.paths === 'object'
        ? Object.keys(body.paths as Record<string, unknown>)
        : null
    return { reachable: true, status: response.status, paths }
  } catch (error) {
    return { reachable: false, error: error instanceof Error ? error.message : String(error), paths: null }
  }
}

export interface FunctionCheck {
  name: (typeof EXPECTED_FUNCTIONS)[number]
  found: boolean
}

export function checkExpectedFunctions(paths: string[] | null): FunctionCheck[] {
  return EXPECTED_FUNCTIONS.map((name) => ({ name, found: paths?.includes(`/rpc/${name}`) ?? false }))
}

export const DIAGNOSTIC_TABLES = [
  'profiles',
  'user_settings',
  'tasks',
  'focus_sessions',
  'timer_state',
  'notes',
  'support_messages',
  'quotes',
  'changelog',
  'admin_log',
] as const satisfies readonly (keyof Database['public']['Tables'])[]

export interface TableReadCheck {
  table: (typeof DIAGNOSTIC_TABLES)[number]
  ok: boolean
  errorCode: string | null
  errorMessage: string | null
}

/**
 * Lecture réelle (HEAD + comptage, pas de données transférées) via le client applicatif,
 * donc soumise aux mêmes GRANT et politiques RLS que le reste de l'app — exactement le
 * chemin qui a échoué en production (42501). Un compte 0 n'est jamais une erreur : RLS
 * filtre normalement les lignes qu'on n'a pas le droit de voir, sans ça être un échec.
 */
export async function checkTableReads(): Promise<TableReadCheck[]> {
  if (!supabase) {
    return DIAGNOSTIC_TABLES.map((table) => ({
      table,
      ok: false,
      errorCode: null,
      errorMessage: 'Supabase non configuré',
    }))
  }
  const client = supabase
  return Promise.all(
    DIAGNOSTIC_TABLES.map(async (table) => {
      const { error } = await client.from(table).select('*', { head: true, count: 'exact' })
      return {
        table,
        ok: !error,
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
      }
    }),
  )
}
