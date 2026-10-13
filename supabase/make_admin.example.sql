-- À exécuter manuellement dans l'éditeur SQL Supabase (jamais depuis l'application).
-- Remplace l'e-mail ci-dessous par celui de ton compte admin, puis exécute.
-- Fonctionne car l'éditeur SQL s'exécute en tant que postgres : auth.uid() y est NULL,
-- ce qui contourne le trigger prevent_role_self_escalation (voir migration 0002_profiles.sql).

update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'remplace-par-ton-email@exemple.com');

-- Vérification :
select id, username, role from public.profiles where role = 'admin';
