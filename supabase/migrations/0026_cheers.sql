-- Mode Amis (LOT F2) : encouragements (§2). Jeu fixe d'emojis, envoi entre amis
-- uniquement, avec quotas. Toute mutation passe par des fonctions SECURITY DEFINER
-- (même principe que friendships) : pas de politique INSERT/UPDATE pour le client, pour
-- que les quotas et la vérification d'amitié ne puissent jamais être contournés.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create table if not exists public.cheers (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (emoji in ('💪', '🔥', '👏', '❤️', '☕')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint cheers_no_self check (sender_id <> recipient_id)
);

create index if not exists cheers_recipient_unread_idx on public.cheers (recipient_id, read_at);
create index if not exists cheers_sender_recent_idx on public.cheers (sender_id, created_at);

alter table public.cheers enable row level security;

drop policy if exists "cheers_select_own" on public.cheers;
create policy "cheers_select_own" on public.cheers
  for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Pas de politique INSERT/UPDATE/DELETE : voir send_cheer()/mark_cheers_read() plus bas.

-- Envoie un encouragement à un ami. Quotas (§2) : 1 par destinataire toutes les 10
-- minutes, 30 par jour au total — tous deux vérifiés ici, jamais seulement côté
-- interface. Le destinataire n'est notifié ni en direct ni pendant qu'il est en focus
-- (voir useCheers côté client) : côté base, cette fonction se contente d'enregistrer la
-- ligne, le moment de l'affichage est une décision purement client.
create or replace function public.send_cheer(p_recipient_id uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  recent_to_recipient integer;
  daily_count integer;
begin
  if current_uid is null then
    raise exception 'send_cheer() doit être appelé par un utilisateur authentifié';
  end if;
  if public.is_banned(current_uid) then
    raise exception 'Action indisponible';
  end if;
  if p_recipient_id = current_uid then
    raise exception 'Impossible de s’encourager soi-même';
  end if;
  if p_emoji not in ('💪', '🔥', '👏', '❤️', '☕') then
    raise exception 'Emoji non autorisé';
  end if;
  if not public.are_friends(current_uid, p_recipient_id) then
    raise exception 'Vous devez être amis pour envoyer un encouragement';
  end if;

  select count(*) into recent_to_recipient
  from public.cheers
  where sender_id = current_uid and recipient_id = p_recipient_id
    and created_at >= now() - interval '10 minutes';
  if recent_to_recipient > 0 then
    raise exception 'Attends un peu avant de ré-encourager cette personne';
  end if;

  select count(*) into daily_count
  from public.cheers
  where sender_id = current_uid and created_at >= now() - interval '1 day';
  if daily_count >= 30 then
    raise exception 'Trop d’encouragements envoyés aujourd’hui (limite : 30). Réessaie demain.';
  end if;

  insert into public.cheers (sender_id, recipient_id, emoji)
  values (current_uid, p_recipient_id, p_emoji);
end;
$$;

-- Encouragements non lus reçus par l'appelant, avec l'identité (restreinte) de qui les a
-- envoyés — même approche à champs restreints que find_profile_preview() (migration 0022).
create or replace function public.list_unread_cheers()
returns table (
  id uuid,
  emoji text,
  created_at timestamptz,
  sender_id uuid,
  sender_username text,
  sender_display_name text,
  sender_avatar_url text,
  sender_avatar_version integer
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.emoji, c.created_at, p.id, p.username, p.display_name, p.avatar_url, p.avatar_version
  from public.cheers c
  join public.profiles p on p.id = c.sender_id
  where c.recipient_id = auth.uid() and c.read_at is null
  order by c.created_at asc;
$$;

-- Marque tous les encouragements non lus de l'appelant comme lus (affichés en bandeau
-- d'un coup, voir CheersBanner côté client — pas de marquage un par un).
create or replace function public.mark_cheers_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
begin
  if current_uid is null then
    raise exception 'mark_cheers_read() doit être appelé par un utilisateur authentifié';
  end if;

  update public.cheers set read_at = now() where recipient_id = current_uid and read_at is null;
end;
$$;

grant select on public.cheers to authenticated;
grant execute on function public.send_cheer(uuid, text) to authenticated;
grant execute on function public.list_unread_cheers() to authenticated;
grant execute on function public.mark_cheers_read() to authenticated;
revoke all on public.cheers from anon;
revoke execute on function public.send_cheer(uuid, text) from anon;
revoke execute on function public.list_unread_cheers() from anon;
revoke execute on function public.mark_cheers_read() from anon;

notify pgrst, 'reload schema';
