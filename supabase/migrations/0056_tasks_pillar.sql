-- 0056 — Tâche rattachée à un pilier (optionnel)
--
-- `pillar_id` NULL = aucun pilier. Si le pilier est supprimé, la tâche est conservée et
-- simplement détachée (on delete set null). Un pilier archivé reste lié : il réapparaît tel
-- quel si on le désarchive. Idempotente : rejouable sans effet de bord.

alter table public.tasks
  add column if not exists pillar_id uuid references public.pillars (id) on delete set null;

create index if not exists tasks_pillar_id_idx on public.tasks (pillar_id);
