-- Formulaire « Contacter le support » (§7.8 du cahier des charges) : le message est
-- enregistré en base, l'admin le lit et le marque traité, la réponse part par e-mail
-- (hors application). Pas de compte requis pour écrire au support (le mode invité reste
-- pleinement utilisable), donc user_id est nullable et l'e-mail est saisi par la personne.
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null check (char_length(email) between 3 and 320),
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending', 'processed')),
  created_at timestamptz not null default now()
);

alter table public.support_messages enable row level security;

-- N'importe qui peut écrire un message (connecté ou invité), personne ne peut relire les
-- messages (même les siens) : la lecture et le traitement passent par l'admin (SQL direct
-- ou futur panneau Admin), jamais par le client.
drop policy if exists "support_messages_insert_any" on public.support_messages;
create policy "support_messages_insert_any" on public.support_messages
  for insert
  with check (true);
