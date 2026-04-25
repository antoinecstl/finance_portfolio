-- Hardening pass after codebase audit.
-- Goals:
--  - remove direct authenticated access to rebuild_stock_position
--  - bind SECURITY DEFINER helpers to auth.uid()
--  - enforce ownership through RLS for account-linked rows
--  - add database-level shape constraints for financial rows
--  - provide an atomic delete+rebuild RPC for transaction deletion

-- ---------------------------------------------------------------------------
-- Basic data-shape constraints. NOT VALID avoids failing the migration on old
-- imported data while still protecting new/updated rows.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_account_required'
  ) then
    alter table public.transactions
      add constraint transactions_account_required
      check (account_id is not null) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_amount_positive'
  ) then
    alter table public.transactions
      add constraint transactions_amount_positive
      check (amount > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_stock_symbol_format'
  ) then
    alter table public.transactions
      add constraint transactions_stock_symbol_format
      check (stock_symbol is null or stock_symbol ~ '^[A-Za-z0-9.\-]{1,15}$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_dividend_symbol_required'
  ) then
    alter table public.transactions
      add constraint transactions_dividend_symbol_required
      check (type <> 'DIVIDEND' or (stock_symbol is not null and length(trim(stock_symbol)) > 0)) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transactions_stock_fields_for_buy_sell'
  ) then
    alter table public.transactions
      add constraint transactions_stock_fields_for_buy_sell
      check (
        (
          type in ('BUY', 'SELL')
          and stock_symbol is not null
          and length(trim(stock_symbol)) > 0
          and quantity > 0
          and price_per_unit > 0
        )
        or
        (
          type not in ('BUY', 'SELL')
          and (quantity is null or quantity >= 0)
          and (price_per_unit is null or price_per_unit >= 0)
        )
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'stock_positions_positive_values'
  ) then
    alter table public.stock_positions
      add constraint stock_positions_positive_values
      check (quantity > 0 and average_price > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'stock_positions_symbol_format'
  ) then
    alter table public.stock_positions
      add constraint stock_positions_symbol_format
      check (symbol ~ '^[A-Za-z0-9.\-]{1,15}$') not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: account-linked rows must point to an account owned by the same caller.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can insert own transactions" on public.transactions;
drop policy if exists "Users can update own transactions" on public.transactions;

create policy "Users can insert own transactions" on public.transactions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.accounts a
      where a.id = transactions.account_id
        and a.user_id = auth.uid()
    )
  );

create policy "Users can update own transactions" on public.transactions
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.accounts a
      where a.id = transactions.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own positions" on public.stock_positions;
drop policy if exists "Users can update own positions" on public.stock_positions;

create policy "Users can insert own positions" on public.stock_positions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.accounts a
      where a.id = stock_positions.account_id
        and a.user_id = auth.uid()
    )
  );

create policy "Users can update own positions" on public.stock_positions
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.accounts a
      where a.id = stock_positions.account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id and coalesce(is_founder, false) = false);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Prevent client-side profile updates from self-granting privileged flags.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = new.id and old.is_founder is distinct from new.is_founder then
    raise exception 'unauthorized_profile_privilege_change' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_privilege_escalation_trigger on public.profiles;
create trigger prevent_profile_privilege_escalation_trigger
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

-- ---------------------------------------------------------------------------
-- Sequence validation: direct table writes must obey the same cash/share rules
-- as the Next.js API.
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
  v_cash numeric := 0;
  v_shares jsonb := '{}'::jsonb;
  v_symbol text;
  v_current numeric;
  v_next numeric;
  tx record;
begin
  for tx in
    select id, type, amount, stock_symbol, quantity, date, created_at
    from public.transactions
    where user_id = p_user_id
      and account_id = p_account_id
    order by date asc, created_at asc, id asc
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

    v_cash := v_cash + case
      when tx.type in ('DEPOSIT', 'DIVIDEND', 'INTEREST', 'SELL') then tx.amount
      when tx.type in ('WITHDRAWAL', 'BUY', 'FEE') then -tx.amount
      else 0
    end;

    if v_cash < -0.005 then
      raise exception 'INVALID_ACCOUNT_SEQUENCE: cash_negative at %', tx.date
        using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

create or replace function public.validate_transaction_account_sequence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.account_id is not null then
      perform public.assert_account_sequence_valid(old.user_id, old.account_id);
    end if;
    return old;
  end if;

  if new.account_id is not null then
    perform public.assert_account_sequence_valid(new.user_id, new.account_id);
  end if;

  if tg_op = 'UPDATE' and old.account_id is distinct from new.account_id and old.account_id is not null then
    perform public.assert_account_sequence_valid(old.user_id, old.account_id);
  end if;

  return new;
