-- Optional explicit time for same-day transaction ordering.
--
-- Until now, same-day order was determined by a fixed type priority (cash inflows
-- before conversions before cash outflows) with created_at and id as tiebreakers.
-- This left users no way to express "this BUY happened before that other BUY on
-- the same day", which was visible on PRU and cash replay.
--
-- This migration adds an optional user-set "time" column. To unify timed and
-- untimed transactions in a single ORDER BY, a stored generated column
-- effective_time computes time when set, otherwise a synthetic time derived
-- from the original type priority (0 -> 06:00, 1 -> 12:00, 2 -> 18:00, 3 -> 23:00).
-- Untimed rows therefore keep their exact prior order; rows with explicit time
-- override the priority within their day.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column if not exists "time" time;

alter table public.transactions
  add column if not exists effective_time time
  generated always as (
    coalesce(
      "time",
      case
        when type in ('DEPOSIT', 'DIVIDEND', 'INTEREST', 'SELL') then '06:00:00'::time
        when type = 'CONVERSION' then '12:00:00'::time
        when type in ('WITHDRAWAL', 'BUY', 'FEE') then '18:00:00'::time
        else '23:00:00'::time
      end
    )
  ) stored;

create index if not exists transactions_account_date_etime_idx
  on public.transactions (account_id, date, effective_time, id);

