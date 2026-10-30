-- 0054 — Gels de série (streak freeze)
--
-- Règles (identiques à src/features/stats/streak-freezes.ts, qui sert aux invités) :
--  * un jour est « validé » quand le focus du jour LOCAL atteint l'objectif quotidien
--    (définition inchangée) ;
--  * on gagne 1 gel par tranche de 10 h de focus cumulées (focus_sessions.actual_seconds,
--    donc le temps déjà plafonné par le garde-fou 4 h de la migration 0052) ;
--  * le stock est plafonné à 3 : au-delà, le temps cumulé continue de compter mais ne
--    donne rien ;
--  * un jour manqué alors que la série est vivante consomme 1 gel s'il en reste (un gel =
--    un jour, jamais plus) ; sinon la série retombe ;
--  * pas de rétroactivité : à la première synchronisation, le stock part de
--    min(3, floor(focus avant aujourd'hui / 10 h)) et aucun jour passé n'est couvert ;
--  * aujourd'hui n'est jamais compté comme manqué (la journée n'est pas finie).
--
-- La RPC sync_streak_freezes rejoue les jours écoulés depuis le dernier jour traité. Elle
-- est idempotente (état persisté + verrou de ligne + insertion « on conflict do nothing »)
-- et sûre en multi-appareils : deux appels simultanés se sérialisent sur le verrou.
-- Les séries à deux et le classement ne lisent pas ces tables : les gels ne comptent que
-- pour la série personnelle.
-- Idempotente : rejouable sans effet de bord.

create table if not exists public.streak_freeze_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  processed_through date not null,
  stock integer not null default 0 check (stock between 0 and 3),
  accounted_seconds bigint not null default 0 check (accounted_seconds >= 0),
  alive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.streak_freeze_uses (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  used_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.streak_freeze_state enable row level security;
alter table public.streak_freeze_uses enable row level security;

drop policy if exists "streak_freeze_state_select_own" on public.streak_freeze_state;
create policy "streak_freeze_state_select_own" on public.streak_freeze_state
  for select using (auth.uid() = user_id);

drop policy if exists "streak_freeze_uses_select_own" on public.streak_freeze_uses;
create policy "streak_freeze_uses_select_own" on public.streak_freeze_uses
  for select using (auth.uid() = user_id);

-- Pas de policy d'écriture : seules les fonctions security definer écrivent.

create or replace function public.sync_streak_freezes(p_goal_minutes integer default 120)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_goal integer := greatest(1, least(coalesce(p_goal_minutes, 120), 1440)) * 60;
  v_state public.streak_freeze_state%rowtype;
  v_day date;
  v_secs bigint;
  v_prev_total bigint;
  v_acc bigint;
  v_stock integer;
  v_alive boolean;
  v_through date;
  v_used jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;
  v_tz := coalesce(v_tz, 'UTC');
  if not exists (select 1 from pg_timezone_names where name = v_tz) then
    v_tz := 'UTC';
  end if;
  v_today := (now() at time zone v_tz)::date;

  -- Initialisation (une seule fois par compte), sans rétroactivité.
  if not exists (select 1 from public.streak_freeze_state where user_id = v_uid) then
    select coalesce(sum(actual_seconds), 0) into v_acc
      from public.focus_sessions
     where user_id = v_uid and kind = 'focus'
       and (started_at at time zone v_tz)::date < v_today;
    select coalesce(sum(actual_seconds), 0) into v_secs
      from public.focus_sessions
     where user_id = v_uid and kind = 'focus'
       and (started_at at time zone v_tz)::date = v_today - 1;
    insert into public.streak_freeze_state (user_id, processed_through, stock, accounted_seconds, alive)
    values (v_uid, v_today - 1, least(3, (v_acc / 36000)::integer), v_acc, v_secs >= v_goal)
    on conflict (user_id) do nothing;
  end if;

  select * into v_state from public.streak_freeze_state where user_id = v_uid for update;

  v_acc := v_state.accounted_seconds;
  v_stock := v_state.stock;
  v_alive := v_state.alive;
  v_through := v_state.processed_through;

  for v_day in
    select d::date from generate_series(v_through + 1, v_today - 1, interval '1 day') as d
  loop
    select coalesce(sum(actual_seconds), 0) into v_secs
      from public.focus_sessions
     where user_id = v_uid and kind = 'focus'
       and (started_at at time zone v_tz)::date = v_day;

    v_prev_total := v_acc;
    v_acc := v_acc + v_secs;
    -- Gains du jour d'abord : un gel gagné ce jour-là peut déjà couvrir ce jour.
    v_stock := least(3, v_stock + (v_acc / 36000 - v_prev_total / 36000)::integer);

    if v_secs >= v_goal then
      v_alive := true;
    elsif v_alive then
      if v_stock > 0 then
        v_stock := v_stock - 1;
        insert into public.streak_freeze_uses (user_id, day) values (v_uid, v_day)
        on conflict do nothing;
      else
        v_alive := false;
      end if;
    end if;
    v_through := v_day;
  end loop;

  update public.streak_freeze_state
     set processed_through = v_through, stock = v_stock, accounted_seconds = v_acc,
         alive = v_alive, updated_at = now()
   where user_id = v_uid;

  select coalesce(jsonb_agg(day order by day), '[]'::jsonb) into v_used
    from public.streak_freeze_uses where user_id = v_uid;

  return jsonb_build_object(
    'stock', v_stock,
    'accounted_seconds', v_acc,
    'alive', v_alive,
    'processed_through', v_through,
    'today', v_today,
    'used_days', v_used
  );
end;
$$;

revoke all on function public.sync_streak_freezes(integer) from public, anon;
grant execute on function public.sync_streak_freezes(integer) to authenticated;
