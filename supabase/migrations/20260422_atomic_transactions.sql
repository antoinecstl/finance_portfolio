-- Insertion atomique d'une transaction + (éventuellement) d'une ligne FEE liée.
-- Remplace le rollback manuel côté route Next.js : si l'un des deux inserts échoue,
-- PostgreSQL rollback la transaction entière. L'atomicité évite les orphelins FEE.
--
-- Contrat : retourne la ligne principale insérée (jsonb).
-- Erreurs : propage les raise des triggers (FREE_TIER_LIMIT, contraintes CHECK).

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

  -- Vérifie l'appartenance du compte avant toute écriture.
  select id into v_account
  from public.accounts
  where id = p_account_id and user_id = v_user;

  if v_account.id is null then
    raise exception 'invalid_account' using errcode = 'P0001';
  end if;

  -- Si des frais > 0 sont fournis et que la tx principale n'est pas déjà de type FEE,
  -- on insère d'abord la ligne FEE séparée et on la référence via fee_transaction_id.
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

  select * into v_tx from public.transactions where id = v_tx_id;
  return to_jsonb(v_tx);
end;
$$;

grant execute on function public.insert_transaction_with_fee(
  uuid, text, numeric, text, date, text, numeric, numeric, numeric
) to authenticated;
