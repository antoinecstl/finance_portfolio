-- Import is a Pro-only feature. API routes enforce it, and this migration keeps
-- the database layer aligned for direct Supabase calls.

update public.plans
set features = case
  when features ? 'import_transactions' then features
  else features || '["import_transactions"]'::jsonb
end
where id = 'pro';

drop policy if exists "import_jobs_insert_own" on public.import_jobs;
create policy "import_jobs_insert_own" on public.import_jobs
  for insert with check (
    auth.uid() = user_id
    and public.user_has_pro_access(auth.uid())
  );

drop policy if exists "import_jobs_update_own" on public.import_jobs;
create policy "import_jobs_update_own" on public.import_jobs
  for update using (
    auth.uid() = user_id
    and public.user_has_pro_access(auth.uid())
  );

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
  v_account record;
  v_total int := jsonb_array_length(coalesce(p_transactions, '[]'::jsonb));
  v_inserted int := 0;
  v_tx jsonb;
  v_fee_id uuid;
  v_fees numeric;
  v_type text;
  v_fee_description text;
  v_stock_symbol text;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;

  if not public.user_has_pro_access(v_user) then
    raise exception 'PRO_REQUIRED: import reserve aux utilisateurs Pro' using errcode = 'P0001';
  end if;

  if v_total = 0 then
    return jsonb_build_object('inserted', 0, 'total', 0);
  end if;

  select id, type, supports_positions into v_account from public.accounts
  where id = p_account_id and user_id = v_user;
  if not found then
    raise exception 'invalid_account' using errcode = 'P0001';
  end if;

  for v_tx in select * from jsonb_array_elements(p_transactions)
  loop
    v_type := v_tx->>'type';
    v_fees := coalesce((v_tx->>'fees')::numeric, 0);
    v_stock_symbol := nullif(upper(trim(v_tx->>'stock_symbol')), '');
    v_fee_id := null;

    if v_type in ('BUY', 'SELL', 'DIVIDEND')
       and not public.account_supports_positions(v_account.type, v_account.supports_positions)
    then
      raise exception 'account_does_not_support_positions' using errcode = 'P0001';
    end if;

    if v_type <> 'FEE' and v_fees > 0 then
      v_fee_description := case
        when v_stock_symbol is not null
          then 'Frais ' || v_type || ' ' || upper(v_stock_symbol)
        else 'Frais ' || v_type
      end;

      insert into public.transactions (
        user_id, account_id, type, amount, description, date,
        stock_symbol, quantity, price_per_unit
      ) values (
        v_user, p_account_id, 'FEE', v_fees, v_fee_description,
        (v_tx->>'date')::date,
        null, null, null
      ) returning id into v_fee_id;
    end if;

    insert into public.transactions (
      user_id, account_id, type, amount, fee_transaction_id, description, date,
      stock_symbol, quantity, price_per_unit
    ) values (
      v_user, p_account_id, v_type,
      (v_tx->>'amount')::numeric, v_fee_id,
      coalesce(v_tx->>'description', ''),
      (v_tx->>'date')::date,
      v_stock_symbol,
      nullif(v_tx->>'quantity', '')::numeric,
      nullif(v_tx->>'price_per_unit', '')::numeric
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
