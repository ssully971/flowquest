import { expect, test } from '@playwright/test'

/**
 * Lot 6B — la constellation comme fond d'écran. Sans compte ni tâche (invité), le fond affiche
 * la constellation décorative : le canvas doit exister et contenir des pixels dessinés (le
 * rendu 2D réel, que jsdom ne peut pas vérifier), sans qu'aucune simulation ne tourne ensuite.
 */
test('le fond « Constellation » dessine une constellation décorative et reste figé', async ({ page }) => {
  await page.route('**/fake-project.supabase.co/rest/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/realtime/v1/**', (route) => route.abort())
  await page.addInitScript(() => {
    const selection = { dark: 'constellation', light: 'constellation', linked: true }
    window.localStorage.setItem(
      'flowquest.backgrounds',
      JSON.stringify({ home: selection, focus: selection, ambient: selection }),
    )
    window.sessionStorage.setItem('flowquest.authGateDismissed', 'true')
  })
  await page.setViewportSize({ width: 390, height: 780 })
  await page.goto('/')

  const canvas = page.getByTestId('constellation-background').locator('canvas')
  await expect(canvas).toBeAttached()

  const drawnPixels = () =>
    canvas.evaluate((element) => {
      const c = element as HTMLCanvasElement
      const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
      let count = 0
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count += 1
      return count
    })

  await expect.poll(drawnPixels).toBeGreaterThan(500)
  // Figé : aucune animation, deux mesures espacées sont identiques.
  const first = await drawnPixels()
  await page.waitForTimeout(600)
  expect(await drawnPixels()).toBe(first)
})

test('la constellation est verrouillée pour un invité dans Réglages > Piliers', async ({ page }) => {
  await page.route('**/fake-project.supabase.co/rest/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/realtime/v1/**', (route) => route.abort())
  await page.addInitScript(() => window.sessionStorage.setItem('flowquest.authGateDismissed', 'true'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Réglages' }).first().click()
  await page.getByRole('button', { name: /Piliers/ }).first().click()

  await expect(
    page.getByRole('button', { name: 'Constellation, verrouillé : crée un compte pour débloquer' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ouvrir la constellation' })).toHaveCount(0)
})
