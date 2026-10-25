-- LOT H1 : temps réel pour les demandes d'ami et les encouragements. `room_participants`
-- est déjà dans la publication supabase_realtime depuis la migration 0028 (invitations de
-- salon) — rien à ajouter pour cette table, seul le client en manquait un abonnement
-- filtré sur l'utilisateur courant (voir useRoomInvitesRealtime.ts).
--
-- RLS déjà en place et déjà vérifiée suffisante avant d'ajouter ces deux tables à la
-- publication (Realtime applique la politique SELECT de chaque table à chaque abonné,
-- exactement comme une requête normale — voir docs/SECURITE.md) :
--   - friendships (migration 0021) : « auth.uid() = requester_id or auth.uid() =
--     addressee_id » — un abonné ne reçoit que les lignes où il est l'une des deux
--     parties, jamais les demandes d'un tiers.
--   - cheers (migration 0026) : « auth.uid() = sender_id or auth.uid() = recipient_id » —
--     même principe.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships'
  ) then
    execute 'alter publication supabase_realtime add table public.friendships';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cheers'
  ) then
    execute 'alter publication supabase_realtime add table public.cheers';
  end if;
end;
$$;

notify pgrst, 'reload schema';
