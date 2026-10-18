-- Complète 0011_support_messages.sql : à sa création, la table n'avait qu'une politique
-- d'insertion (personne ne pouvait relire les messages, pas même l'admin, en l'absence de
-- panneau Admin). Celui-ci arrivant (§12 : « Messages du support — lecture, statut
-- traité/non traité »), l'admin a besoin de lire les messages et de les marquer traités.
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase.

drop policy if exists "support_messages_select_admin" on public.support_messages;
create policy "support_messages_select_admin" on public.support_messages
  for select
  using (public.is_admin());

-- Seul le statut peut changer depuis le client admin (pas le texte du message lui-même,
-- qui reste tel qu'envoyé par la personne).
drop policy if exists "support_messages_update_admin" on public.support_messages;
create policy "support_messages_update_admin" on public.support_messages
  for update
  using (public.is_admin())
  with check (public.is_admin());
