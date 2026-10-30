import { expect, test } from '@playwright/test'

/**
 * LOT 3 — la fenêtre de connexion / inscription sur petit écran. Avant : conteneur centré sans
 * défilement ni hauteur maximale, la carte dépassait de l'écran et était coupée EN HAUT, là où se
 * trouve le champ pseudo (premier champ du formulaire d'inscription).
 */
const VIEWPORTS = [
  { name: '360×640', width: 360, height: 640 },
  { name: '320×568 (iPhone SE)', width: 320, height: 568 },
  { name: '360×360 (clavier ouvert)', width: 360, height: 360 },
]

for (const viewport of VIEWPORTS) {
  test(`inscription : le champ pseudo est visible et atteignable à ${viewport.name}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    })
    const page = await context.newPage()
    // Aucun vrai serveur : invité (aucune session stockée), tables vides, Realtime coupé.
    await page.route('**/fake-project.supabase.co/rest/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )
    await page.route('**/realtime/v1/**', (route) => route.abort())

    await page.goto('/')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await page.getByRole('button', { name: 'Créer un compte' }).click()

    const username = page.getByLabel('Pseudo')
    await expect(username).toBeVisible()
    // Le haut de la carte n'est pas coupé : le champ pseudo (premier champ) est dans l'écran.
    await username.scrollIntoViewIfNeeded()
    await expect(username).toBeInViewport()
    const box = await username.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)

    // Atteignable : on peut y taper, puis descendre jusqu'au dernier bouton du formulaire.
    await username.fill('pseudo_test')
    await expect(username).toHaveValue('pseudo_test')
    const submit = dialog
      .getByRole('button', { name: /Créer mon compte|Créer un compte|S’inscrire/ })
      .last()
    await submit.scrollIntoViewIfNeeded()
    await expect(submit).toBeInViewport()

    // Et on peut remonter tout en haut de la carte (jamais coupée) : le titre de la carte est visible.
    await username.scrollIntoViewIfNeeded()
    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>('.overflow-y-auto').forEach((el) => (el.scrollTop = 0))
    })
    const card = dialog.first()
    const cardBox = await card.boundingBox()
    expect(cardBox!.y).toBeGreaterThanOrEqual(0)

    await context.close()
  })
}
