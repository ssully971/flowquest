import { defineConfig } from '@playwright/test'

/**
 * Configuration Playwright dédiée au test à deux contextes de navigateur des salons de
 * focus (LOT F3, règles transversales du Mode Amis — « pour les salons, un test
 * Playwright à deux contextes de navigateur »). Aucun projet Supabase réel n'est
 * accessible depuis cet environnement : le serveur de dev tourne avec des identifiants
 * Supabase factices (voir `webServer.env`) et chaque test intercepte lui-même les
 * requêtes réseau (voir `e2e/fixtures/fake-supabase.ts`), donc ces identifiants ne
 * servent qu'à activer le code côté client qui dépend de `isSupabaseConfigured`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5190',
    launchOptions: {
      // Version de Playwright pinnée (voir package.json) : le Chromium pré-installé de cet
      // environnement ne correspond pas forcément à celui que `npx playwright install`
      // téléchargerait, donc on pointe explicitement dessus plutôt que d'en télécharger un.
      executablePath: '/opt/pw-browsers/chromium',
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5190 --strictPort',
    url: 'http://localhost:5190',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      VITE_SUPABASE_URL: 'https://fake-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'fake-anon-key',
    },
  },
})
