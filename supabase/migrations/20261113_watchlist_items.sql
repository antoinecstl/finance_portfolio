-- ============================================================
-- Explorateur de marchés : favoris (titres suivis)
-- (docs/specs/explorateur-marches.md, « watchlists persistées »).
-- ============================================================
-- Une ligne par (utilisateur, symbole). Chaque utilisateur ne voit et ne
-- modifie que ses lignes (RLS). Supprimées avec le compte (cascade).
-- 100 favoris au plus par utilisateur, vérifié aussi par la route
-- /api/market/watchlist. Idempotent.

create table if not exists public.watchlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (symbol ~ '^\^?[A-Z0-9.\-]{1,15}$'),
  -- Nom affiché au moment de l'ajout (« L'Oréal ») ; le cours du jour donne le nom à jour.
  name text check (name is null or char_length(name) <= 120),
  created_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

create index if not exists watchlist_items_user_created_idx
  on public.watchlist_items (user_id, created_at);

alter table public.watchlist_items enable row level security;

drop policy if exists "watchlist_items_select_own" on public.watchlist_items;
create policy "watchlist_items_select_own" on public.watchlist_items
  for select using (auth.uid() = user_id);

drop policy if exists "watchlist_items_insert_own" on public.watchlist_items;
create policy "watchlist_items_insert_own" on public.watchlist_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "watchlist_items_delete_own" on public.watchlist_items;
create policy "watchlist_items_delete_own" on public.watchlist_items
  for delete using (auth.uid() = user_id);

-- Pas de mise à jour : on retire puis on ajoute.
revoke all on table public.watchlist_items from anon;
grant select, insert, delete on table public.watchlist_items to authenticated;

-- Plafond de 100 favoris par utilisateur, pour les appels directs à l'API REST.
create or replace function public.watchlist_items_enforce_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.watchlist_items where user_id = new.user_id) >= 100 then
    raise exception 'watchlist_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists watchlist_items_limit on public.watchlist_items;
create trigger watchlist_items_limit
  before insert on public.watchlist_items
  for each row execute function public.watchlist_items_enforce_limit();
