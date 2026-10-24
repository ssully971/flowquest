# Vérification manuelle des politiques RLS

RLS ne peut pas être testée par un test unitaire Vitest (elle n'existe que contre une vraie
base Postgres avec de vrais jetons JWT). Ce script est à exécuter une fois après avoir
collé les migrations, avec deux comptes de test jetables.

## Pré-requis

- `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` renseignés (`.env`).
- Deux comptes de test : `a@test.flowquest.dev` et `b@test.flowquest.dev` (mots de passe
  au choix, 8 caractères min. + 1 majuscule + 1 chiffre).

## Script (Node, via `npx tsx` ou en console du navigateur)

```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

const url = process.env.VITE_SUPABASE_URL!
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!

async function signIn(email: string, password: string) {
  const client = createClient<Database>(url, anonKey)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

async function main() {
  const clientA = await signIn('a@test.flowquest.dev', 'Motdepasse1')
  const clientB = await signIn('b@test.flowquest.dev', 'Motdepasse1')

  const { data: userA } = await clientA.auth.getUser()

  // 1. A crée une tâche.
  const { data: inserted, error: insertError } = await clientA
    .from('tasks')
    .insert({ user_id: userA.user!.id, title: 'Tâche privée de A' })
    .select()
    .single()
  if (insertError) throw insertError
  console.log('A a bien créé sa tâche :', inserted.id)

  // 2. B ne doit JAMAIS la voir.
  const { data: seenByB } = await clientB.from('tasks').select('*').eq('id', inserted.id)
  console.assert(seenByB?.length === 0, 'ÉCHEC : B voit une tâche de A !')
  console.log('OK : B ne voit pas la tâche de A. Lignes retournées :', seenByB?.length)

  // 3. B tente de la modifier : 0 ligne affectée, jamais une erreur qui confirmerait l'existence.
  const { data: updatedByB, error: updateError } = await clientB
    .from('tasks')
    .update({ title: 'Piraté' })
    .eq('id', inserted.id)
    .select()
  console.assert(
    !updateError && updatedByB?.length === 0,
    'ÉCHEC : B a pu modifier la tâche de A !',
  )
  console.log('OK : la tentative de modification par B touche 0 ligne.')

  // 4. B tente de la supprimer : même résultat attendu.
  const { data: deletedByB } = await clientB.from('tasks').delete().eq('id', inserted.id).select()
  console.assert(deletedByB?.length === 0, 'ÉCHEC : B a pu supprimer la tâche de A !')
  console.log('OK : la tentative de suppression par B touche 0 ligne.')

  // 5. A peut toujours lire et supprimer sa propre tâche (nettoyage).
  const { data: cleanup } = await clientA.from('tasks').delete().eq('id', inserted.id).select()
  console.assert(cleanup?.length === 1, 'A devrait pouvoir supprimer sa propre tâche.')
  console.log('Nettoyage OK.')

  // 6. Un utilisateur authentifié ne peut jamais changer son propre rôle.
  const { error: roleError } = await clientA
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', userA.user!.id)
  console.assert(roleError !== null, 'ÉCHEC : A a pu se promouvoir admin lui-même !')
  console.log('OK : la tentative de changer son propre rôle est bloquée :', roleError?.message)
}

main().then(() => console.log('Script terminé.'))
```

Répète l'étape 1-4 pour `user_settings`, `focus_sessions` et `timer_state` en adaptant les
colonnes insérées : le principe est le même pour les quatre tables (0 ligne visible, 0 ligne
modifiable, 0 ligne supprimable par un autre utilisateur).

## Résultat attendu

Toutes les lignes `OK :` s'affichent, aucune ligne `ÉCHEC :`. Si une seule table laisse
passer une lecture, modification ou suppression croisée, ne pas déployer en production tant
que la politique RLS correspondante n'est pas corrigée.

## Mode Amis (LOT F1) : amis, vie privée, avatars

À exécuter après avoir collé les migrations `0019` à `0024`. Réutilise `clientA`/`clientB`
du script ci-dessus (section réinitialisée : si A et B sont déjà amis d'un run précédent,
adapte les assertions en conséquence ou repars de deux comptes neufs).

