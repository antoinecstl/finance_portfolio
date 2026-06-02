-- Validate share balances per symbol and transaction currency.
--
-- A single account can hold the same ticker bought in multiple currencies. The
-- portfolio replay now keys positions by account + symbol + currency, so the DB
-- sequence guard must do the same: selling AAPL in USD must not consume an AAPL
-- position bought in EUR.

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
  v_share_key text;
  v_currency text;
  v_target text;
  v_current numeric;
  v_next numeric;
  tx record;
begin
  for tx in
    select id, type, amount, upper(coalesce(currency, 'EUR')) as currency,
           target_amount,
           case
             when target_currency is null then null
             else upper(target_currency)
           end as target_currency,
           stock_symbol, quantity, date, created_at, effective_time
    from public.transactions
    where user_id = p_user_id
      and account_id = p_account_id
    order by date asc,
      effective_time asc,
      created_at asc,
      id asc
  loop
    v_currency := tx.currency;

    if tx.stock_symbol is not null and tx.type in ('BUY', 'SELL') then
      v_symbol := upper(tx.stock_symbol);
      v_share_key := v_symbol || ':' || v_currency;
      v_current := coalesce((v_shares ->> v_share_key)::numeric, 0);
      v_next := v_current + case
        when tx.type = 'BUY' then coalesce(tx.quantity, 0)
        when tx.type = 'SELL' then -coalesce(tx.quantity, 0)
        else 0
      end;

      if v_next < -0.005 then
        raise exception 'INVALID_ACCOUNT_SEQUENCE: shares_negative % at %', v_share_key, tx.date
          using errcode = 'P0001';
      end if;

      v_shares := jsonb_set(v_shares, array[v_share_key], to_jsonb(v_next), true);
    end if;

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
