-- Objectifs de niveau par pilier (lot 4, §4) : niveau visé, éventuellement une date
-- limite. Colonnes dédiées sur public.pillars plutôt qu'une table séparée — un objectif
-- est en 1:1 avec son pilier (un seul objectif actif à la fois, jamais un historique),
-- une jointure supplémentaire n'apporterait rien ici.
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

alter table public.pillars
  add column if not exists goal_level integer check (goal_level is null or goal_level >= 1),
  add column if not exists goal_deadline timestamptz;

-- RLS propriétaire : déjà en place sur public.pillars depuis la migration 0034
-- (pillars_select_own / pillars_insert_own / pillars_update_own / pillars_delete_own,
-- toutes sur auth.uid() = user_id) — une ALTER TABLE n'ajoute pas de nouvelle policy,
-- les quatre existantes couvrent déjà goal_level/goal_deadline comme toute autre colonne
-- de la ligne. Revalidées ici explicitement (idempotent, sans effet si déjà identiques)
-- pour que cette migration documente elle-même la protection dont héritent ces deux
-- nouvelles colonnes, sans avoir à rouvrir 0034_pillars.sql pour le vérifier.
drop policy if exists "pillars_select_own" on public.pillars;
create policy "pillars_select_own" on public.pillars
  for select
  using (auth.uid() = user_id);

drop policy if exists "pillars_update_own" on public.pillars;
create policy "pillars_update_own" on public.pillars
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- GRANT explicite (déjà accordé par 0034_pillars.sql sur la table entière ; réaffirmé ici
-- pour la même raison — rendre cette migration autoportante) : select/insert/update/delete
-- pour authenticated, jamais pour anon (un objectif de niveau est une donnée privée).
grant select, insert, update, delete on public.pillars to authenticated;

notify pgrst, 'reload schema';