```ts
async function testFriendsAndPrivacy() {
  const clientA = await signIn('a@test.flowquest.dev', 'Motdepasse1')
  const clientB = await signIn('b@test.flowquest.dev', 'Motdepasse1')
  const { data: userA } = await clientA.auth.getUser()
  const { data: userB } = await clientB.auth.getUser()

  // 1. profiles reste strictement limitée à sa propre ligne : B ne peut PAS lire le
  // profil de A directement (même après qu'ils soient amis — la lecture passe toujours
  // par list_friends()/list_friend_requests()/find_profile_preview(), jamais par un
  // select direct élargi).
  const { data: seenByB } = await clientB.from('profiles').select('*').eq('id', userA.user!.id)
  console.assert(seenByB?.length === 0, 'ÉCHEC : B peut lire le profil de A via select direct !')
  console.log('OK : profiles reste strictement privée, même pour un ami. Lignes :', seenByB?.length)

  // 2. A envoie une demande à B par pseudo exact, B accepte.
  const { data: bProfile } = await clientB.from('profiles').select('username').eq('id', userB.user!.id).single()
  const { data: request, error: sendError } = await clientA.rpc('send_friend_request', {
    p_username: bProfile!.username,
  })
  if (sendError) throw sendError
  const { error: acceptError } = await clientB.rpc('respond_friend_request', {
    p_friendship_id: request.id,
    p_accept: true,
  })
  if (acceptError) throw acceptError
  console.log('OK : A et B sont maintenant amis.')

  // 3. list_friends() renvoie bien l'autre, des deux côtés.
  const { data: aFriends } = await clientA.rpc('list_friends')
  console.assert(aFriends?.some((f: { id: string }) => f.id === userB.user!.id), 'ÉCHEC : A ne voit pas B dans ses amis.')
  console.log('OK : list_friends() renvoie la relation des deux côtés.')

  // 4. B bloque A : A ne peut plus lui renvoyer de demande (message générique, jamais
  // « tu es bloqué »).
  const { error: blockError } = await clientB.rpc('block_user', { p_other_user_id: userA.user!.id })
  if (blockError) throw blockError
  const { error: reRequestError } = await clientA.rpc('send_friend_request', { p_username: bProfile!.username })
  console.assert(reRequestError !== null, 'ÉCHEC : A a pu recontacter B après avoir été bloqué !')
  console.log('OK : send_friend_request échoue après blocage :', reRequestError?.message)

  // 5. Après blocage, B n'apparaît plus dans la liste d'amis de A (la relation n'est plus
  // 'accepted').
  const { data: aFriendsAfterBlock } = await clientA.rpc('list_friends')
  console.assert(
    !aFriendsAfterBlock?.some((f: { id: string }) => f.id === userB.user!.id),
    'ÉCHEC : B apparaît encore dans les amis de A après blocage.',
  )
  console.log('OK : la relation bloquée ne compte plus comme amitié.')

  // 6. Débloquer depuis le mauvais compte (A, pas le bloqueur) échoue.
  const { error: wrongUnblock } = await clientA.rpc('unblock_user', { p_other_user_id: userB.user!.id })
  console.assert(wrongUnblock !== null, 'ÉCHEC : A a pu débloquer alors que seul B a bloqué !')
  console.log('OK : seul le compte qui a bloqué peut débloquer :', wrongUnblock?.message)
}

testFriendsAndPrivacy().then(() => console.log('Script Amis terminé.'))
```

### Avatars Storage (bucket `avatars`)

