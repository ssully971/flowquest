-- Panneau Admin refait (lot I2, §3) : journal filtrable. admin_log.admin_id référence
-- auth.users, pas public.profiles — aucune politique RLS n'autorise un admin à lire le
-- profil d'un AUTRE utilisateur (profiles_select_own se limite à auth.uid() = id), donc
-- un simple select() + jointure côté client ne peut pas résoudre le pseudo de l'auteur
-- de chaque ligne. Cette RPC le fait côté serveur, en SECURITY DEFINER, réservée aux
-- admins comme le reste du panneau. Idempotente : peut être recollée sans erreur dans
-- l'éditeur SQL Supabase.

create or replace function public.admin_list_log(p_limit integer default 100, p_search text default null)
returns table (
  id uuid,
  admin_id uuid,
  admin_username text,
  action text,
  target text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_list_log() réservé aux administrateurs';
  end if;

  return query
    select
      al.id,
      al.admin_id,
      pr.username as admin_username,
      al.action,
      al.target,
      al.created_at
    from public.admin_log al
    left join public.profiles pr on pr.id = al.admin_id
    where
      p_search is null
      or al.action ilike '%' || p_search || '%'
      or al.target ilike '%' || p_search || '%'
      or pr.username ilike '%' || p_search || '%'
    order by al.created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

grant execute on function public.admin_list_log(integer, text) to authenticated;
revoke execute on function public.admin_list_log(integer, text) from anon;

notify pgrst, 'reload schema';
