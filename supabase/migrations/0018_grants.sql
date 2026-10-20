-- Correctif : aucune migration précédente n'accordait de GRANT PostgreSQL aux rôles
-- authenticated/anon. RLS (déjà activée partout, vérifié table par table) filtre les
-- LIGNES qu'une requête peut voir, mais ne donne par elle-même aucun droit d'accéder à la
-- TABLE : sans GRANT explicite, Postgres refuse la requête avant même d'évaluer les
-- politiques RLS (« permission denied for table... », erreur 42501 observée en prod).
-- Supabase accorde habituellement ces GRANT lui-même quand les tables sont créées depuis
-- son tableau de bord ; comme ce projet gère son schéma à la main via des fichiers SQL,
-- ils doivent être écrits explicitement ici.
--
-- Convention à partir de maintenant : toute migration qui crée une table ou une fonction
-- inclut ses propres GRANT (table par table / fonction par fonction), comme 0003, 0009,
-- 0012 et 0013 le font déjà pour leurs fonctions. Cette migration corrige seulement les
-- tables créées avant que cette convention ne soit explicite.
--
-- RLS reste la vraie barrière de sécurité (voir docs/SECURITE.md) : les GRANT ci-dessous
-- n'élargissent jamais ce que RLS autorise déjà par politique, ils ne font que lever le
-- blocage au niveau table qui empêchait RLS d'être évaluée du tout.
-- Idempotent : peut être recollée sans erreur dans l'éditeur SQL Supabase (GRANT ne lève
-- jamais d'erreur à être rejoué).

grant usage on schema public to authenticated, anon;

-- Données personnelles : authenticated seulement (anon n'a aucun droit, RLS ne laisserait
-- de toute façon jamais passer une ligne pour un utilisateur non identifié sur ces tables).
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.focus_sessions to authenticated;
grant select, insert, update, delete on public.timer_state to authenticated;
grant select, insert, update, delete on public.notes to authenticated;

-- Support : n'importe qui (connecté ou invité) peut écrire un message ; seul un admin
-- authentifié peut les relire ou les marquer traités (RLS restreint déjà ça via is_admin()
-- — ce GRANT ne fait qu'autoriser la table, pas élargir qui peut lire quoi).
grant insert on public.support_messages to anon, authenticated;
grant select, update on public.support_messages to authenticated;

-- Contenu éditorial géré par le panneau Admin : lecture publique (connecté ou invité) des
-- lignes actives (RLS filtre), écriture réservée aux admins (RLS filtre aussi).
grant select on public.quotes to anon, authenticated;
grant insert, update, delete on public.quotes to authenticated;
grant select on public.changelog to anon, authenticated;
grant insert, update, delete on public.changelog to authenticated;

-- Journal d'audit admin : lecture et écriture réservées aux admins (RLS filtre).
grant select, insert on public.admin_log to authenticated;

-- Les fonctions déjà créées ont chacune leur propre GRANT EXECUTE (0003, 0009, 0012, 0013) ;
-- rien à ajouter ici, listé seulement pour mémoire lors d'une relecture de cette migration.

-- À partir de maintenant, toute table ou fonction créée par ce rôle (postgres, dans
-- l'éditeur SQL Supabase) hérite automatiquement des bons droits par défaut, même si une
-- migration future oublie son propre GRANT.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated, anon;