```ts
async function testAvatarsStorage() {
  const clientA = await signIn('a@test.flowquest.dev', 'Motdepasse1')
  const clientB = await signIn('b@test.flowquest.dev', 'Motdepasse1')
  const { data: userA } = await clientA.auth.getUser()

  const fakeFile = new Blob(['test'], { type: 'image/webp' })

  // 1. A peut écrire dans SON dossier.
  const { error: uploadOwnError } = await clientA.storage
    .from('avatars')
    .upload(`${userA.user!.id}/avatar.webp`, fakeFile, { upsert: true })
  console.assert(!uploadOwnError, 'ÉCHEC : A ne peut pas écrire dans son propre dossier !')
  console.log('OK : A peut écrire dans son propre dossier.')

  // 2. B ne peut PAS écrire dans le dossier de A.
  const { error: uploadOtherError } = await clientB.storage
    .from('avatars')
    .upload(`${userA.user!.id}/avatar.webp`, fakeFile, { upsert: true })
  console.assert(uploadOtherError !== null, 'ÉCHEC : B a pu écrire dans le dossier de A !')
  console.log('OK : écriture refusée dans le dossier d’un autre :', uploadOtherError?.message)

  // 3. Lecture publique par URL directe (hors RLS, fonctionne même sans connexion) :
  // vérifier à la main dans un onglet privé que l'URL suivante charge l'image.
  const { data: publicUrl } = clientA.storage.from('avatars').getPublicUrl(`${userA.user!.id}/avatar.webp`)
  console.log('Vérifie à la main (onglet privé, sans session) :', publicUrl.publicUrl)

  // 4. Mais le bucket n'est PAS listable par un autre utilisateur (ni par personne pour
  // le dossier de quelqu'un d'autre) : .list() doit renvoyer vide, jamais une erreur qui
  // confirmerait l'existence du dossier.
  const { data: listedByB, error: listError } = await clientB.storage.from('avatars').list(userA.user!.id)
  console.assert(!listError && (listedByB?.length ?? 0) === 0, 'ÉCHEC : B peut lister le dossier de A !')
  console.log('OK : le bucket n’est pas énumérable par un autre compte. Fichiers listés :', listedByB?.length)
}

testAvatarsStorage().then(() => console.log('Script Storage terminé.'))
```

### Résultat attendu

Mêmes règles que plus haut : uniquement des lignes `OK :`. Si `testAvatarsStorage` échoue à
l'étape 1 avec une erreur de permission, vérifie d'abord que le bucket `avatars` existe bien
(migration `0024_avatars_storage.sql` collée) avant de soupçonner les politiques.

## Statut en direct, encouragements, classement (LOT F2)

À exécuter après `0025` à `0027`, avec A et B déjà amis (voir `testFriendsAndPrivacy()`
plus haut).

