-- Premier import de relevé offert en Free.
--
-- L'import reste illimité en Pro. Un compte Free peut valider un import (un lot,
-- éventuellement multi-documents) ; ensuite l'accès se ferme. Les routes
-- /api/import/parse et /api/import/commit appliquent la règle (lib/plans.ts,
-- importAccess) ; cette migration aligne la base pour les appels directs.
--
-- Corrige aussi la limite Free de insert_transactions_batch, restée à 50
-- transactions alors que le plan en autorise 100 depuis 20260814 : elle est
-- désormais lue dans public.plans.

-- 1. import_jobs : création permise en Pro, ou en Free tant qu'aucun lot n'est
--    validé. Mise à jour permise sur les jobs en cours d'aperçu (clôture d'un
--    lot multi-documents, échec, nouvelle analyse) ; un job validé ne bouge plus.
drop policy if exists "import_jobs_insert_own" on public.import_jobs;
create policy "import_jobs_insert_own" on public.import_jobs
  for insert with check (
    auth.uid() = user_id
    and (
      public.user_has_pro_access(auth.uid())
      or not exists (
        select 1 from public.import_jobs j
        where j.user_id = auth.uid() and j.status = 'committed'
      )
    )
  );

drop policy if exists "import_jobs_update_own" on public.import_jobs;
create policy "import_jobs_update_own" on public.import_jobs
  for update
  using (
    auth.uid() = user_id
    and (public.user_has_pro_access(auth.uid()) or status = 'previewing')
  )
  with check (auth.uid() = user_id);

-- 2. insert_transactions_batch : refuse un second import en Free, limite Free
--    lue dans public.plans. Le reste est identique à 20260506.
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
  v_free_limit int;
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
    -- Un seul import offert en Free : un lot déjà validé ferme l'accès.
    if p_import_job_id is not null and exists (
      select 1 from public.import_jobs
      where user_id = v_user and status = 'committed' and id <> p_import_job_id
    ) then
      raise exception 'FREE_IMPORT_USED: import offert déjà utilisé' using errcode = 'P0001';
    end if;

    select max_transactions into v_free_limit from public.plans where id = 'free';
    v_free_limit := coalesce(v_free_limit, 100);

    select count(*) into v_existing_count from public.transactions where user_id = v_user;

    select coalesce(sum(
      case
        when (item->>'type') <> 'FEE' and coalesce((item->>'fees')::numeric, 0) > 0 then 2
        else 1
      end
    ), 0)::int into v_slots_needed
    from jsonb_array_elements(p_transactions) item;

    if v_existing_count + v_slots_needed > v_free_limit then
      raise exception
        'FREE_TIER_LIMIT: import dépasserait le maximum de % transactions (% / %)',
        v_free_limit, v_existing_count + v_slots_needed, v_free_limit
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
