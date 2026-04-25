-- Journal d'audit : trace les INSERT/UPDATE/DELETE sur les tables critiques.
-- Utilité : déclaration fiscale (plus-values), résolution de litiges support,
-- détection d'anomalies (ex. suppression massive).
--
-- Stratégie : une seule table générique `audit_log` + trigger générique.
-- Le payload complet est conservé en jsonb (old/new) pour rejouer n'importe quel état.
-- RLS : l'utilisateur lit UNIQUEMENT ses propres entrées ; insertion via trigger security-definer.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  table_name text not null,
  row_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz not null default now()
);

create index if not exists idx_audit_log_user_id on public.audit_log(user_id);
create index if not exists idx_audit_log_table_row on public.audit_log(table_name, row_id);
create index if not exists idx_audit_log_changed_at on public.audit_log(changed_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "users read own audit" on public.audit_log;
create policy "users read own audit" on public.audit_log
  for select using (auth.uid() = user_id);

-- Fonction générique : extrait user_id de la ligne (toutes les tables auditées l'ont),
-- puis pousse une entrée dans audit_log.
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_row_id uuid;
begin
  if tg_op = 'DELETE' then
    v_user := (old).user_id;
    v_row_id := (old).id;
    insert into public.audit_log(user_id, table_name, row_id, action, old_data, new_data)
    values (v_user, tg_table_name, v_row_id, 'DELETE', to_jsonb(old), null);
    return old;
  elsif tg_op = 'UPDATE' then
    v_user := (new).user_id;
    v_row_id := (new).id;
    insert into public.audit_log(user_id, table_name, row_id, action, old_data, new_data)
    values (v_user, tg_table_name, v_row_id, 'UPDATE', to_jsonb(old), to_jsonb(new));
    return new;
  else -- INSERT
    v_user := (new).user_id;
    v_row_id := (new).id;
    insert into public.audit_log(user_id, table_name, row_id, action, old_data, new_data)
    values (v_user, tg_table_name, v_row_id, 'INSERT', null, to_jsonb(new));
    return new;
  end if;
end;
$$;

-- Triggers sur les 3 tables critiques
drop trigger if exists audit_accounts on public.accounts;
create trigger audit_accounts
  after insert or update or delete on public.accounts
  for each row execute function public.log_audit_event();

drop trigger if exists audit_transactions on public.transactions;
create trigger audit_transactions
  after insert or update or delete on public.transactions
  for each row execute function public.log_audit_event();

drop trigger if exists audit_stock_positions on public.stock_positions;
create trigger audit_stock_positions
  after insert or update or delete on public.stock_positions
  for each row execute function public.log_audit_event();