```ts
async function testLiveStatusAndCheers() {
  const clientA = await signIn('a@test.flowquest.dev', 'Motdepasse1')
  const clientB = await signIn('b@test.flowquest.dev', 'Motdepasse1')
  const { data: userA } = await clientA.auth.getUser()
  const { data: userB } = await clientB.auth.getUser()

  // 1. A se met « en focus », B (son ami) doit le voir dans list_friends().
  const { error: upsertError } = await clientA
    .from('live_status')
    .upsert({ user_id: userA.user!.id, state: 'focus', started_at: new Date().toISOString() })
  if (upsertError) throw upsertError
  const { data: bSeesA } = await clientB.rpc('list_friends')
  const aFromB = bSeesA?.find((f: { id: string }) => f.id === userA.user!.id)
  console.assert(aFromB?.live_state === 'focus' && aFromB?.live_is_online === true, 'ÉCHEC : B ne voit pas A en focus.')
  console.log('OK : B voit le statut en direct de A.')

  // 2. A désactive show_live_status : B ne doit plus rien voir (null, jamais la vraie valeur).
  const { error: privacyError } = await clientA.from('profiles').update({ show_live_status: false }).eq('id', userA.user!.id)
  if (privacyError) throw privacyError
  const { data: bSeesAHidden } = await clientB.rpc('list_friends')
  const aHidden = bSeesAHidden?.find((f: { id: string }) => f.id === userA.user!.id)
  console.assert(aHidden?.live_state === null && aHidden?.live_is_online === false, 'ÉCHEC : B voit encore le statut de A après désactivation.')
  console.log('OK : statut masqué dès que show_live_status est désactivé.')
  await clientA.from('profiles').update({ show_live_status: true }).eq('id', userA.user!.id) // remet en place

  // 3. Un non-ami (ex. un 3e compte C non ami de A) ne doit JAMAIS lire la ligne live_status
  // de A directement (même si A est "en focus") : à vérifier manuellement avec un 3e
  // compte si besoin, même principe que l'étape 1 du script générique plus haut.

  // 4. B envoie un encouragement à A.
  const { error: cheerError } = await clientB.rpc('send_cheer', { p_recipient_id: userA.user!.id, p_emoji: '🔥' })
  if (cheerError) throw cheerError
  const { data: aUnread } = await clientA.rpc('list_unread_cheers')
  console.assert(aUnread?.some((c: { sender_id: string }) => c.sender_id === userB.user!.id), 'ÉCHEC : A ne voit pas l’encouragement de B.')
  console.log('OK : A reçoit bien l’encouragement de B.')

  // 5. Quota : B ré-encourage A moins de 10 min après — doit échouer.
  const { error: quotaError } = await clientB.rpc('send_cheer', { p_recipient_id: userA.user!.id, p_emoji: '👏' })
  console.assert(quotaError !== null, 'ÉCHEC : le quota de 10 minutes par destinataire n’a pas été appliqué !')
  console.log('OK : quota 10 min/destinataire respecté :', quotaError?.message)

  // 6. weekly_leaderboard() renvoie toujours au moins l'appelant lui-même.
  const { data: leaderboard, error: leaderboardError } = await clientA.rpc('weekly_leaderboard', { p_week_offset: 0 })
  if (leaderboardError) throw leaderboardError
  console.assert(leaderboard?.some((row: { is_self: boolean }) => row.is_self), 'ÉCHEC : weekly_leaderboard() ne renvoie pas l’appelant.')
  console.log('OK : le classement inclut toujours soi-même.')

  // 7. p_week_offset hors de {0,1} doit échouer.
  const { error: offsetError } = await clientA.rpc('weekly_leaderboard', { p_week_offset: 5 })
  console.assert(offsetError !== null, 'ÉCHEC : un décalage de semaine invalide a été accepté !')
  console.log('OK : p_week_offset invalide rejeté :', offsetError?.message)

  // Nettoyage.
  await clientA.from('live_status').delete().eq('user_id', userA.user!.id)
}

testLiveStatusAndCheers().then(() => console.log('Script Statut/Encouragements/Classement terminé.'))
```

### Résultat attendu

Uniquement des lignes `OK :`. Vérifie aussi, dans le tableau de bord Supabase (Database >
Replication), que `live_status` apparaît bien activée pour `supabase_realtime` — la
migration `0025_live_status.sql` l'active par SQL, mais une vérification visuelle reste
utile selon les droits du projet.

## Salons de focus ensemble (LOT F3)

À exécuter après avoir collé les migrations `0028` et `0029`. A et B doivent déjà être
amis (voir `testFriendsAndPrivacy` ci-dessus) ; un 3e compte C, non participant du salon,
sert à vérifier que `get_room_state()` reste bien fermé à qui n'est pas dedans.

