-- Extensions et fonctions utilitaires partagées par les migrations suivantes.
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create extension if not exists pgcrypto;

-- Trigger générique : met à jour updated_at à chaque modification de ligne.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
