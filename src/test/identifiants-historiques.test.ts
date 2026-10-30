import { describe, expect, it } from 'vitest'

import { createBackup } from '@/features/backup/local-backup'

/**
 * Garde contre un renommage accidentel (phase 1 « Fokitsu », docs/RENOMMAGE.md) : ces
 * identifiants persistent chez les utilisateurs (IndexedDB, localStorage, sauvegardes
 * exportées). Les renommer sans migration ferait « perdre » leurs données. Si ce test
 * échoue, c'est qu'un de ces identifiants a changé : annule, ou écris d'abord la migration.
 */
const sources = import.meta.glob<string>(
  ['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/test/**'],
  { query: '?raw', import: 'default', eager: true },
)

const read = (path: string): string => sources[`/src/${path}`] ?? ''

describe('identifiants techniques historiques (ne pas renommer sans migration)', () => {
  it('la base IndexedDB garde le nom « flowquest », identique dans db.ts et clear-local-storage.ts', () => {
    const dbName = /const DB_NAME = '([^']+)'/.exec(read('shared/storage/db.ts'))?.[1]
    const clearedName = /const INDEXED_DB_NAME = '([^']+)'/.exec(
      read('features/diagnostic/clear-local-storage.ts'),
    )?.[1]
    expect(dbName).toBe('flowquest')
    expect(clearedName).toBe('flowquest')
  })

  it('l’export garde le marqueur « flowquest »', async () => {
    expect((await createBackup()).app).toBe('flowquest')
  })

  it('les clés de stockage gardent exactement le préfixe « flowquest. » (et aucune clé « fokitsu. »)', () => {
    const keys = new Set<string>()
    for (const [file, text] of Object.entries(sources)) {
      for (const match of text.matchAll(/['"`](flowquest\.[A-Za-z.]*)/g)) keys.add(match[1])
      expect(text, file).not.toMatch(/['"`]fokitsu\.[A-Za-z]/)
    }
    expect([...keys].sort()).toEqual(
      [
        'flowquest.activePillarId',
        'flowquest.activeTaskId',
        'flowquest.appearance',
        'flowquest.authGateDismissed',
        'flowquest.backgroundDisplaySettings',
        'flowquest.backgrounds',
        'flowquest.campaignBannerDismissed',
        'flowquest.clockSettings',
        'flowquest.dailyGoalMinutes',
        'flowquest.extrasSettings',
        'flowquest.featureFlags',
        'flowquest.importOffered.',
        'flowquest.installPromptSeen',
        'flowquest.lastSeenChangelogVersion',
        'flowquest.maintenanceBannerDismissed',
        'flowquest.mode',
        'flowquest.profileCache.',
        'flowquest.quotesSettings',
        'flowquest.settingsLastPage',
        'flowquest.timerSettings',
      ].sort(),
    )
  })
})
