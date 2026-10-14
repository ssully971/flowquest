# Diagnostic Supabase — « Impossible de charger ton profil »

Procédure à suivre à la main dans Supabase (SQL Editor) si le message « Impossible de
charger ton profil » réapparaît après le correctif (migration `0009_ensure_profile.sql`),
ou pour vérifier l'état général des migrations.

## 1. Vérifier que les 9 migrations sont appliquées

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
order by routine_name;
```

Doit contenir au minimum : `ensure_profile`, `generate_unique_username`, `handle_new_user`,
`is_admin`, `prevent_role_self_escalation`, `reject_stale_write`, `set_updated_at`.

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Doit contenir : `focus_sessions`, `profiles`, `tasks`, `timer_state`, `user_settings`.

Si une fonction ou une table manque : recolle les fichiers de `supabase/migrations/` dans
l'ordre numérique (0001 à 0009) dans le SQL Editor. Ils sont tous idempotents — aucun
risque à les recoller, même ceux déjà appliqués.

## 2. Vérifier que le trigger de création automatique existe

```sql
select tgname, tgrelid::regclass, tgenabled
from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;
```

Doit afficher une ligne `on_auth_user_created` avec `tgenabled = 'O'` (activé). Si la ligne
est absente, recolle `supabase/migrations/0002_profiles.sql` (idempotent).

## 3. Vérifier que ta ligne `profiles` existe

Remplace l'e-mail par le tien :

```sql
select p.*
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'TON-EMAIL@EXEMPLE.COM';
```

- **Une ligne s'affiche** : ton profil existe, le problème est ailleurs (vérifie les
  politiques RLS à l'étape 4, ou regarde les logs du site).
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

## 4. Vérifier les politiques RLS sur `profiles`

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'profiles';
```

Doit lister `profiles_select_own`, `profiles_insert_own`, `profiles_update_own` — chacune
avec `qual` ou `with_check` contenant `auth.uid() = id`. Si une politique manque ou est
différente, recolle `supabase/migrations/0002_profiles.sql`.

## 5. Te passer administrateur

Voir `supabase/make_admin.example.sql` : remplace l'e-mail placeholder par le tien et
exécute-le dans le SQL Editor (fonctionne uniquement depuis l'éditeur SQL, jamais depuis
l'application — voir `docs/SECURITE.md`).

## 6. Si rien de tout ça ne résout le problème

Dans l'application, Réglages > Compte affiche désormais toujours un état explicite :
chargement, erreur avec bouton « Réessayer » et message, ou profil chargé — jamais un
panneau vide. Le message d'erreur affiché (copie-le) aide à cibler la cause exacte.
