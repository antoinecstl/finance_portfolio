-- Ajout du type de compte CRYPTO + cloisonnement strict actifs crypto vs actions/ETF.
-- Règles : un compte CRYPTO n'accepte que des cryptos (-USD/-USDT/-EUR/-GBP/-BTC/-ETH).
-- Tous les autres types existants (PEA, LIVRET_A, LDDS, CTO, ASSURANCE_VIE, PEL, AUTRE)
-- refusent les cryptos.

-- 1. Étend le CHECK sur accounts.type pour inclure CRYPTO.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'accounts_type_check'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts drop constraint accounts_type_check;
  end if;
end $$;

alter table public.accounts
  add constraint accounts_type_check
  check (type in ('PEA','LIVRET_A','LDDS','CTO','ASSURANCE_VIE','PEL','CRYPTO','AUTRE'));

-- 2. Étend account_supports_positions pour reconnaître CRYPTO comme éligible aux positions.
create or replace function public.account_supports_positions(
  p_type text,
  p_supports_positions boolean
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    p_supports_positions,
    p_type in ('PEA', 'CTO', 'ASSURANCE_VIE', 'CRYPTO')
  );
$$;

-- 3. Helper : symbole crypto = paire de quote standard Yahoo (-USD, -USDT, -EUR, -GBP, -BTC, -ETH).
create or replace function public.is_crypto_symbol(p_symbol text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_symbol ~* '-(USD|USDT|EUR|GBP|BTC|ETH)$', false);
$$;

grant execute on function public.is_crypto_symbol(text)
  to anon, authenticated, service_role;

-- 4. Helper : compatibilité actif <-> type de compte.
create or replace function public.account_type_allows_asset(
  p_type text,
  p_symbol text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_symbol is null or length(trim(p_symbol)) = 0 then true
    when p_type = 'CRYPTO' then public.is_crypto_symbol(p_symbol)
    else not public.is_crypto_symbol(p_symbol)
  end;
$$;

grant execute on function public.account_type_allows_asset(text, text)
  to anon, authenticated, service_role;

-- 5. Étend le trigger enforce_position_capable_account pour aussi rejeter les
-- combinaisons actif/compte incompatibles (defense in depth, l'API valide aussi).
create or replace function public.enforce_position_capable_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_supports_positions boolean;
begin
  if tg_table_name = 'stock_positions' then
    select a.type, public.account_supports_positions(a.type, a.supports_positions)
      into v_type, v_supports_positions
    from public.accounts a
    where a.id = new.account_id
      and a.user_id = new.user_id;

    if coalesce(v_supports_positions, false) = false then
      raise exception 'account_does_not_support_positions' using errcode = 'P0001';
    end if;

    if not public.account_type_allows_asset(v_type, new.symbol) then
      raise exception 'asset_account_mismatch' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'transactions' and new.type in ('BUY', 'SELL', 'DIVIDEND') then
    select a.type, public.account_supports_positions(a.type, a.supports_positions)
      into v_type, v_supports_positions
    from public.accounts a
    where a.id = new.account_id
      and a.user_id = new.user_id;

    if coalesce(v_supports_positions, false) = false then
      raise exception 'account_does_not_support_positions' using errcode = 'P0001';
    end if;

    if not public.account_type_allows_asset(v_type, new.stock_symbol) then
      raise exception 'asset_account_mismatch' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- 6. Étend le RPC insert_transaction_with_fee pour rejeter les actifs incompatibles.
create or replace function public.insert_transaction_with_fee(
  p_account_id uuid,
  p_type text,
  p_amount numeric,
  p_description text,
  p_date date,
  p_stock_symbol text,
  p_quantity numeric,
  p_price_per_unit numeric,
  p_fees numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_fee_id uuid := null;
  v_tx_id uuid;
  v_tx record;
  v_account record;
  v_fee_description text;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;

  if p_type not in ('DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE') then
    raise exception 'invalid_type' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;

  if p_type in ('BUY', 'SELL') and (
    p_stock_symbol is null
    or length(trim(p_stock_symbol)) = 0
    or p_quantity is null
    or p_quantity <= 0
    or p_price_per_unit is null
    or p_price_per_unit <= 0
  ) then
    raise exception 'invalid_stock_transaction' using errcode = 'P0001';
  end if;

  if p_type = 'DIVIDEND' and (p_stock_symbol is null or length(trim(p_stock_symbol)) = 0) then
    raise exception 'invalid_dividend_transaction' using errcode = 'P0001';
  end if;

  select id, type, supports_positions
    into v_account
  from public.accounts
  where id = p_account_id
    and user_id = v_user;

  if not found then
    raise exception 'invalid_account' using errcode = 'P0001';
  end if;

  if p_type in ('BUY', 'SELL', 'DIVIDEND')
     and not public.account_supports_positions(v_account.type, v_account.supports_positions)
  then
    raise exception 'account_does_not_support_positions' using errcode = 'P0001';
  end if;

  if p_type in ('BUY', 'SELL', 'DIVIDEND')
     and not public.account_type_allows_asset(v_account.type, p_stock_symbol)
  then
    raise exception 'asset_account_mismatch' using errcode = 'P0001';
  end if;

  if p_type <> 'FEE' and p_fees is not null and p_fees > 0 then
    v_fee_description := case
      when p_stock_symbol is not null and length(trim(p_stock_symbol)) > 0
        then 'Frais ' || p_type || ' ' || upper(p_stock_symbol)
      else 'Frais ' || p_type
    end;

    insert into public.transactions (
      user_id, account_id, type, amount, description, date,
      stock_symbol, quantity, price_per_unit
    ) values (
      v_user, p_account_id, 'FEE', p_fees, v_fee_description, p_date,
      null, null, null
    )
    returning id into v_fee_id;
  end if;

  insert into public.transactions (
    user_id, account_id, type, amount, fee_transaction_id, description, date,
    stock_symbol, quantity, price_per_unit
  ) values (
    v_user, p_account_id, p_type, p_amount, v_fee_id,
    coalesce(p_description, ''), p_date,
    case when p_stock_symbol is null then null else upper(trim(p_stock_symbol)) end,
    p_quantity,
    p_price_per_unit
  )
  returning id into v_tx_id;

  if p_type in ('BUY', 'SELL') and p_stock_symbol is not null and length(trim(p_stock_symbol)) > 0 then
    perform public.rebuild_stock_position(v_user, p_account_id, p_stock_symbol);
  end if;

  select * into v_tx from public.transactions where id = v_tx_id;
  return to_jsonb(v_tx);
end;
$$;

grant execute on function public.insert_transaction_with_fee(
  uuid, text, numeric, text, date, text, numeric, numeric, numeric
) to authenticated;