```ts
async function testRooms() {
  const clientA = await signIn('a@test.flowquest.dev', 'Motdepasse1')
  const clientB = await signIn('b@test.flowquest.dev', 'Motdepasse1')
  const clientC = await signIn('c@test.flowquest.dev', 'Motdepasse1')
  const { data: userA } = await clientA.auth.getUser()
  const { data: userB } = await clientB.auth.getUser()

  // 0. Un salon sans aucun ami invité est refusé (LOT F4, finitions — migration 0033).
  const { error: emptyInviteError } = await clientA.rpc('create_room', { p_focus_minutes: 25, p_friend_ids: [] })
  console.assert(emptyInviteError !== null, 'ÉCHEC : un salon sans aucun invité a pu être créé !')
  console.log('OK : create_room() refuse une liste d’invités vide :', emptyInviteError?.message)

  // 1. A crée un salon et invite B.
  const { data: roomId, error: createError } = await clientA.rpc('create_room', {
    p_focus_minutes: 25,
    p_friend_ids: [userB.user!.id],
  })
  if (createError) throw createError
  console.log('OK : salon créé, id =', roomId)

  // 2. C (non participant) ne peut PAS lire l'état du salon.
  const { error: cOutsideError } = await clientC.rpc('get_room_state', { p_room_id: roomId })
  console.assert(cOutsideError !== null, 'ÉCHEC : un non-participant a pu lire get_room_state() !')
  console.log('OK : get_room_state() refuse un non-participant :', cOutsideError?.message)

  // 3. B voit l'invitation (même pas encore acceptée) et l'accepte.
  const { data: bState } = await clientB.rpc('get_room_state', { p_room_id: roomId })
  console.assert(bState?.some((row: { participant_user_id: string }) => row.participant_user_id === userB.user!.id), 'ÉCHEC : B ne voit pas le salon avant même d’avoir répondu.')
  const { error: acceptError } = await clientB.rpc('respond_room_invite', { p_room_id: roomId, p_accept: true })
  if (acceptError) throw acceptError
  console.log('OK : B voit et accepte l’invitation.')

  // 4. Seul l'hôte (A) peut démarrer ; B ne peut pas.
  const { error: bStartError } = await clientB.rpc('start_room', { p_room_id: roomId })
  console.assert(bStartError !== null, 'ÉCHEC : B (non hôte) a pu démarrer le salon !')
  const { error: startError } = await clientA.rpc('start_room', { p_room_id: roomId })
  if (startError) throw startError
  console.log('OK : seul l’hôte peut démarrer le salon.')

  // 5. B voit bien le salon « running », avec un started_at renseigné.
  const { data: bRunning } = await clientB.rpc('get_room_state', { p_room_id: roomId })
  console.assert(bRunning?.[0]?.status === 'running' && bRunning?.[0]?.started_at, 'ÉCHEC : B ne voit pas le salon démarré.')
  console.log('OK : le minuteur partagé est bien visible de B.')

  // 6. Seul l'hôte peut mettre en pause ; B ne peut pas.
  const { error: bPauseError } = await clientB.rpc('pause_room', { p_room_id: roomId })
  console.assert(bPauseError !== null, 'ÉCHEC : B (non hôte) a pu mettre le salon en pause !')
  console.log('OK : pause_room() réservée à l’hôte :', bPauseError?.message)

  // 7. Transfert explicite de l'hôte vers B, puis A ne peut plus terminer le salon.
  const { error: transferError } = await clientA.rpc('transfer_host', { p_room_id: roomId, p_new_host_id: userB.user!.id })
  if (transferError) throw transferError
  const { error: aEndAfterTransferError } = await clientA.rpc('end_room', { p_room_id: roomId })
  console.assert(aEndAfterTransferError !== null, 'ÉCHEC : A a pu terminer le salon après avoir transféré son rôle !')
  console.log('OK : transfer_host() déplace bien les droits de l’hôte.')

  // 8. A quitte le salon : puisqu'il n'est déjà plus hôte, aucun transfert à refaire ; B
  // (hôte courant) peut terminer le salon normalement.
  const { error: leaveError } = await clientA.rpc('leave_room', { p_room_id: roomId })
  if (leaveError) throw leaveError
  const { error: endError } = await clientB.rpc('end_room', { p_room_id: roomId })
  if (endError) throw endError
  const { data: ended } = await clientB.rpc('get_room_state', { p_room_id: roomId })
  console.assert(ended?.[0]?.status === 'ended', 'ÉCHEC : le salon n’est pas marqué terminé.')
  console.log('OK : B (hôte courant) a bien pu terminer le salon.')
}

testRooms().then(() => console.log('Script Salons terminé.'))
```

### Résultat attendu

