-- stock_positions was a denormalized projection of BUY/SELL transactions.
-- Positions are now derived from transactions in the application, so this
-- migration removes the table and every active database dependency on it.

drop trigger if exists rebuild_stock_position_after_tx_trigger on public.transactions;

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
  if tg_table_name = 'transactions' and new.type in ('BUY', 'SELL', 'DIVIDEND') then
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

revoke execute on function public.enforce_position_capable_account()
  from public, anon, authenticated;

create or replace function public.prevent_disabling_positions_for_used_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.account_supports_positions(old.type, old.supports_positions)
     and not public.account_supports_positions(new.type, new.supports_positions)
     and exists (
       select 1
       from public.transactions t
       where t.account_id = new.id
         and t.user_id = new.user_id
         and t.type in ('BUY', 'SELL', 'DIVIDEND')
     )
  then
    raise exception 'account_has_positions' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.prevent_disabling_positions_for_used_account()
  from public, anon, authenticated;

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
  p_target_currency text default null
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
      user_id, account_id, type, amount, currency, description, date,
      stock_symbol, quantity, price_per_unit
    ) values (
      v_user, p_account_id, 'FEE', p_fees, v_currency, v_fee_description, p_date,
      null, null, null
    )
    returning id into v_fee_id;
  end if;

  insert into public.transactions (
    user_id, account_id, type, amount, currency, fee_transaction_id,
    description, date, stock_symbol, quantity, price_per_unit,
    target_amount, target_currency
  ) values (
    v_user, p_account_id, p_type, p_amount, v_currency, v_fee_id,
    coalesce(p_description, ''), p_date,
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
  uuid, text, numeric, text, date, text, numeric, numeric, numeric, text, numeric, text
) to authenticated;

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
  p_target_currency text default null
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
             date = p_date
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
      user_id, account_id, type, amount, currency, description, date,
      stock_symbol, quantity, price_per_unit
    ) values (
      v_user, v_target.account_id, 'FEE', p_fees, v_currency, v_fee_description, p_date,
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
  uuid, text, numeric, text, date, text, numeric, numeric, numeric, text, numeric, text
) to authenticated;

create or replace function public.delete_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_target record;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;

  select *
  into v_target
  from public.transactions
  where id = p_transaction_id
    and user_id = v_user;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  delete from public.transactions
  where user_id = v_user
    and (
      id = p_transaction_id
      or id = v_target.fee_transaction_id
    );
end;
$$;

revoke execute on function public.delete_transaction(uuid) from public, anon;
grant execute on function public.delete_transaction(uuid) to authenticated;

drop function if exists public.delete_transaction_with_rebuild(uuid);
drop function if exists public.rebuild_stock_position_after_tx();
drop function if exists public.rebuild_stock_position(uuid, uuid, text);

do $$
begin
  if to_regclass('public.stock_positions') is not null then
    execute 'drop trigger if exists enforce_free_tier_positions_trigger on public.stock_positions';
    execute 'drop trigger if exists enforce_position_capable_account_positions on public.stock_positions';
    execute 'drop trigger if exists update_stock_positions_updated_at on public.stock_positions';
    execute 'drop trigger if exists audit_stock_positions on public.stock_positions';
  end if;
end;
$$;

drop function if exists public.enforce_free_tier_positions();
drop table if exists public.stock_positions cascade;
