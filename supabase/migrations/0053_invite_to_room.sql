-- LOT 5 (Mode Amis) — inviter des participants APRÈS la création d'un salon. Idempotente : recollable
-- sans erreur dans l'éditeur SQL Supabase.
--
-- Avant : pour ajouter quelqu'un, il fallait quitter le salon et en recréer un. invite_to_room() ajoute
-- des invitations à un salon existant, réservé à l'HÔTE (un membre ne peut pas inviter ; pour l'ouvrir aux
-- membres, il suffit de remplacer le contrôle `host_id <> current_uid` ci-dessous). Même règles que
-- create_room (0049) :
--   - les invités doivent être des AMIS de l'hôte et ne pas être bannis / suspendus (is_banned) ;
--   - plafond de 6 personnes (hôte compris) : les places comptées sont celles des participants « joined »
--     ou « invited » ;
--   - salon non terminé uniquement.
-- IDEMPOTENTE : un ami déjà invité ou déjà dans le salon est ignoré (aucune erreur) ; un ami qui avait refusé
-- ou quitté peut être réinvité. Renvoie le nombre d'invitations réellement créées.
--
-- Un invité qui accepte (respond_room_invite, 0049) rejoint EN COURS de route : son arrivée est enregistrée
-- (phase_index_joined / elapsed_ms_at_join) et son horloge se calcule depuis started_at comme celle des autres.
-- Les invitations suivent le flux existant (Realtime sur room_participants → useRoomInvitesRealtime).

create or replace function public.invite_to_room(p_room_id uuid, p_friend_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  room_row public.rooms;
  occupied integer;
  new_ids uuid[] := array[]::uuid[];
  friend_id uuid;
  existing_status text;
begin
  if current_uid is null then
    raise exception 'invite_to_room() doit être appelé par un utilisateur authentifié';
  end if;
  if public.is_banned(current_uid) then
    raise exception 'Action indisponible';
  end if;
  if not public.is_feature_enabled('rooms') then
    raise exception 'Les salons de focus sont temporairement indisponibles';
  end if;

  -- Entretien du salon s'il est dû (fin de phase, hôte absent…), puis verrou le temps de l'action.
  if public._room_tick_due(p_room_id) then
    perform public._room_tick(p_room_id);
  end if;
  select * into room_row from public.rooms where id = p_room_id for update;
  if room_row.id is null or room_row.host_id <> current_uid then
    raise exception 'Seul l’hôte peut inviter dans le salon';
  end if;
  if room_row.status = 'ended' then
    raise exception 'Ce salon est terminé';
  end if;

  select count(*) into occupied
  from public.room_participants
  where room_id = p_room_id and status in ('joined', 'invited');

  foreach friend_id in array coalesce(p_friend_ids, array[]::uuid[])
  loop
    if friend_id = current_uid or friend_id = any(new_ids) then
      continue;
    end if;
    if not public.are_friends(current_uid, friend_id) or public.is_banned(friend_id) then
      continue;
    end if;
    select status into existing_status
    from public.room_participants
    where room_id = p_room_id and user_id = friend_id;
    -- Déjà invité ou déjà dans le salon : ignoré (idempotent).
    if existing_status in ('invited', 'joined') then
      continue;
    end if;
    new_ids := new_ids || friend_id;
  end loop;

  if coalesce(array_length(new_ids, 1), 0) = 0 then
    return 0;
  end if;
  if occupied + array_length(new_ids, 1) > 6 then
    raise exception 'Un salon réunit au plus 6 personnes (toi compris)';
  end if;

  foreach friend_id in array new_ids
  loop
    insert into public.room_participants (room_id, user_id, role, status)
    values (p_room_id, friend_id, 'member', 'invited')
    on conflict (room_id, user_id) do update
      set status = 'invited', role = 'member', left_at = null;
  end loop;

  return array_length(new_ids, 1);
end;
$$;

revoke all on function public.invite_to_room(uuid, uuid[]) from public, anon;
grant execute on function public.invite_to_room(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
