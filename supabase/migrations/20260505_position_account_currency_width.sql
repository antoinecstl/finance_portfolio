-- Crypto/stablecoin currency codes such as USDC/USDT are valid in the app.
-- `transactions.currency` was already widened, but denormalized positions copy
-- the BUY transaction currency during rebuild_stock_position(). Keeping
-- stock_positions.currency at varchar(3) makes crypto imports fail with 22001.

alter table public.accounts
  alter column currency type varchar(10);

alter table public.stock_positions
  alter column currency type varchar(10);

update public.accounts
   set currency = upper(nullif(trim(currency), ''))
 where currency is not null;

update public.stock_positions
   set currency = upper(nullif(trim(currency), ''))
 where currency is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accounts_currency_format'
  ) then
    alter table public.accounts
      add constraint accounts_currency_format
      check (currency is null or currency ~ '^[A-Z]{3,10}$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'stock_positions_currency_format'
  ) then
    alter table public.stock_positions
      add constraint stock_positions_currency_format
      check (currency is null or currency ~ '^[A-Z]{3,10}$') not valid;
  end if;
end $$;
