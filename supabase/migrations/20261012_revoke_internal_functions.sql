-- ============================================================
-- Audit de sécurité (octobre 2026) : fonctions internes non appelables via l'API.
-- ============================================================
-- assert_account_sequence_valid(p_user_id, p_account_id) est SECURITY DEFINER et
-- accepte n'importe quel user_id. Sur Supabase, les fonctions du schéma public
-- sont exécutables par anon et authenticated par défaut : n'importe qui pouvait
-- l'appeler en RPC et, sur un historique incohérent, lire dans le message
-- d'erreur un symbole et une date du compte d'un autre utilisateur.
--
-- Elle n'est appelée que par des fonctions/déclencheurs SECURITY DEFINER
-- (validate_transaction_account_sequence, insert/update_transaction_*), qui
-- s'exécutent avec les droits de leur propriétaire : retirer le droit
-- d'exécution aux rôles de l'API ne change rien pour eux.
-- Idempotent.

revoke execute on function public.assert_account_sequence_valid(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assert_account_sequence_valid(uuid, uuid) to service_role;