end;
$$;

drop trigger if exists validate_transaction_sequence_trigger on public.transactions;
create constraint trigger validate_transaction_sequence_trigger
  after insert or update or delete on public.transactions
  deferrable initially deferred
  for each row execute function public.validate_transaction_account_sequence();

-- ---------------------------------------------------------------------------
-- Harden denormalized position rebuild. Direct execution is not needed by the
-- app; it is called internally by RPCs/triggers.
-- ---------------------------------------------------------------------------
create or replace function public.rebuild_stock_position(
  p_user_id uuid,
  p_account_id uuid,
  p_symbol text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_qty numeric := 0;
  v_total_invested numeric := 0;
  v_pru numeric;
  v_avg numeric;
  v_existing_id uuid;
  v_existing_name text;
  v_existing_currency text;
  v_symbol text := upper(trim(p_symbol));
  tx record;
begin
  if v_caller is not null and v_caller <> p_user_id then
    raise exception 'unauthorized_rebuild' using errcode = 'P0001';
  end if;

  if v_symbol is null or length(v_symbol) = 0 then
    return;
  end if;

  for tx in
    select type, coalesce(quantity, 0) as quantity, coalesce(price_per_unit, 0) as price_per_unit
    from public.transactions
    where user_id = p_user_id
      and account_id = p_account_id
      and upper(stock_symbol) = v_symbol
      and type in ('BUY', 'SELL')
    order by date asc, created_at asc, id asc
  loop
    if tx.type = 'BUY' then
      v_qty := v_qty + tx.quantity;
      v_total_invested := v_total_invested + tx.quantity * tx.price_per_unit;
    elsif tx.type = 'SELL' then
      v_pru := case when v_qty > 0 then v_total_invested / v_qty else 0 end;
      v_qty := v_qty - tx.quantity;
      v_total_invested := greatest(0, v_qty) * v_pru;
    end if;
  end loop;

  select id, name, currency into v_existing_id, v_existing_name, v_existing_currency
  from public.stock_positions
  where user_id = p_user_id
    and account_id = p_account_id
    and upper(symbol) = v_symbol;

  if v_qty <= 0 then
    if v_existing_id is not null then
      delete from public.stock_positions where id = v_existing_id;
    end if;
    return;
  end if;

  v_avg := v_total_invested / v_qty;

  if v_existing_id is not null then
    update public.stock_positions
       set quantity = v_qty,
           average_price = v_avg,
           updated_at = now()
     where id = v_existing_id;
  else
    insert into public.stock_positions (user_id, account_id, symbol, name, quantity, average_price, currency)
    values (p_user_id, p_account_id, v_symbol, v_symbol, v_qty, v_avg, 'EUR');
  end if;
end;
$$;

revoke execute on function public.rebuild_stock_position(uuid, uuid, text)
  from public, anon, authenticated;

create or replace function public.rebuild_stock_position_after_tx()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.stock_symbol is not null and new.type in ('BUY', 'SELL') then
    perform public.rebuild_stock_position(new.user_id, new.account_id, new.stock_symbol);
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.stock_symbol is not null and old.type in ('BUY', 'SELL') then
    if tg_op = 'DELETE'
      or old.account_id is distinct from new.account_id
      or upper(old.stock_symbol) is distinct from upper(new.stock_symbol)
    then
      perform public.rebuild_stock_position(old.user_id, old.account_id, old.stock_symbol);
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists rebuild_stock_position_after_tx_trigger on public.transactions;
create constraint trigger rebuild_stock_position_after_tx_trigger
  after insert or update or delete on public.transactions
  deferrable initially deferred
  for each row execute function public.rebuild_stock_position_after_tx();

-- ---------------------------------------------------------------------------
-- RPCs used by the app.
-- ---------------------------------------------------------------------------
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

  select id into v_account
  from public.accounts
  where id = p_account_id and user_id = v_user;

  if not found then
    raise exception 'invalid_account' using errcode = 'P0001';
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

create or replace function public.delete_transaction_with_rebuild(p_transaction_id uuid)
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

  if v_target.stock_symbol is not null and v_target.type in ('BUY', 'SELL') then
    perform public.rebuild_stock_position(v_user, v_target.account_id, v_target.stock_symbol);
  end if;
end;
$$;

grant execute on function public.delete_transaction_with_rebuild(uuid) to authenticated;