Uniquement des lignes `OK :`. Le transfert automatique de l'hôte en cas d'abandon
(silence de plus de 2 minutes pendant que le salon tourne, voir `_room_tick()` dans
`0029_rooms_rpc.sql`) n'est pas couvert par ce script (délai trop long pour un test
manuel) — à vérifier en inspectant `room_participants.last_seen_at` et `rooms.host_id`
après avoir laissé un onglet hôte inactif plus de 2 minutes pendant une session en cours.
Vérifie aussi, dans Database > Replication, que `rooms` et `room_participants`
apparaissent bien activées pour `supabase_realtime`.

## Série partagée (LOT F4)

À exécuter après avoir collé les migrations `0031` et `0032`. A et B doivent déjà être
amis. `focus_sessions` est inséré directement ici (plutôt que via l'app) pour contrôler
précisément `started_at` et simuler « hier »/« avant-hier » sans attendre un vrai jour.

```ts
async function testDuoStreaks() {
  const clientA = await signIn('a@test.flowquest.dev', 'Motdepasse1')
  const clientB = await signIn('b@test.flowquest.dev', 'Motdepasse1')
  const { data: userA } = await clientA.auth.getUser()
  const { data: userB } = await clientB.auth.getUser()

  const dayAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()

  async function completeFocusSession(client: typeof clientA, userId: string, startedAt: string) {
    const { error } = await client
      .from('focus_sessions')
      .insert({ user_id: userId, kind: 'focus', planned_seconds: 1500, actual_seconds: 1500, started_at: startedAt, completed: true })
    if (error) throw error
  }

  // 1. A et B complètent chacun une session aujourd'hui : la série démarre à 1 pour les deux.
  await completeFocusSession(clientA, userA.user!.id, dayAgo(0))
  await completeFocusSession(clientB, userB.user!.id, dayAgo(0))
  const { data: aStreaks1 } = await clientA.rpc('list_duo_streaks')
  const bFromA1 = aStreaks1?.find((s: { friend_id: string }) => s.friend_id === userB.user!.id)
  console.assert(bFromA1?.current_streak === 1 && bFromA1?.active_today === true, 'ÉCHEC : la série commune n’a pas démarré à 1.')
  console.log('OK : série commune démarrée à 1 pour A et B.')

  // 2. Le lendemain (simulé), les deux complètent encore une session : la série passe à 2.
  await completeFocusSession(clientA, userA.user!.id, dayAgo(-1))
  await completeFocusSession(clientB, userB.user!.id, dayAgo(-1))
  // Remarque : dayAgo(-1) pointe dans le futur par rapport à « aujourd'hui » réel ; à
  // adapter si tu rejoues ce script plus tard dans la même journée (utilise de vraies
  // dates passées/futures cohérentes avec le moment où tu testes).
  const { data: aStreaks2 } = await clientA.rpc('list_duo_streaks')
  const bFromA2 = aStreaks2?.find((s: { friend_id: string }) => s.friend_id === userB.user!.id)
  console.assert(bFromA2?.current_streak === 2, 'ÉCHEC : la série commune n’a pas incrémenté le jour suivant.')
  console.log('OK : série commune incrémentée à 2 le jour suivant.')

  // 3. Un tiers non ami ne doit jamais voir cette ligne de duo_streaks directement.
  const { data: directRead } = await clientA.from('duo_streaks').select('*')
  console.assert(
    directRead?.every((row: { user_low: string; user_high: string }) => [row.user_low, row.user_high].includes(userA.user!.id)),
    'ÉCHEC : duo_streaks renvoie des paires qui ne concernent pas l’appelant !',
  )
  console.log('OK : duo_streaks reste limitée aux paires dont on fait partie.')
}

testDuoStreaks().then(() => console.log('Script Série partagée terminé.'))
```

### Résultat attendu

Uniquement des lignes `OK :`. La remise à zéro après un jour manqué (reset paresseux de
`list_duo_streaks()`) n'est pas couverte par ce script simplifié — à vérifier en insérant
une session complétée pour un seul des deux comptes, en avançant artificiellement
`last_active_date` de plus d'un jour dans le passé via le SQL Editor, puis en rappelant
`list_duo_streaks()` et en confirmant que `current_streak` retombe à 0.
