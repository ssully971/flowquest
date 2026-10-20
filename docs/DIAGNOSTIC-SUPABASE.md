# Diagnostic Supabase

Procédure à suivre à la main dans Supabase (SQL Editor) en cas de problème de connexion,
de profil, ou d'erreur d'accès aux données. Voir aussi la page `/diagnostic` de
l'application (accessible à tous, sans donnée sensible), qui automatise une bonne partie
des vérifications ci-dessous depuis le navigateur.

## 1. « permission denied for table... » (erreur 42501) ou RPC en 404

**Cause la plus fréquente, déjà rencontrée en production** : RLS (Row Level Security) est
activée sur une table, mais aucun `GRANT` PostgreSQL n'a été donné aux rôles
`authenticated`/`anon`. RLS filtre les **lignes** qu'une requête peut voir, mais ne donne
par elle-même aucun droit d'accéder à la **table** : sans `GRANT` explicite, Postgres
refuse la requête avant même d'évaluer les politiques RLS. Supabase accorde habituellement
ces `GRANT` lui-même quand une table est créée depuis son tableau de bord ; comme ce projet
gère son schéma à la main via `supabase/migrations/`, ils doivent être écrits
explicitement (voir migration `0018_grants.sql`, et `docs/SECURITE.md` pour le détail
table par table).

Un `/rpc/<nom_fonction>` en 404 a la même cause : il manque un `grant execute on function
...` pour le rôle qui appelle la fonction.

Pour vérifier les droits actuels d'une table :

```sql
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'NOM_DE_LA_TABLE'
order by grantee, privilege_type;
```

`authenticated` doit apparaître avec les privilèges attendus pour cette table (voir le
tableau dans `docs/SECURITE.md`). S'il manque, recolle `supabase/migrations/0018_grants.sql`
(idempotent) — ou, pour une table ajoutée après coup sans son propre `GRANT`, écris une
migration de correctif sur le même modèle plutôt que de modifier `0018` après coup.

## 2. Vérifier que toutes les migrations sont appliquées

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
order by routine_name;
```

Doit contenir au minimum : `delete_own_account`, `ensure_profile`, `generate_unique_username`,
`handle_new_user`, `is_admin`, `is_username_available`, `prevent_role_self_escalation`,
`reject_stale_write`, `set_updated_at`.

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Doit contenir : `admin_log`, `changelog`, `focus_sessions`, `notes`, `profiles`, `quotes`,
`support_messages`, `tasks`, `timer_state`, `user_settings`.

Si une fonction ou une table manque : recolle les fichiers de `supabase/migrations/` dans
l'ordre numérique (`0001` à `0018` au moment où ce document est écrit — vérifie le dernier
numéro dans le dossier) dans le SQL Editor. Ils sont tous idempotents — aucun risque à les
recoller, même ceux déjà appliqués.

## 3. Vérifier que le trigger de création automatique existe

```sql
select tgname, tgrelid::regclass, tgenabled
from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;
```

Doit afficher une ligne `on_auth_user_created` avec `tgenabled = 'O'` (activé). Si la ligne
est absente, recolle `supabase/migrations/0002_profiles.sql` (idempotent).

## 4. Vérifier que ta ligne `profiles` existe

Remplace l'e-mail par le tien :

```sql
select p.*
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'TON-EMAIL@EXEMPLE.COM';
```

- **Une ligne s'affiche** : ton profil existe, le problème est ailleurs (vérifie les
  `GRANT` à l'étape 1, les politiques RLS à l'étape 5, ou regarde les logs du site).
- **Rien ne s'affiche** : ta ligne manque. Le correctif côté application (`ensure_profile()`,
  appelé automatiquement à la prochaine connexion) doit la recréer tout seul — recharge la
  page et reconnecte-toi. Si tu veux la créer toi-même sans attendre :

  ```sql
  insert into public.profiles (id, username, display_name)
  select u.id, public.generate_unique_username(split_part(u.email, '@', 1)), null
  from auth.users u
  where u.email = 'TON-EMAIL@EXEMPLE.COM'
    and not exists (select 1 from public.profiles p where p.id = u.id);
  ```

  (Nécessite que `0009_ensure_profile.sql` ait été collée, pour que
  `generate_unique_username()` existe.)

## 5. Vérifier les politiques RLS sur `profiles`

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'profiles';
```

Doit lister `profiles_select_own`, `profiles_insert_own`, `profiles_update_own` — chacune
avec `qual` ou `with_check` contenant `auth.uid() = id`. Si une politique manque ou est
différente, recolle `supabase/migrations/0002_profiles.sql`.

Pour vérifier que RLS est bien activée sur **toutes** les tables (et pas seulement
`profiles`) :

```sql
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;
```

`relrowsecurity` doit valoir `true` pour les 10 tables listées à l'étape 2.

## 6. Te passer administrateur

Voir `supabase/make_admin.example.sql` : remplace l'e-mail placeholder par le tien et
exécute-le dans le SQL Editor (fonctionne uniquement depuis l'éditeur SQL, jamais depuis
l'application — voir `docs/SECURITE.md`).

## 7. Si rien de tout ça ne résout le problème

Dans l'application, Réglages > Compte affiche toujours un état explicite : chargement,
erreur avec bouton « Réessayer » et message, ou profil chargé — jamais un panneau vide. La
page `/diagnostic` et le bloc « Détails techniques » dépliable sous les erreurs
d'authentification donnent le code d'erreur exact (copie-le) pour cibler la cause précise.
