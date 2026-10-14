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
