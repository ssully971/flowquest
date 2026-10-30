-- 0055 — Archivage des tâches
--
-- Une tâche archivée n'apparaît plus dans la liste active mais n'est pas supprimée : elle
-- reste restaurable (et continue de compter dans les statistiques de tâches terminées).
-- `archived_at` NULL = tâche active. Idempotente : rejouable sans effet de bord.

alter table public.tasks add column if not exists archived_at timestamptz;

comment on column public.tasks.archived_at is
  'Date d''archivage (NULL = tâche active). Les sous-tâches sont archivées avec leur parent.';
