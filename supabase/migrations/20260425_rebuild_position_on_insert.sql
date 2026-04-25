-- Rebuild de stock_positions au moment de l'insertion d'une transaction.
-- Symétrique de la route DELETE qui rebuild déjà depuis les transactions restantes.
-- Source de vérité : la séquence des transactions BUY/SELL pour (account_id, symbol).
-- L'ancienne logique (maj côté client) divergeait quand stock_positions était stale.

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
  v_qty numeric := 0;
  v_total_invested numeric := 0;
  v_pru numeric;
  v_avg numeric;
  v_existing_id uuid;
  v_existing_name text;
  v_symbol text := upper(trim(p_symbol));
  tx record;
begin
  if v_symbol is null or length(v_symbol) = 0 then
    return;
  end if;

  -- Replay chronologique BUY/SELL pour (compte, symbole) appartenant à l'utilisateur.
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

  select id, name into v_existing_id, v_existing_name
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

grant execute on function public.rebuild_stock_position(uuid, uuid, text) to authenticated;

-- On enrichit insert_transaction_with_fee pour qu'il appelle rebuild_stock_position
-- juste après l'insert, dans la même transaction Postgres → atomicité conservée.
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

  select id into v_account
  from public.accounts
  where id = p_account_id and user_id = v_user;

  if v_account.id is null then
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
    p_stock_symbol, p_quantity, p_price_per_unit
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
