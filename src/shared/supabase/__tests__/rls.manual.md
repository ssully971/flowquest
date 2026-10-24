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
