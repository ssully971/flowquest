import { expect, test } from '@playwright/test'

import { HOST, MEMBER, createFakeBackend, signInAs } from './fixtures/fake-supabase'

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
  await hostPage.getByLabel('Salons', { exact: true }).click()
  await hostPage.getByRole('tab', { name: 'Créer' }).click()
  await hostPage.getByRole('button', { name: '15 min' }).click()
  await hostPage.getByText(MEMBER.username).click()
  await hostPage.getByRole('button', { name: 'Créer le salon' }).click()

  await expect(hostPage.getByRole('button', { name: 'Démarrer' })).toBeVisible()

  // 2. Le membre voit l'invitation dans SON navigateur et l'accepte. La notification
  // temps réel (LOT H1, §2) se déclenche ici : ouvrir le panneau rafraîchit la liste des
  // salons (voir le commentaire dans RoomsPanel) et le nouvel item détecté par diff
  // déclenche le toast — pas de vrai canal Realtime dans cet environnement (voir
  // l'en-tête de ce fichier), mais la logique de détection et d'affichage est la même.
  await memberPage.getByLabel('Salons', { exact: true }).click()
  await expect(memberPage.getByText('Hôte t’invite à un salon de focus.')).toBeVisible()
  await expect(memberPage.getByText(/t’invite dans un salon/)).toBeVisible()
  await memberPage.getByRole('button', { name: 'Accepter' }).click()
  await expect(memberPage.getByText('En attente du démarrage par l’hôte.')).toBeVisible()

  // 3. L'hôte démarre le minuteur partagé.
  await hostPage.getByRole('button', { name: 'Démarrer' }).click()
  await expect(hostPage.getByRole('button', { name: 'Mettre en pause' })).toBeVisible()

  // 4. Le membre, en rouvrant le salon, voit bien le compte à rebours démarré — preuve
  // que l'état vient du même serveur partagé, pas d'un état local à chaque navigateur —
  // et n'a aucun contrôle hôte (gating vérifié aussi côté interface, en plus de la RPC).
  // `exact: true` : sans lui, ce nom nu est ambigu avec le bouton « Fermer la
  // notification » du toast d'invitation (LOT H1, temps réel) encore affiché quelques
  // secondes après l'avoir reçue.
  await memberPage.getByRole('button', { name: 'Fermer', exact: true }).click()
  await memberPage.getByLabel('Salons', { exact: true }).click()
  await memberPage.getByRole('button', { name: 'Rejoindre' }).click()
  await expect(memberPage.getByText('En attente du démarrage par l’hôte.')).toHaveCount(0)
  await expect(memberPage.getByRole('button', { name: 'Mettre en pause' })).not.toBeVisible()

  // 5. L'hôte transfère son rôle au membre : son propre écran perd aussitôt les
  // contrôles (pas besoin de rafraîchir, l'action se recharge elle-même).
  await hostPage.getByRole('button', { name: 'Nommer hôte' }).click()
  await expect(hostPage.getByRole('button', { name: 'Mettre en pause' })).not.toBeVisible()

  // 6. Le membre, en rouvrant à son tour, voit qu'il est désormais hôte et peut
  // contrôler le salon — le transfert a bien traversé les deux navigateurs.
  // `exact: true` : même ambiguïté qu'à l'étape 4 avec le toast d'invitation.
  await memberPage.getByRole('button', { name: 'Fermer', exact: true }).click()
  await memberPage.getByLabel('Salons', { exact: true }).click()
  await memberPage.getByRole('button', { name: 'Rejoindre' }).click()
  await expect(memberPage.getByRole('button', { name: 'Mettre en pause' })).toBeVisible()

  // 7. Le nouvel hôte (le membre) termine le salon.
  await memberPage.getByRole('button', { name: 'Terminer' }).click()
  await expect(memberPage.getByText('Salon terminé')).toBeVisible()

  // 8. Un salon terminé disparaît de « Mes salons » (list_my_rooms() exclut `status =
  // 'ended'`) : l'ancien hôte, en rouvrant le panneau, ne voit plus ce salon du tout —
  // plutôt qu'un bouton « Rejoindre » vers un salon qui ne tourne plus.
  // `exact: true` : même ambiguïté qu'à l'étape 4 avec le toast d'invitation.
  await hostPage.getByRole('button', { name: 'Fermer', exact: true }).click()
  await hostPage.getByLabel('Salons', { exact: true }).click()
  await hostPage.getByRole('tab', { name: 'Mes salons' }).click()
  await expect(hostPage.getByText(/t’invite dans un salon/)).toHaveCount(0)
  await expect(hostPage.getByRole('button', { name: 'Rejoindre' })).toHaveCount(0)
  await expect(hostPage.getByText('Pas encore de salon.')).toBeVisible()

  await hostContext.close()
  await memberContext.close()
})
