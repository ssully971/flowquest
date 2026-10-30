import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { HOST, MEMBER, createFakeBackend, signInAs } from './fixtures/fake-supabase'

/**
 * Ouvre l'onglet Salons du panneau social (LOT H2, §1) : plus de bouton dédié en bas à
 * droite de l'accueil — point d'entrée unique désormais la carte profil en haut de
 * Réglages, qui ouvre le panneau social (Amis/Demandes/Classement/Salons/Ajouter).
 * `.filter({ visible: true })` : la carte profil est rendue deux fois (mobile et bureau,
 * une seule visible par CSS selon la largeur — voir SettingsPanel), sans ça le mode
 * strict de Playwright échoue sur les deux correspondances.
 */
async function openRoomsTab(page: Page) {
  await page.getByLabel('Réglages', { exact: true }).click()
  await page
    .getByRole('button', { name: /Amis, salons et classement/ })
    .filter({ visible: true })
    .click()
  await page.getByRole('tab', { name: /Salons/ }).click()
}

/**
 * Test à deux contextes de navigateur pour les salons de focus (LOT F3, règle
 * transversale du Mode Amis). Deux vrais contextes Chromium, deux vraies sessions
 * authentifiées, un seul faux serveur partagé (voir fixtures/fake-supabase.ts) : vérifie
 * qu'une action faite dans le navigateur de l'hôte est bien visible dans celui du
 * participant une fois rafraîchi, pas seulement dans l'état local de React.
 *
 * Pas de vrai canal Realtime dans cet environnement (pas de projet Supabase en ligne) :
 * les rafraîchissements sont déclenchés explicitement (fermer/rouvrir le salon) plutôt
 * que d'attendre le repli par interrogation de 30 s — voir docs/AMIS.md pour ce qui n'a
 * pas pu être vérifié en conditions réelles. Ce même déclenchement explicite sert aussi à
 * vérifier le toast d'invitation en temps réel (LOT H1, §2) à l'étape 2 : la logique de
 * détection par diff et d'affichage est identique à celle qu'un vrai événement
 * postgres_changes déclencherait, seul le déclencheur (ouverture du panneau plutôt que
 * push serveur) diffère dans cet environnement de test.
 */
test('deux navigateurs voient le même salon se synchroniser', async ({ browser }) => {
  test.setTimeout(60_000)
  const backend = createFakeBackend()

  const hostContext = await browser.newContext()
  const memberContext = await browser.newContext()
  const hostPage = await hostContext.newPage()
  const memberPage = await memberContext.newPage()

  await signInAs(hostPage, backend, HOST)
  await signInAs(memberPage, backend, MEMBER)

  // window.confirm() est une vraie boîte de dialogue native bloquante dans un navigateur
  // réel — Playwright la rejette par défaut (comme un clic sur Annuler), donc il faut
  // l'accepter explicitement avant le clic sur « Terminer » plus bas.
  hostPage.on('dialog', (dialog) => void dialog.accept())
  memberPage.on('dialog', (dialog) => void dialog.accept())

  await hostPage.goto('/')
  await memberPage.goto('/')

  // 1. L'hôte crée un salon de 15 min et invite le membre.
  await openRoomsTab(hostPage)
  await hostPage.getByRole('tab', { name: 'Créer' }).click()
  await hostPage.getByRole('button', { name: '15 min' }).click()
  await hostPage.getByText(MEMBER.username).click()
  await hostPage.getByRole('button', { name: 'Créer le salon' }).click()

  // LOT M3 : la session de groupe prend la place de l'horloge solo (plus de fenêtre séparée).
  await expect(hostPage.getByText('Démarre dès que tu es prêt.')).toBeVisible()
  await expect(hostPage.getByRole('button', { name: 'Lancer' })).toBeVisible()

  // 2. LOT M4 : le membre est notifié EN DIRECT, sans ouvrir le mode amis ni rien rafraîchir
  // (pas de vrai canal Realtime dans cet environnement : le repli par interrogation toutes les
  // 4 s rattrape l'évènement). Il rejoint depuis la bannière : la session de groupe prend aussitôt
  // la place de son horloge.
  await expect(memberPage.getByText(/t’invite à un salon de focus/)).toBeVisible({ timeout: 15_000 })
  await memberPage.getByRole('button', { name: 'Rejoindre' }).click()
  await expect(memberPage.getByText('En attente de l’hôte')).toBeVisible()

  // 2 bis. LOT P1 : aucune requête en continu. Dans cet environnement le canal Realtime est coupé,
  // donc seul le repli à 4 s tourne (jamais le filet à 60 s) : sur 9 s, quelques rechargements au
  // plus (une boucle d'écriture/lecture en produirait des dizaines) et aucun battement de cœur
  // supplémentaire (2 min). Le membre n'a pas encore rejoint : la mesure se fait chez l'hôte.
  const quietStart = backend.calls.length
  await hostPage.waitForTimeout(9_000)
  const quietCalls = backend.calls.slice(quietStart).filter((call) => call.userId === HOST.id)
  expect(quietCalls.filter((call) => call.fn === 'get_room_state').length).toBeLessThanOrEqual(5)
  expect(quietCalls.filter((call) => call.fn === 'touch_my_rooms')).toHaveLength(0)

  // 3. L'hôte démarre le minuteur partagé.
  await hostPage.getByRole('button', { name: 'Lancer' }).click()
  await expect(hostPage.getByRole('button', { name: 'Mettre en pause' })).toBeVisible()

  // 4. Le membre voit l'horloge démarrer SANS rien rafraîchir (Realtime, repli à 4 s) — preuve
  // que l'état vient du même serveur partagé — en lecture seule : aucun contrôle hôte.
  await expect(memberPage.getByText('Seul l’hôte contrôle l’horloge.')).toBeVisible()
  await expect(memberPage.getByText('En attente de l’hôte')).toHaveCount(0)
  await expect(memberPage.getByRole('button', { name: 'Mettre en pause' })).not.toBeVisible()

  // 5. L'hôte transfère son rôle au membre : son propre écran perd aussitôt les
  // contrôles (pas besoin de rafraîchir, l'action se recharge elle-même).
  await hostPage.getByRole('button', { name: 'Nommer hôte' }).click()
  await expect(hostPage.getByRole('button', { name: 'Mettre en pause' })).not.toBeVisible()

  // 6. Le membre devient hôte en direct (aucun rechargement) et peut contrôler le salon.
  await expect(memberPage.getByRole('button', { name: 'Mettre en pause' })).toBeVisible()

  // 7. Le nouvel hôte (le membre) termine la session pour tout le monde.
  await memberPage.getByRole('button', { name: 'Terminer' }).click()
  await expect(memberPage.getByText('Session terminée')).toBeVisible()
  await expect(hostPage.getByText('Session terminée')).toBeVisible()

  // 8. Un salon terminé disparaît de « Mes salons » (list_my_rooms() exclut `status =
  // 'ended'`) : l'ancien hôte ferme l'écran de fin, rouvre le panneau et ne voit plus ce
  // salon du tout — plutôt qu'un bouton « Rejoindre » vers un salon qui ne tourne plus.
  await hostPage.getByRole('button', { name: 'Fermer', exact: true }).click()
  await openRoomsTab(hostPage)
  await hostPage.getByRole('tab', { name: 'Mes salons' }).click()
  await expect(hostPage.getByText(/t’invite dans un salon/)).toHaveCount(0)
  await expect(hostPage.getByRole('button', { name: 'Rejoindre' })).toHaveCount(0)
  await expect(hostPage.getByText('Pas encore de salon.')).toBeVisible()

  await hostContext.close()
  await memberContext.close()
})

