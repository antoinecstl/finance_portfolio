-- Audit de novembre 2026 : performance de la base.
--
-- 1. Index manquants. Toutes les lectures filtrent par user_id, or ni
--    `accounts` ni `transactions` n'avaient d'index dessus en production (ceux
--    de schema.sql n'y existaient pas). Sans effet visible à quelques centaines
--    de lignes, bloquant à quelques centaines de milliers.
-- 2. Politiques RLS : `auth.uid()` était réévalué pour chaque ligne lue. Écrit
--    `(select auth.uid())`, Postgres le calcule une fois par requête
--    (lint Supabase « auth_rls_initplan »). Les règles d'accès sont strictement
--    identiques. Les 3 politiques d'import_jobs sont exclues (voir plus bas).
--
-- Migration idempotente : peut être rejouée sans effet.

-- ---------------------------------------------------------------------------
-- 1. Index
-- ---------------------------------------------------------------------------
create index if not exists idx_accounts_user_id
  on public.accounts (user_id);

-- Ordre de la liste des transactions (GET /api/transactions) et de l'export.
create index if not exists idx_transactions_user_date
  on public.transactions (user_id, date desc, effective_time desc, id desc);

-- Clés étrangères sans index : suppressions en cascade et jointures.
create index if not exists idx_import_jobs_account_id
  on public.import_jobs (account_id);
create index if not exists idx_api_tokens_client_id
  on public.api_tokens (client_id);
create index if not exists idx_oauth_codes_client_id
  on public.oauth_authorization_codes (client_id);
create index if not exists idx_oauth_codes_user_id
  on public.oauth_authorization_codes (user_id);

-- Doublon de l'index de la contrainte unique subscriptions_paddle_subscription_id_key.
drop index if exists public.idx_subscriptions_paddle_sub_id;

-- ---------------------------------------------------------------------------
-- 2. Politiques RLS : auth.uid() évalué une fois par requête
-- ---------------------------------------------------------------------------

-- accounts
alter policy "Users can view own accounts" on public.accounts
  using ((select auth.uid()) = user_id);
alter policy "Users can insert own accounts" on public.accounts
  with check ((select auth.uid()) = user_id);
alter policy "Users can update own accounts" on public.accounts
  using ((select auth.uid()) = user_id);
alter policy "Users can delete own accounts" on public.accounts
  using ((select auth.uid()) = user_id);

-- transactions
alter policy "Users can view own transactions" on public.transactions
  using ((select auth.uid()) = user_id);
alter policy "Users can delete own transactions" on public.transactions
  using ((select auth.uid()) = user_id);
alter policy "Users can insert own transactions" on public.transactions
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.accounts a
      where a.id = transactions.account_id
        and a.user_id = (select auth.uid())
        and (
          transactions.type not in ('BUY', 'SELL', 'DIVIDEND')
          or public.account_supports_positions(a.type::text, a.supports_positions)
        )
    )
  );
alter policy "Users can update own transactions" on public.transactions
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.accounts a
      where a.id = transactions.account_id
        and a.user_id = (select auth.uid())
        and (
          transactions.type not in ('BUY', 'SELL', 'DIVIDEND')
          or public.account_supports_positions(a.type::text, a.supports_positions)
        )
    )
  );

-- profiles
alter policy "Users can view own profile" on public.profiles
  using ((select auth.uid()) = id);
alter policy "Users can insert own profile" on public.profiles
  with check ((select auth.uid()) = id and coalesce(is_founder, false) = false);
alter policy "Users can update own profile" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- subscriptions, api_tokens, audit_log (lecture seule)
alter policy "Users can view own subscription" on public.subscriptions
  using ((select auth.uid()) = user_id);
alter policy "Users can view own api tokens" on public.api_tokens
  using ((select auth.uid()) = user_id);
alter policy "users read own audit" on public.audit_log
  using ((select auth.uid()) = user_id);

-- portfolio_snapshots
alter policy "users read own snapshots" on public.portfolio_snapshots
  using ((select auth.uid()) = user_id);
alter policy "users insert own snapshots" on public.portfolio_snapshots
  with check ((select auth.uid()) = user_id);
alter policy "users update own snapshots" on public.portfolio_snapshots
  using ((select auth.uid()) = user_id);
alter policy "users delete own snapshots" on public.portfolio_snapshots
  using ((select auth.uid()) = user_id);

-- import_jobs : politiques laissées telles quelles, volontairement. La règle
-- d'insertion (premier import offert, 20261016) relit import_jobs dans une
-- sous-requête ; si la politique de lecture contient elle-même une sous-requête
-- `(select auth.uid())`, Postgres refuse toute écriture avec « infinite
-- recursion detected in policy ». La table reste petite (quelques lignes par
-- utilisateur) : le gain serait nul.

-- watchlist_items
alter policy "watchlist_items_select_own" on public.watchlist_items
  using ((select auth.uid()) = user_id);
alter policy "watchlist_items_insert_own" on public.watchlist_items
  with check ((select auth.uid()) = user_id);
alter policy "watchlist_items_delete_own" on public.watchlist_items
  using ((select auth.uid()) = user_id);
