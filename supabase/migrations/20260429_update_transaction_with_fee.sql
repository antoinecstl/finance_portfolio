-- Edition d'une transaction existante.
-- Symétrique de insert_transaction_with_fee : gère la ligne FEE liée
-- (création / mise à jour / suppression) selon le nouveau montant de frais.
--
-- L'account_id n'est volontairement pas modifiable : un déplacement entre
-- comptes casserait la séquence des deux côtés et n'a pas de cas d'usage clair.
-- Pour déplacer une tx, l'utilisateur doit la supprimer puis la recréer.
--
-- Les triggers déjà en place font le reste :
--   - validate_transaction_sequence_trigger  → cash/shares jamais négatifs
--   - rebuild_stock_position_after_tx_trigger → rebuild PRU après changement BUY/SELL
-- Tous deux sont DEFERRABLE INITIALLY DEFERRED : ils s'exécutent en fin de
-- transaction, donc cohérents même quand on UPDATE la tx + son FEE en chaîne.

create or replace function public.update_transaction_with_fee(
  p_transaction_id uuid,
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
  v_target record;
  v_is_child_fee boolean;
  v_new_fee_id uuid := null;
  v_fee_description text;
  v_normalized_symbol text;
  v_tx record;
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

  -- Charge la tx cible (RLS scope déjà à v_user, mais on re-check pour clarté).
  select * into v_target
  from public.transactions
  where id = p_transaction_id and user_id = v_user;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  -- Une ligne FEE référencée par une autre transaction (child fee) ne doit pas
  -- être éditée directement : l'utilisateur passe par la transaction parente
  -- (le RPC met à jour la FEE liée via p_fees).
  select exists (
    select 1 from public.transactions
    where user_id = v_user
      and fee_transaction_id = p_transaction_id
  ) into v_is_child_fee;

  if v_is_child_fee then
    raise exception 'fee_child_not_editable' using errcode = 'P0001';
  end if;

  -- Type FEE standalone : pas de FEE liée à attacher (les frais d'une FEE
  -- n'ont pas de sens). On force p_fees à 0 pour ce cas.
  if p_type = 'FEE' and p_fees is not null and p_fees > 0 then
    raise exception 'fee_on_fee_not_allowed' using errcode = 'P0001';
  end if;

  v_normalized_symbol := case
    when p_stock_symbol is null or length(trim(p_stock_symbol)) = 0 then null
    else upper(trim(p_stock_symbol))
  end;

  -- Gestion de la ligne FEE liée :
  --   ancien fee | nouveau fee | action
  --   ───────────┼─────────────┼─────────────────────────
  --     null     |   = 0       | rien
  --     null     |   > 0       | INSERT puis lier
  --     existe   |   = 0       | DELETE l'ancien, détacher
  --     existe   |   > 0       | UPDATE l'ancien (montant + description + date)
  --
  -- On le fait AVANT l'UPDATE de la tx principale pour que le trigger de
  -- séquence (deferred) voit l'état final cohérent.

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
      user_id, account_id, type, amount, description, date,
      stock_symbol, quantity, price_per_unit
    ) values (
      v_user, v_target.account_id, 'FEE', p_fees, v_fee_description, p_date,
      null, null, null
    )
    returning id into v_new_fee_id;
  end if;

  -- UPDATE de la tx principale. account_id reste figé.
  update public.transactions
     set type = p_type,
         amount = p_amount,
         fee_transaction_id = v_new_fee_id,
         description = coalesce(p_description, ''),
         date = p_date,
         stock_symbol = v_normalized_symbol,
         quantity = case when p_type in ('BUY', 'SELL') then p_quantity else nullif(p_quantity, 0) end,
         price_per_unit = case when p_type in ('BUY', 'SELL') then p_price_per_unit else nullif(p_price_per_unit, 0) end
   where id = p_transaction_id
     and user_id = v_user;

  -- Si l'ancien type était BUY/SELL sur un autre symbole, ou si on quitte
  -- BUY/SELL, le trigger de rebuild s'occupe d'effacer/refaire la position
  -- ancienne. On rebuild aussi pour la nouvelle si elle diffère.
  if v_target.type in ('BUY', 'SELL') and v_target.stock_symbol is not null
     and (
       p_type not in ('BUY', 'SELL')
       or v_normalized_symbol is null
       or upper(v_target.stock_symbol) <> v_normalized_symbol
     ) then
    perform public.rebuild_stock_position(v_user, v_target.account_id, v_target.stock_symbol);
  end if;

  if p_type in ('BUY', 'SELL') and v_normalized_symbol is not null then
    perform public.rebuild_stock_position(v_user, v_target.account_id, v_normalized_symbol);
  end if;

  select * into v_tx from public.transactions where id = p_transaction_id;
  return to_jsonb(v_tx);
end;
$$;

grant execute on function public.update_transaction_with_fee(
  uuid, text, numeric, text, date, text, numeric, numeric, numeric
) to authenticated;