/**
 * LOT P1 — retour visuel : verrou anti-double-clic, libellé d'action pendant l'attente, échec
 * réseau traduit avec « Réessayer ». Un seul navigateur (l'hôte), serveur lent simulé.
 */
test('chaque action donne un retour immédiat, ignore le double clic et se rejoue après un échec', async ({
  browser,
}) => {
  const backend = createFakeBackend()
  const hostContext = await browser.newContext()
  const memberContext = await browser.newContext()
  const hostPage = await hostContext.newPage()
  const memberPage = await memberContext.newPage()
  await signInAs(hostPage, backend, HOST)
  await signInAs(memberPage, backend, MEMBER)
  hostPage.on('dialog', (dialog) => void dialog.accept())
  await hostPage.goto('/')
  await memberPage.goto('/')

  await openRoomsTab(hostPage)
  await hostPage.getByRole('tab', { name: 'Créer' }).click()
  await hostPage.getByRole('button', { name: '15 min' }).click()
  await hostPage.getByText(MEMBER.username).click()
  await hostPage.getByRole('button', { name: 'Créer le salon' }).click()
  await expect(hostPage.getByRole('button', { name: 'Lancer' })).toBeVisible()

  // Serveur lent : le clic sur « Lancer » est suivi, tout de suite, d'un bouton occupé « Lancement… »
  // (désactivé), même si la réponse n'est pas encore arrivée. Un second clic ne part pas.
  backend.setLatency(1_200)
  const startCallsBefore = backend.calls.filter((call) => call.fn === 'start_room').length
  const launch = hostPage.getByRole('button', { name: 'Lancer' })
  await launch.click()
  const busy = hostPage.getByRole('button', { name: 'Lancement…' })
  await expect(busy).toBeVisible()
  await expect(busy).toBeDisabled()
  await busy.click({ force: true }).catch(() => undefined) // double clic : sans effet
  await expect(hostPage.getByRole('button', { name: 'Mettre en pause' })).toBeVisible({ timeout: 10_000 })
  expect(backend.calls.filter((call) => call.fn === 'start_room').length - startCallsBefore).toBe(1)

  // Échec réseau sur « Pause » : message français, retour en arrière, puis « Réessayer » aboutit.
  backend.setLatency(0)
  backend.failNext('pause_room', 'Failed to fetch')
  await hostPage.getByRole('button', { name: 'Mettre en pause' }).click()
  const alert = hostPage.getByRole('alert').filter({ hasText: 'Connexion impossible' })
  await expect(alert).toBeVisible()
  await expect(hostPage.getByRole('button', { name: 'Mettre en pause' })).toBeVisible()
  await alert.getByRole('button', { name: 'Réessayer' }).click()
  await expect(hostPage.getByRole('button', { name: 'Reprendre' })).toBeVisible()
  await expect(alert).toHaveCount(0)

  await hostContext.close()
  await memberContext.close()
})
