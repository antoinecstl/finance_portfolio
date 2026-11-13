-- Audit de novembre 2026 : droits d'exécution des fonctions et bornes de taille.
--
-- Constat (linter Supabase, base de production) : 13 fonctions SECURITY DEFINER
-- du schéma public étaient exécutables par le rôle `anon` (sans connexion) via
-- /rest/v1/rpc/*, car Postgres donne EXECUTE à PUBLIC par défaut. Aucune ne
-- laissait lire les données d'un autre utilisateur (elles vérifient auth.uid()),
-- mais rien ne justifie de les exposer.
--
-- Migration idempotente : peut être rejouée sans effet.

-- 1. Fonctions de déclencheur : jamais appelées par l'API. Un déclencheur
--    s'exécute sans que le rôle courant ait EXECUTE sur sa fonction (même
--    principe que enforce_position_capable_account, déjà restreinte).
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'trigger'::regtype
      -- Les fonctions fournies par une extension ne sont pas à nous.
      and not exists (
        select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
  end loop;
end;
$$;

-- 2. Fonctions appelées par l'application connectée : réservées au rôle
--    `authenticated` (et service_role). user_has_pro_access reste accessible
--    aux utilisateurs connectés car les politiques RLS d'import_jobs l'évaluent
--    avec leurs droits.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'insert_transaction_with_fee',
        'update_transaction_with_fee',
        'insert_transactions_batch',
        'delete_transaction',
        'user_has_pro_access'
      )
  loop
    execute format('revoke execute on function %s from public, anon', f.signature);
    execute format('grant execute on function %s to authenticated, service_role', f.signature);
  end loop;
end;
$$;

-- 3. search_path figé sur la dernière fonction qui ne l'avait pas
--    (lint « function_search_path_mutable »). Elle n'utilise que now().
alter function public.update_updated_at_column() set search_path = '';

-- 4. Bornes de taille sur les textes que le navigateur peut écrire directement
--    (RLS) : les limites n'existaient que dans les schémas Zod des routes.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_full_name_length') then
    alter table public.profiles
      add constraint profiles_full_name_length
      check (full_name is null or char_length(full_name) <= 120);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'transactions_description_length') then
    alter table public.transactions
      add constraint transactions_description_length
      check (description is null or char_length(description) <= 500);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'import_jobs_raw_excerpt_length') then
    alter table public.import_jobs
      add constraint import_jobs_raw_excerpt_length
      check (raw_excerpt is null or char_length(raw_excerpt) <= 20000);
  end if;
end;
$$;
