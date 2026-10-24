-- Mode Amis (LOT F4, finitions) : create_room() acceptait une liste d'amis invités vide,
-- ce qui permettait de créer un salon sans personne pour « focus ensemble » — repéré lors
-- de la relecture des écrans (CreateRoomForm désactive déjà le bouton tant qu'aucun ami
-- n'est coché, mais la vraie barrière doit être ici, pas seulement côté interface). Les
-- amis valides sont maintenant validés et dédupliqués AVANT toute écriture (room créée
-- seulement si l'invitation va réellement aboutir), plutôt qu'en cours de boucle comme
-- dans la version précédente (migration 0029) qui pouvait laisser un salon orphelin si
-- `p_friend_ids` ne contenait, au final, aucun ami valide.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

create or replace function public.create_room(p_focus_minutes integer, p_friend_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  new_room_id uuid;
  friend_id uuid;
  valid_friend_ids uuid[] := array[]::uuid[];
begin
  if current_uid is null then
    raise exception 'create_room() doit être appelé par un utilisateur authentifié';
  end if;
  if public.is_banned(current_uid) then
    raise exception 'Action indisponible';
  end if;
  if p_focus_minutes is null or p_focus_minutes < 5 or p_focus_minutes > 120 then
    raise exception 'La durée doit être comprise entre 5 et 120 minutes';
  end if;

  foreach friend_id in array coalesce(p_friend_ids, array[]::uuid[])
  loop
    if friend_id = current_uid or friend_id = any(valid_friend_ids) then
      continue;
    end if;
    if not public.are_friends(current_uid, friend_id) then
      continue;
    end if;
    valid_friend_ids := valid_friend_ids || friend_id;
  end loop;

  if array_length(valid_friend_ids, 1) is null then
    raise exception 'Invite au moins un ami pour créer un salon';
  end if;
  if array_length(valid_friend_ids, 1) > 5 then
    raise exception 'Un salon réunit au plus 6 personnes (toi compris)';
  end if;

  insert into public.rooms (host_id, focus_minutes) values (current_uid, p_focus_minutes)
  returning id into new_room_id;

  insert into public.room_participants (room_id, user_id, role, status, joined_at, last_seen_at)
  values (new_room_id, current_uid, 'host', 'joined', now(), now());

  foreach friend_id in array valid_friend_ids
  loop
    insert into public.room_participants (room_id, user_id, role, status)
    values (new_room_id, friend_id, 'member', 'invited');
  end loop;

  return new_room_id;
end;
$$;

grant execute on function public.create_room(integer, uuid[]) to authenticated;
revoke execute on function public.create_room(integer, uuid[]) from anon;

notify pgrst, 'reload schema';
