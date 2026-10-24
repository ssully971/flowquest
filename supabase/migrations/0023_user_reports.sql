-- Signalement d'un utilisateur (Mode Amis, LOT F1) : réutilise support_messages plutôt
-- qu'une nouvelle table (demandé explicitement), avec deux colonnes en plus pour que
-- l'admin distingue un signalement d'un message de contact classique et sache qui est visé.
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

alter table public.support_messages
  add column if not exists category text not null default 'contact' check (category in ('contact', 'report')),
  add column if not exists reported_user_id uuid references auth.users (id) on delete set null;

create index if not exists support_messages_reported_user_idx
  on public.support_messages (reported_user_id)
  where reported_user_id is not null;

-- L'e-mail est rempli automatiquement depuis le compte connecté (jamais saisi à la main
-- pour un signalement, contrairement au formulaire de contact invité de 0011) ; le texte
-- reste court (même contrainte de longueur que body). Léger quota pour éviter le spam de
-- la file admin sans pénaliser un signalement légitime.
create or replace function public.report_user(p_target_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  current_email text;
  daily_count integer;
begin
  if current_uid is null then
    raise exception 'report_user() doit être appelé par un utilisateur authentifié';
  end if;
  if public.is_banned(current_uid) then
    raise exception 'Action indisponible';
  end if;
  if p_target_user_id = current_uid then
    raise exception 'Impossible de se signaler soi-même';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Le signalement ne peut pas être vide';
  end if;

  select count(*) into daily_count
  from public.support_messages
  where user_id = current_uid and category = 'report' and created_at >= now() - interval '1 day';
  if daily_count >= 10 then
    raise exception 'Trop de signalements envoyés aujourd’hui. Réessaie demain.';
  end if;

  select email into current_email from auth.users where id = current_uid;

  insert into public.support_messages (user_id, email, body, category, reported_user_id)
  values (current_uid, coalesce(current_email, 'inconnu@flowquest.app'), left(trim(p_reason), 2000), 'report', p_target_user_id);
end;
$$;

grant execute on function public.report_user(uuid, text) to authenticated;
revoke execute on function public.report_user(uuid, text) from anon;

notify pgrst, 'reload schema';
