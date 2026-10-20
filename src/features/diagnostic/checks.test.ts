import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fromMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}))

describe('checks — page /diagnostic (LOT A)', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('checkEnvVars signale uniquement la présence, jamais la valeur', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://exemple.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const { checkEnvVars } = await import('./checks')

    const result = checkEnvVars()

    expect(result).toEqual([
      { name: 'VITE_SUPABASE_URL', present: true },
      { name: 'VITE_SUPABASE_ANON_KEY', present: false },
      { name: 'VITE_GOOGLE_CLIENT_ID', present: false },
    ])
    expect(JSON.stringify(result)).not.toContain('exemple.supabase.co')
  })

  it('checkSupabaseUrlFormat détecte un / final et /rest/v1', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://exemple.supabase.co/rest/v1/')
    const { checkSupabaseUrlFormat } = await import('./checks')

    const result = checkSupabaseUrlFormat()

    expect(result?.ok).toBe(false)
    expect(result?.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/'),
        expect.stringContaining('/rest/v1'),
      ]),
    )
  })

  it('checkSupabaseUrlFormat renvoie null sans variable', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    const { checkSupabaseUrlFormat } = await import('./checks')

    expect(checkSupabaseUrlFormat()).toBeNull()
  })

  it('checkSupabaseUrlFormat accepte une URL bien formée', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://exemple.supabase.co')
    const { checkSupabaseUrlFormat } = await import('./checks')

    expect(checkSupabaseUrlFormat()).toEqual({ ok: true, issues: [] })
  })

  it('fetchSchemaIntrospection liste les chemins depuis la spec OpenAPI', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://exemple.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'clé-anon')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ paths: { '/rpc/is_admin': {}, '/profiles': {} } }),
      }),
    )
    const { fetchSchemaIntrospection } = await import('./checks')

    const result = await fetchSchemaIntrospection()

    expect(result.reachable).toBe(true)
    expect(result.paths).toEqual(expect.arrayContaining(['/rpc/is_admin', '/profiles']))
  })

  it('fetchSchemaIntrospection signale une erreur réseau', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://exemple.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'clé-anon')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const { fetchSchemaIntrospection } = await import('./checks')

    const result = await fetchSchemaIntrospection()

    expect(result.reachable).toBe(false)
    expect(result.error).toBe('network down')
  })

  it('checkExpectedFunctions détecte une fonction manquante', async () => {
    const { checkExpectedFunctions } = await import('./checks')

    const result = checkExpectedFunctions(['/rpc/is_admin', '/profiles'])

    expect(result.find((f) => f.name === 'is_admin')?.found).toBe(true)
    expect(result.find((f) => f.name === 'delete_own_account')?.found).toBe(false)
  })

  it('checkExpectedFunctions renvoie tout à false si paths est null', async () => {
    const { checkExpectedFunctions } = await import('./checks')

    expect(checkExpectedFunctions(null).every((f) => !f.found)).toBe(true)
  })

  it('checkTableReads lit chaque table et remonte le code d’erreur exact', async () => {
    fromMock.mockImplementation((table: string) => ({
      select: vi.fn().mockResolvedValue(
        table === 'admin_log'
          ? { error: { code: '42501', message: 'permission denied for table admin_log' } }
          : { error: null },
      ),
    }))
    const { checkTableReads, DIAGNOSTIC_TABLES } = await import('./checks')

    const result = await checkTableReads()

    expect(result).toHaveLength(DIAGNOSTIC_TABLES.length)
    expect(result.find((r) => r.table === 'profiles')?.ok).toBe(true)
    const adminLog = result.find((r) => r.table === 'admin_log')
    expect(adminLog?.ok).toBe(false)
    expect(adminLog?.errorCode).toBe('42501')
  })
})
