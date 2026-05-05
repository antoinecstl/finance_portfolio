-- Same-day transaction ordering for date-only imports/manual entries.
--
-- A conversion added after a same-day BUY can still be the operation that funded
-- that BUY. Because the app only stores a date (not an execution timestamp),
-- validation should not reject that valid daily sequence solely because
-- created_at is later.
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
           stock_symbol, quantity, date, created_at
    from public.transactions
    where user_id = p_user_id
      and account_id = p_account_id
    order by date asc,
      case
        when type in ('DEPOSIT', 'DIVIDEND', 'INTEREST', 'SELL') then 0
        when type = 'CONVERSION' then 1
        when type in ('WITHDRAWAL', 'BUY', 'FEE') then 2
        else 3
      end asc,
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
