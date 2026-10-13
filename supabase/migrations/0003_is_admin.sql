-- Fonction utilisée dans les politiques RLS pour vérifier le rôle admin côté base,
-- jamais seulement côté interface. security definer pour éviter toute récursion RLS
-- quand elle est appelée depuis une politique sur la table profiles elle-même.
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'admin'
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated, anon;
