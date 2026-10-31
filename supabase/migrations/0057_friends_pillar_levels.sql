-- 0057 — Niveau de pilier le plus haut de mes amis (titres et badges)
--
-- Les titres de pilier (Novice, Initié, Apprenti…) et leur badge s'affichent sur la liste
-- d'amis et le classement. Seul le NIVEAU le plus élevé parmi les piliers non archivés est
-- exposé : jamais le nom, la couleur ni le détail des piliers (un nom de pilier peut être
-- personnel). Renvoie soi-même et les amis acceptés non bannis. Les niveaux viennent de
-- pillars.level, déjà recomposé côté serveur depuis focus_sessions (migration 0034).
-- Idempotente : rejouable sans effet de bord.

create or replace function public.friends_pillar_levels()
returns table (user_id uuid, top_level integer)
language sql
stable
security definer
set search_path = public
as $$
  select pl.user_id, max(pl.level)::integer as top_level
    from public.pillars pl
   where pl.archived_at is null
     and not public.is_banned(pl.user_id)
     and (
       pl.user_id = auth.uid()
       or exists (
         select 1
           from public.friendships f
          where f.status = 'accepted'
            and ((f.requester_id = auth.uid() and f.addressee_id = pl.user_id)
              or (f.addressee_id = auth.uid() and f.requester_id = pl.user_id))
       )
     )
   group by pl.user_id;
$$;

revoke all on function public.friends_pillar_levels() from public, anon;
grant execute on function public.friends_pillar_levels() to authenticated;

notify pgrst, 'reload schema';
