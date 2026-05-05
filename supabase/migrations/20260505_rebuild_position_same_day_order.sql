-- Keep denormalized stock_positions aligned with the shared transaction replay
-- order: same-day SELLs are applied before same-day BUYs.

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
  v_position_currency text;
  v_account_currency text;
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
    select type,
           coalesce(quantity, 0) as quantity,
           coalesce(price_per_unit, 0) as price_per_unit,
           coalesce(currency, 'EUR') as currency
    from public.transactions
    where user_id = p_user_id
      and account_id = p_account_id
      and upper(stock_symbol) = v_symbol
      and type in ('BUY', 'SELL')
    order by date asc,
      case
        when type = 'SELL' then 0
        when type = 'BUY' then 2
        else 3
      end asc,
      created_at asc,
      id asc
  loop
    if tx.type = 'BUY' then
      v_qty := v_qty + tx.quantity;
      v_total_invested := v_total_invested + tx.quantity * tx.price_per_unit;
      if v_position_currency is null then v_position_currency := tx.currency; end if;
    elsif tx.type = 'SELL' then
      v_pru := case when v_qty > 0 then v_total_invested / v_qty else 0 end;
      v_qty := v_qty - tx.quantity;
      v_total_invested := greatest(0, v_qty) * v_pru;
      if v_qty <= 0 then
        v_qty := 0;
        v_total_invested := 0;
        v_position_currency := null;
      end if;
    end if;
  end loop;

  if v_position_currency is null then
    select currency into v_account_currency
    from public.accounts
    where id = p_account_id and user_id = p_user_id;
    v_position_currency := coalesce(v_account_currency, 'EUR');
  end if;

  select id into v_existing_id
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
           currency = v_position_currency,
           updated_at = now()
     where id = v_existing_id;
  else
    insert into public.stock_positions (user_id, account_id, symbol, name, quantity, average_price, currency)
    values (p_user_id, p_account_id, v_symbol, v_symbol, v_qty, v_avg, v_position_currency);
  end if;
end;
$$;

revoke execute on function public.rebuild_stock_position(uuid, uuid, text)
  from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in
    select distinct user_id, account_id, upper(stock_symbol) as symbol
    from public.transactions
    where stock_symbol is not null
      and type in ('BUY', 'SELL')
  loop
    perform public.rebuild_stock_position(r.user_id, r.account_id, r.symbol);
  end loop;
end;
$$;
