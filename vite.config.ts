import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Fuseau figé pour les tests (le calcul des jours/semaines se fait en heure locale) : sans
// cela, certains tests dépendent du fuseau de la machine qui les lance (CI en UTC,
// développeur en America/Guadeloupe...). Les tests sensibles au changement d'heure fixent
// eux-mêmes un fuseau avec DST le temps de leur exécution.
process.env.TZ = 'UTC'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-16.png', 'favicon-32.png'],
      manifest: {
        name: 'Fokitsu',
        short_name: 'Fokitsu',
        description: 'La quête du flow : minuteur de concentration gratuit.',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#0C0719',
        theme_color: '#0C0719',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // e2e/ est la suite Playwright à deux contextes des salons (LOT F3, `npm run
    // test:e2e`) : un fichier séparé, jamais ramassé par Vitest.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})
