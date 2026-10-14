-- ============================================================
-- Explorateur de marchés v2 : cache persistant des données de marché calculées
-- (docs/specs/explorateur-marches-v2.md §7).
-- ============================================================
-- Résultats compacts (comptes consolidés, performances, valorisation…) partagés
-- par toutes les instances serverless, et dernière copie valide servie quand
-- une source est en panne. Aucune donnée utilisateur : la clé est un symbole.
-- Lu et écrit uniquement par le serveur avec la clé service_role.
-- Idempotent.

create table if not exists public.market_data_cache (
  key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create index if not exists market_data_cache_fetched_at_idx on public.market_data_cache (fetched_at);

alter table public.market_data_cache enable row level security;
-- Pas de politique : anon et authenticated n'y ont aucun accès.
revoke all on table public.market_data_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.market_data_cache to service_role;
