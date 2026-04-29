-- Import de transactions historiques : audit + idempotency.
-- Pas de cache de mapping volontairement (le LLM est rappelé à chaque import inconnu).
-- L'idempotency_key (hash SHA256 du contenu + account_id) empêche les double-imports
-- en cas de double-clic ou rechargement de la page de preview.

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  source_type text not null check (source_type in ('csv','xlsx','pdf','text')),
  source_filename text,
  status text not null default 'previewing'
    check (status in ('previewing','committed','failed','cancelled')),
  rows_total int default 0,
  rows_imported int default 0,
  -- SHA256 du payload + account_id : 2 imports identiques sur le même compte renvoient le même job.
  idempotency_key text not null,
  -- Aperçu textuel borné (pas le fichier complet) : utile pour comprendre un échec d'extraction.
  raw_excerpt text,
  -- Diagnostic : "boursorama" / "trade-republic" / "llm:gpt-4o-mini" / "manual".
  detected_format text,
  -- Warnings parsing (lignes ignorées, dates ambigües, ...). Tableau d'objets { code, message, row? }.
  notes jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists import_jobs_idempotency_idx
  on public.import_jobs(user_id, idempotency_key);

create index if not exists import_jobs_user_recent_idx
  on public.import_jobs(user_id, created_at desc);

drop trigger if exists update_import_jobs_updated_at on public.import_jobs;
create trigger update_import_jobs_updated_at
  before update on public.import_jobs
  for each row execute function public.update_updated_at_column();

alter table public.import_jobs enable row level security;

drop policy if exists "import_jobs_select_own" on public.import_jobs;
create policy "import_jobs_select_own" on public.import_jobs
  for select using (auth.uid() = user_id);

drop policy if exists "import_jobs_insert_own" on public.import_jobs;
create policy "import_jobs_insert_own" on public.import_jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists "import_jobs_update_own" on public.import_jobs;
create policy "import_jobs_update_own" on public.import_jobs
  for update using (auth.uid() = user_id);


-- Insertion atomique d'un lot de transactions (avec FEEs liées).
-- Comportement identique à insert_transaction_with_fee mais en boucle :
-- soit tout passe, soit rien (PostgreSQL rollback).
--
-- Contrat : p_transactions est un jsonb array d'objets validés côté Next.js
-- (createTransactionSchema). Le RPC re-vérifie l'appartenance du compte mais
-- fait confiance au schéma pour les types. La limite free-tier est pré-calculée
-- ici (count actuel + slots à insérer) avant toute écriture, pour éviter de
-- buter sur le trigger en plein milieu et laisser un état partiel.
--
-- Retour : { inserted: int, total: int } — le caller affichera le résumé.

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
  v_slots_needed int := 0;
  v_existing_count int;
  v_pro boolean;
  v_fee_description text;
  v_stock_symbol text;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;

  if v_total = 0 then
    return jsonb_build_object('inserted', 0, 'total', 0);
  end if;

  -- Vérifie l'appartenance du compte avant toute écriture.
  select id into v_account_id from public.accounts
  where id = p_account_id and user_id = v_user;
  if v_account_id is null then
    raise exception 'invalid_account' using errcode = 'P0001';
  end if;

  -- Pré-check du quota free-tier : on calcule les "slots" nécessaires
  -- (1 par tx, +1 par tx avec frais > 0 et type ≠ FEE) et on échoue tôt.
  v_pro := public.user_has_pro_access(v_user);
  if not v_pro then
    select count(*) into v_existing_count from public.transactions where user_id = v_user;

    select coalesce(sum(
      case
        when (item->>'type') <> 'FEE' and coalesce((item->>'fees')::numeric, 0) > 0 then 2
        else 1
      end
    ), 0)::int into v_slots_needed
    from jsonb_array_elements(p_transactions) item;

    if v_existing_count + v_slots_needed > 50 then
      raise exception
        'FREE_TIER_LIMIT: import dépasserait le maximum de 50 transactions (% / 50)',
        v_existing_count + v_slots_needed
        using errcode = 'P0001';
    end if;
  end if;

  -- Insertion des transactions (et de la FEE liée le cas échéant).
  for v_tx in select * from jsonb_array_elements(p_transactions)
  loop
    v_type := v_tx->>'type';
    v_fees := coalesce((v_tx->>'fees')::numeric, 0);
    v_stock_symbol := nullif(v_tx->>'stock_symbol', '');
    v_fee_id := null;

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

  -- Marque le job committed si fourni (idempotent : update no-op si pas trouvé).
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
