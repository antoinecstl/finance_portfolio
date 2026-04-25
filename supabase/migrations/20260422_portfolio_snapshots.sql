-- Snapshots journaliers du portefeuille : évite de recalculer toute l'historique
-- (transactions + quotes Yahoo) à chaque chargement.
--
-- Stratégie :
--  - une ligne par (user_id, date)
--  - total_value = valeur globale du portefeuille (actions + cash + épargne)
--  - breakdown jsonb = { stocksValue, cashValue, savingsValue, positions: [...] }
--  - upsert journalier déclenché côté app (hook usePortfolioHistory après calcul).
--
-- Le calculator reste autoritaire : les snapshots sont un cache idempotent,
-- supprimables sans perte de données (on recalcule toujours à partir des transactions).

create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  total_value numeric(15, 2) not null,
  stocks_value numeric(15, 2) not null default 0,
  savings_value numeric(15, 2) not null default 0,
  breakdown jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_portfolio_snapshots_user_date
  on public.portfolio_snapshots(user_id, date desc);

alter table public.portfolio_snapshots enable row level security;

drop policy if exists "users read own snapshots" on public.portfolio_snapshots;
create policy "users read own snapshots" on public.portfolio_snapshots
  for select using (auth.uid() = user_id);

drop policy if exists "users insert own snapshots" on public.portfolio_snapshots;
create policy "users insert own snapshots" on public.portfolio_snapshots
  for insert with check (auth.uid() = user_id);

drop policy if exists "users update own snapshots" on public.portfolio_snapshots;
create policy "users update own snapshots" on public.portfolio_snapshots
  for update using (auth.uid() = user_id);

drop policy if exists "users delete own snapshots" on public.portfolio_snapshots;
create policy "users delete own snapshots" on public.portfolio_snapshots
  for delete using (auth.uid() = user_id);

drop trigger if exists update_portfolio_snapshots_updated_at on public.portfolio_snapshots;
create trigger update_portfolio_snapshots_updated_at
  before update on public.portfolio_snapshots
  for each row execute function public.update_updated_at_column();

-- Invalidation : dès qu'une transaction est ajoutée/modifiée/supprimée,
-- on invalide tous les snapshots ≥ date de la transaction.
-- Le cache sera repeuplé naturellement au prochain chargement du dashboard.
create or replace function public.invalidate_portfolio_snapshots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_date date;
begin
  if tg_op = 'DELETE' then
    v_user := (old).user_id;
    v_date := (old).date;
  else
    v_user := (new).user_id;
    v_date := (new).date;
    if tg_op = 'UPDATE' and (old).date < v_date then
      v_date := (old).date;
    end if;
  end if;

  delete from public.portfolio_snapshots
  where user_id = v_user and date >= v_date;

  return coalesce(new, old);
end;
$$;

drop trigger if exists invalidate_snapshots_on_tx on public.transactions;
create trigger invalidate_snapshots_on_tx
  after insert or update or delete on public.transactions
  for each row execute function public.invalidate_portfolio_snapshots();
