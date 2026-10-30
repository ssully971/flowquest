-- Diagnostic « l'onglet Admin n'affiche aucun compte » — à coller dans l'éditeur SQL Supabase, UNE requête
-- à la fois (ou tout d'un coup : chaque SELECT a un titre en première colonne). Lecture seule.
-- Remplace 'ton-email@exemple.com' (requêtes 3 et 4) par l'e-mail de ton compte admin.

-- 1. Combien de comptes dans auth.users et dans profiles ? Des comptes sans profil ?
select
  (select count(*) from auth.users) as comptes_auth,
  (select count(*) from public.profiles) as profils,
  (select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)) as comptes_sans_profil,
  (select count(*) from public.profiles p where not exists (select 1 from auth.users u where u.id = p.id)) as profils_orphelins;

-- 2. Les comptes SANS profil (ils n'apparaissaient jamais dans l'ancienne liste) :
select u.id, u.email, u.created_at, u.last_sign_in_at
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
order by u.created_at desc;

-- 3. MON rôle : mon compte a-t-il une ligne profiles avec role = 'admin' ? (is_admin() lit exactement ça)
select u.id, u.email, p.username, p.role, (p.role = 'admin') as is_admin_attendu
from auth.users u
left join public.profiles p on p.id = u.id
where u.email = 'ton-email@exemple.com';

-- 4. Type réel de auth.users.email (cause de l'échec de 0042 si 'character varying') :
select data_type, character_maximum_length
from information_schema.columns
where table_schema = 'auth' and table_name = 'users' and column_name = 'email';

-- 5. La fonction existe-t-elle, avec quelle signature, quelle colonne finale ? (après 0051 : 11 colonnes,
--    la dernière est profile_missing)
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as resultat,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('admin_list_users', 'admin_export_users', 'admin_repair_profile', 'is_admin')
order by p.proname;

-- 6. Droits d'exécution (authenticated doit pouvoir exécuter, anon non) :
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('anon', p.oid, 'execute') as anon
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('admin_list_users', 'admin_export_users', 'admin_repair_profile', 'is_admin');

-- 7. Test réel de la fonction EN TANT QUE TOI (remplace l'e-mail) : doit renvoyer des lignes. Si elle lève
--    « structure of query does not match function result type », la migration 0051 n'est pas appliquée.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'ton-email@exemple.com'), 'role', 'authenticated')::text,
  true
);
select id, email, username, status, profile_missing, total_count
from public.admin_list_users(20, 0, null, 'created_at_desc');
rollback;

-- 8. La colonne utilisée pour « dernière activité » existe-t-elle ? (migration 0040)
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name in ('last_active_at', 'suspended_until', 'banned_at');
