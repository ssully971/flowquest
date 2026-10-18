-- Citations affichées sur l'accueil (§12 : gérées depuis le panneau Admin). `src/features/home/quotes.ts`
-- garde son tableau statique en repli (invité hors-ligne, base vide) ; quand cette table contient des
-- lignes actives, elle devient la source de vérité pour les comptes connectés.
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 500),
  author text,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_quotes_updated_at on public.quotes;
create trigger set_quotes_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

alter table public.quotes enable row level security;

-- Lecture publique (connecté ou invité) des citations actives seulement : c'est le contenu
-- affiché sur l'accueil, pas une donnée personnelle.
drop policy if exists "quotes_select_active" on public.quotes;
create policy "quotes_select_active" on public.quotes
  for select
  using (active = true);

-- Les admins voient aussi les citations désactivées (nécessaire pour les gérer depuis le
-- panneau Admin) et sont seuls à pouvoir créer/modifier/supprimer.
drop policy if exists "quotes_select_admin" on public.quotes;
create policy "quotes_select_admin" on public.quotes
  for select
  using (public.is_admin());

drop policy if exists "quotes_insert_admin" on public.quotes;
create policy "quotes_insert_admin" on public.quotes
  for insert
  with check (public.is_admin());

drop policy if exists "quotes_update_admin" on public.quotes;
create policy "quotes_update_admin" on public.quotes
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "quotes_delete_admin" on public.quotes;
create policy "quotes_delete_admin" on public.quotes
  for delete
  using (public.is_admin());