-- ---------------------------------------------------------------------------
-- 2. Account sequence validation : ORDER BY now uses effective_time.
-- ---------------------------------------------------------------------------
create or replace function public.assert_account_sequence_valid(
  p_user_id uuid,
  p_account_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cash jsonb := '{}'::jsonb;
  v_shares jsonb := '{}'::jsonb;
  v_symbol text;
  v_currency text;
  v_target text;
  v_current numeric;
  v_next numeric;
  tx record;
begin
  for tx in
    select id, type, amount, coalesce(currency, 'EUR') as currency,
           target_amount, target_currency,
           stock_symbol, quantity, date, created_at, effective_time
    from public.transactions
    where user_id = p_user_id
      and account_id = p_account_id
    order by date asc,
      effective_time asc,
      created_at asc,
      id asc
  loop
    if tx.stock_symbol is not null and tx.type in ('BUY', 'SELL') then
      v_symbol := upper(tx.stock_symbol);
      v_current := coalesce((v_shares ->> v_symbol)::numeric, 0);
      v_next := v_current + case
        when tx.type = 'BUY' then coalesce(tx.quantity, 0)
        when tx.type = 'SELL' then -coalesce(tx.quantity, 0)
        else 0
      end;

      if v_next < -0.005 then
        raise exception 'INVALID_ACCOUNT_SEQUENCE: shares_negative % at %', v_symbol, tx.date
          using errcode = 'P0001';
      end if;

      v_shares := jsonb_set(v_shares, array[v_symbol], to_jsonb(v_next), true);
    end if;

    v_currency := tx.currency;
    v_current := coalesce((v_cash ->> v_currency)::numeric, 0);

    v_next := v_current + case
      when tx.type in ('DEPOSIT', 'DIVIDEND', 'INTEREST', 'SELL') then tx.amount
      when tx.type in ('WITHDRAWAL', 'BUY', 'FEE', 'CONVERSION') then -tx.amount
      else 0
    end;

    if v_next < -0.005 then
      raise exception 'INVALID_ACCOUNT_SEQUENCE: cash_negative_% at %', v_currency, tx.date
        using errcode = 'P0001';
    end if;

    v_cash := jsonb_set(v_cash, array[v_currency], to_jsonb(v_next), true);

    if tx.type = 'CONVERSION' and tx.target_currency is not null then
      v_target := tx.target_currency;
      v_current := coalesce((v_cash ->> v_target)::numeric, 0);
      v_next := v_current + coalesce(tx.target_amount, 0);
      v_cash := jsonb_set(v_cash, array[v_target], to_jsonb(v_next), true);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. insert_transaction_with_fee : add p_time parameter.
-- The linked FEE row inherits the same time as its parent so they sort together.
-- ---------------------------------------------------------------------------
drop function if exists public.insert_transaction_with_fee(
  uuid, text, numeric, text, date, text, numeric, numeric, numeric, text, numeric, text
);

create or replace function public.insert_transaction_with_fee(
  p_account_id uuid,
  p_type text,
  p_amount numeric,
  p_description text,
  p_date date,
  p_stock_symbol text,
  p_quantity numeric,
  p_price_per_unit numeric,
  p_fees numeric,
  p_currency text default 'EUR',
  p_target_amount numeric default null,
  p_target_currency text default null,
  p_time time default null
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
  v_currency text := upper(coalesce(nullif(trim(p_currency), ''), 'EUR'));
  v_target_currency text := case
    when p_target_currency is null or length(trim(p_target_currency)) = 0 then null
    else upper(trim(p_target_currency))
  end;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;

  if p_type not in ('DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE', 'CONVERSION') then
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

  if p_type = 'CONVERSION' then
    if v_target_currency is null or p_target_amount is null or p_target_amount <= 0 then
      raise exception 'invalid_conversion_transaction' using errcode = 'P0001';
    end if;
    if v_target_currency = v_currency then
      raise exception 'conversion_same_currency' using errcode = 'P0001';
    end if;
    if p_stock_symbol is not null and length(trim(p_stock_symbol)) > 0 then
      raise exception 'conversion_no_symbol' using errcode = 'P0001';
    end if;
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
      user_id, account_id, type, amount, currency, description, date, "time",
      stock_symbol, quantity, price_per_unit
    ) values (
      v_user, p_account_id, 'FEE', p_fees, v_currency, v_fee_description, p_date, p_time,
      null, null, null
    )
    returning id into v_fee_id;
  end if;

  insert into public.transactions (
    user_id, account_id, type, amount, currency, fee_transaction_id,
    description, date, "time", stock_symbol, quantity, price_per_unit,
    target_amount, target_currency
  ) values (
    v_user, p_account_id, p_type, p_amount, v_currency, v_fee_id,
    coalesce(p_description, ''), p_date, p_time,
    case when p_stock_symbol is null then null else upper(trim(p_stock_symbol)) end,
    p_quantity,
    p_price_per_unit,
    case when p_type = 'CONVERSION' then p_target_amount else null end,
    case when p_type = 'CONVERSION' then v_target_currency else null end
  )
  returning id into v_tx_id;

  select * into v_tx from public.transactions where id = v_tx_id;
  return to_jsonb(v_tx);
end;
$$;

grant execute on function public.insert_transaction_with_fee(
  uuid, text, numeric, text, date, text, numeric, numeric, numeric, text, numeric, text, time
) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. update_transaction_with_fee : add p_time parameter.
-- p_time is interpreted as the desired final value: null clears, set value
-- replaces. The API resolves "no change" by sending the current value.
-- ---------------------------------------------------------------------------
drop function if exists public.update_transaction_with_fee(
  uuid, text, numeric, text, date, text, numeric, numeric, numeric, text, numeric, text
);

create or replace function public.update_transaction_with_fee(
  p_transaction_id uuid,
  p_type text,
  p_amount numeric,
  p_description text,
  p_date date,
  p_stock_symbol text,
  p_quantity numeric,
  p_price_per_unit numeric,
  p_fees numeric,
  p_currency text default null,
  p_target_amount numeric default null,
  p_target_currency text default null,
  p_time time default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_target record;
  v_is_child_fee boolean;
  v_new_fee_id uuid := null;
  v_fee_description text;
  v_normalized_symbol text;
  v_currency text;
  v_target_currency text := case
    when p_target_currency is null or length(trim(p_target_currency)) = 0 then null
    else upper(trim(p_target_currency))
  end;
  v_tx record;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;

  if p_type not in ('DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE', 'CONVERSION') then
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

  select * into v_target
  from public.transactions
  where id = p_transaction_id and user_id = v_user;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  v_currency := upper(coalesce(
    nullif(trim(coalesce(p_currency, '')), ''),
    v_target.currency,
    'EUR'
  ));

  if p_type = 'CONVERSION' then
    if v_target_currency is null or p_target_amount is null or p_target_amount <= 0 then
      raise exception 'invalid_conversion_transaction' using errcode = 'P0001';
    end if;
    if v_target_currency = v_currency then
      raise exception 'conversion_same_currency' using errcode = 'P0001';
    end if;
    if p_stock_symbol is not null and length(trim(p_stock_symbol)) > 0 then
      raise exception 'conversion_no_symbol' using errcode = 'P0001';
    end if;
  end if;

  select exists (
    select 1 from public.transactions
    where user_id = v_user
      and fee_transaction_id = p_transaction_id
  ) into v_is_child_fee;

  if v_is_child_fee then
    raise exception 'fee_child_not_editable' using errcode = 'P0001';
  end if;

  if p_type = 'FEE' and p_fees is not null and p_fees > 0 then
    raise exception 'fee_on_fee_not_allowed' using errcode = 'P0001';
  end if;

  v_normalized_symbol := case
    when p_stock_symbol is null or length(trim(p_stock_symbol)) = 0 then null
    else upper(trim(p_stock_symbol))
  end;

  -- Linked FEE row sync : create / update / delete based on new fees value.
  -- Inherits the parent transaction's time so they stay adjacent in the order.
  if v_target.fee_transaction_id is not null then
    if p_fees is null or p_fees <= 0 then
      delete from public.transactions
      where id = v_target.fee_transaction_id
        and user_id = v_user;
      v_new_fee_id := null;
    else
      v_fee_description := case
        when v_normalized_symbol is not null
          then 'Frais ' || p_type || ' ' || v_normalized_symbol
        else 'Frais ' || p_type
      end;
      update public.transactions
         set amount = p_fees,
             currency = v_currency,
             description = v_fee_description,
             date = p_date,
             "time" = p_time
       where id = v_target.fee_transaction_id
         and user_id = v_user;
      v_new_fee_id := v_target.fee_transaction_id;
    end if;
  elsif p_fees is not null and p_fees > 0 then
    v_fee_description := case
      when v_normalized_symbol is not null
        then 'Frais ' || p_type || ' ' || v_normalized_symbol
      else 'Frais ' || p_type
    end;
    insert into public.transactions (
      user_id, account_id, type, amount, currency, description, date, "time",
      stock_symbol, quantity, price_per_unit
    ) values (
      v_user, v_target.account_id, 'FEE', p_fees, v_currency, v_fee_description, p_date, p_time,
      null, null, null
    )
    returning id into v_new_fee_id;
  end if;

  update public.transactions
     set type = p_type,
         amount = p_amount,
         currency = v_currency,
         fee_transaction_id = v_new_fee_id,
         description = coalesce(p_description, ''),
         date = p_date,
         "time" = p_time,
         stock_symbol = v_normalized_symbol,
         quantity = case when p_type in ('BUY', 'SELL') then p_quantity else nullif(p_quantity, 0) end,
         price_per_unit = case when p_type in ('BUY', 'SELL') then p_price_per_unit else nullif(p_price_per_unit, 0) end,
         target_amount = case when p_type = 'CONVERSION' then p_target_amount else null end,
         target_currency = case when p_type = 'CONVERSION' then v_target_currency else null end
   where id = p_transaction_id
     and user_id = v_user;

  select * into v_tx from public.transactions where id = p_transaction_id;
  return to_jsonb(v_tx);
end;
$$;

grant execute on function public.update_transaction_with_fee(
  uuid, text, numeric, text, date, text, numeric, numeric, numeric, text, numeric, text, time
) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. insert_transactions_batch : pass-through "time" from JSON payload (optional).
-- ---------------------------------------------------------------------------
create or replace function public.insert_transactions_batch(
  p_account_id uuid,
  p_transactions jsonb,
  p_import_job_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_account_id uuid;
  v_total int := jsonb_array_length(coalesce(p_transactions, '[]'::jsonb));
  v_inserted int := 0;
  v_tx jsonb;
  v_fee_id uuid;
  v_fees numeric;
  v_type text;
  v_currency text;
  v_target_amount numeric;
  v_target_currency text;
  v_slots_needed int := 0;
  v_existing_count int;
  v_pro boolean;
  v_fee_description text;
  v_stock_symbol text;
  v_time time;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;

  if v_total = 0 then
    return jsonb_build_object('inserted', 0, 'total', 0);
  end if;

  select id into v_account_id from public.accounts
  where id = p_account_id and user_id = v_user;
  if v_account_id is null then
    raise exception 'invalid_account' using errcode = 'P0001';
  end if;

  v_pro := public.user_has_pro_access(v_user);
  if not v_pro then
    select count(*) into v_existing_count from public.transactions where user_id = v_user;

    select coalesce(sum(
      case
        when (item->>'type') <> 'FEE' and coalesce((item->>'fees')::numeric, 0) > 0 then 2
        else 1
      end
    ), 0)::int into v_slots_needed
    from jsonb_array_elements(p_transactions) item;

    if v_existing_count + v_slots_needed > 50 then
      raise exception
        'FREE_TIER_LIMIT: import dépasserait le maximum de 50 transactions (% / 50)',
        v_existing_count + v_slots_needed
        using errcode = 'P0001';
    end if;
  end if;

  for v_tx in select * from jsonb_array_elements(p_transactions)
  loop
    v_type := v_tx->>'type';
    v_fees := coalesce((v_tx->>'fees')::numeric, 0);
    v_stock_symbol := nullif(v_tx->>'stock_symbol', '');
    v_currency := upper(coalesce(nullif(v_tx->>'currency', ''), 'EUR'));
    v_target_amount := nullif(v_tx->>'target_amount', '')::numeric;
    v_target_currency := case
      when nullif(v_tx->>'target_currency', '') is null then null
      else upper(v_tx->>'target_currency')
    end;
    v_time := nullif(v_tx->>'time', '')::time;
    v_fee_id := null;

    if v_type <> 'FEE' and v_fees > 0 then
      v_fee_description := case
        when v_stock_symbol is not null
          then 'Frais ' || v_type || ' ' || upper(v_stock_symbol)
        else 'Frais ' || v_type
      end;

      insert into public.transactions (
        user_id, account_id, type, amount, currency, description, date, "time",
        stock_symbol, quantity, price_per_unit
      ) values (
        v_user, p_account_id, 'FEE', v_fees, v_currency, v_fee_description,
        (v_tx->>'date')::date, v_time,
        null, null, null
      ) returning id into v_fee_id;
    end if;

    insert into public.transactions (
      user_id, account_id, type, amount, currency, fee_transaction_id,
      description, date, "time", stock_symbol, quantity, price_per_unit,
      target_amount, target_currency
    ) values (
      v_user, p_account_id, v_type,
      (v_tx->>'amount')::numeric, v_currency, v_fee_id,
      coalesce(v_tx->>'description', ''),
      (v_tx->>'date')::date, v_time,
      v_stock_symbol,
      nullif(v_tx->>'quantity', '')::numeric,
      nullif(v_tx->>'price_per_unit', '')::numeric,
      case when v_type = 'CONVERSION' then v_target_amount else null end,
      case when v_type = 'CONVERSION' then v_target_currency else null end
    );

    v_inserted := v_inserted + 1;
  end loop;

  if p_import_job_id is not null then
    update public.import_jobs
      set status = 'committed',
          rows_imported = v_inserted,
          rows_total = v_total
      where id = p_import_job_id and user_id = v_user;
  end if;

  return jsonb_build_object('inserted', v_inserted, 'total', v_total);
end;
$$;

grant execute on function public.insert_transactions_batch(uuid, jsonb, uuid) to authenticated;
