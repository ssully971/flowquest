-- Vérification de disponibilité d'un pseudo en direct, pendant la saisie (LOT 1).
-- La politique RLS de profiles (auth.uid() = id) empêche un select direct de voir les
-- pseudos des autres comptes : cette fonction security definer est le seul moyen honnête
-- de répondre « déjà pris » sans élargir la lecture de la table elle-même.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where username = p_username
  );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;
