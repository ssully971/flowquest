import { describe, expect, it } from 'vitest'

import authGateSource from '../features/auth/AuthGate.tsx?raw'
import settingsPanelSource from '../features/settings/SettingsPanel.tsx?raw'
import mainSource from '../main.tsx?raw'

// Les feuilles CSS ne sont pas lisibles en ?raw sous Vitest (le CSS y est neutralisé) : seuls
// les fichiers TypeScript sont vérifiés ici ; le jeton --font-brand / .font-brand est
// contrôlé visuellement (docs/RENOMMAGE.md).
describe('police de marque (logotype « Fokitsu »)', () => {
  it('charge la police auto-hébergée (pas de CDN)', () => {
    expect(mainSource).toContain("import '@fontsource-variable/montserrat'")
    expect(mainSource).not.toMatch(/https?:\/\//)
  })

  it('le titre de l’écran de connexion utilise la police de marque', () => {
    expect(authGateSource).toMatch(/id="auth-gate-title"\s+className="font-brand/)
  })

  it('le logotype du panneau Réglages est assez grand pour la nouvelle graisse (h-6)', () => {
    expect(settingsPanelSource).toContain('<Logo tone="panel" className="h-6 w-auto" />')
  })
})
