-- Mode Amis (LOT F4) : passe de sécurité demandée par les règles transversales — relecture
-- de toutes les migrations 0001 à 0029 contre la check-list de docs/SECURITE.md (RLS
-- activée partout, chaque fonction SECURITY DEFINER a bien search_path fixé, chaque
-- fonction/table a un GRANT ou un REVOKE explicite, aucun compte banni ne doit apparaître
-- nulle part). Un seul écart trouvé, corrigé ici.
--
-- `generate_unique_username()` (migration 0009_ensure_profile.sql) est SECURITY DEFINER,
-- renvoie `text` (donc appelable directement, à la différence d'une fonction `trigger`
-- que Postgres refuse d'exécuter hors trigger) et n'avait ni GRANT ni REVOKE explicite —
-- PostgreSQL accorde EXECUTE à PUBLIC par défaut à la création d'une fonction, donc elle
-- était en réalité appelable par n'importe qui, y compris anon, sans qu'aucune migration
-- ne l'ait décidé consciemment. Risque réel limité (fonction pure, sans effet de bord,
-- ne renvoie qu'un nom candidat non utilisé — rien que is_username_available() n'expose
-- déjà volontairement), mais contraire à la convention du projet : jamais d'accès
-- implicite, toujours une décision explicite. Jamais appelée directement par le client
-- (vérifié : seulement depuis handle_new_user() et ensure_profile(), toutes deux
-- SECURITY DEFINER, donc cette révocation ne les empêche pas de fonctionner) — même
-- traitement que generate_friend_code() (déjà correct depuis la migration 0020).
-- Idempotente : peut être recollée sans erreur dans l'éditeur SQL Supabase.

revoke execute on function public.generate_unique_username(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
