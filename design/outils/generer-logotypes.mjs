// Génère les logotypes texte de la marque (PNG transparents haute résolution) avec
// Chromium + la police de marque auto-hébergée (Montserrat variable, paquet
// @fontsource-variable/montserrat déjà dans package.json). Étape suivante : le script
// design/outils/finaliser-logotypes.py recadre, redimensionne et exporte en WebP.
//
//   node design/outils/generer-logotypes.mjs [dossier-de-sortie]
//
// Aucune dépendance supplémentaire : Playwright est déjà une devDependency. Voir
// docs/RENOMMAGE.md pour la démarche complète.
import { readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

// ↓ Une seule ligne à changer pour passer à « fokitsu » (minuscules).
const BRAND_TEXT = 'Fokitsu'

const WEIGHT = 750 // graisse retenue (voir comparaison-police.png)
const LETTER_SPACING_EM = -0.02 // légèrement resserré, comme l'ancien logotype
const FONT_SIZE_PX = 600 // hauteur de lettres ≥ 400 px
const COLORS = {
  white: '#FFFFFF',
  black: '#000000',
  color: '#393B58', // bleu nuit exact des logotypes d'origine
}

const outDir = process.argv[2] ?? 'design/outils/sortie'
mkdirSync(outDir, { recursive: true })
const fontFile = readFileSync(
  'node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2',
).toString('base64')

const browser = await chromium.launch({ executablePath: process.env.CHROME })
const page = await browser.newPage({ viewport: { width: 2600, height: 1000 } })
for (const [name, color] of Object.entries(COLORS)) {
  await page.setContent(`<style>
    @font-face { font-family: 'Marque'; font-weight: 100 900;
      src: url(data:font/woff2;base64,${fontFile}) format('woff2'); }
    body { margin: 0; background: transparent; }
    #t { position: absolute; left: 150px; top: 150px; white-space: nowrap; line-height: 1;
      font-family: 'Marque'; font-weight: ${WEIGHT}; font-size: ${FONT_SIZE_PX}px;
      letter-spacing: ${LETTER_SPACING_EM}em; font-kerning: normal; color: ${color}; }
  </style><div id="t">${BRAND_TEXT}</div>`)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: join(outDir, `logotype-${name}.png`), omitBackground: true })
}
await browser.close()
console.log(`Logotypes « ${BRAND_TEXT} » écrits dans ${outDir}`)
