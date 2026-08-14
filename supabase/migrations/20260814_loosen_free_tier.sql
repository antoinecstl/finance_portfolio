-- Assouplissement du plan Free : limites bien plus généreuses pour rendre la
-- plateforme réellement utilisable en gratuit.
--   Comptes      : 1  -> 3
--   Transactions : 50 -> 100
--   Positions    : 5  -> 10
-- Les fonctionnalités « analyses avancées » et « historique complet » passent
-- aussi en Free ; l'import, le module dividendes et l'export CSV restent Pro.
--
-- NB : ces valeurs doivent rester synchronisées avec lib/plans.ts (source de
-- vérité applicative). Les triggers ci-dessous sont la défense en profondeur au
-- niveau base. Pro (active/trialing/past_due) et fondateurs bypassent toujours
-- tout via public.user_has_pro_access().

-- Accounts: max 3 for free tier
create or replace function public.enforce_free_tier_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if public.user_has_pro_access(new.user_id) then
    return new;
  end if;

  select count(*) into v_count from public.accounts where user_id = new.user_id;
  if v_count >= 3 then
    raise exception 'FREE_TIER_LIMIT: max 3 comptes atteint' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Transactions: max 100 for free tier
create or replace function public.enforce_free_tier_transactions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if public.user_has_pro_access(new.user_id) then
    return new;
  end if;

  select count(*) into v_count from public.transactions where user_id = new.user_id;
  if v_count >= 100 then
    raise exception 'FREE_TIER_LIMIT: max 100 transactions atteint' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Stock positions: max 10 for free tier
create or replace function public.enforce_free_tier_positions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if public.user_has_pro_access(new.user_id) then
    return new;
  end if;

  select count(*) into v_count from public.stock_positions where user_id = new.user_id;
  if v_count >= 10 then
    raise exception 'FREE_TIER_LIMIT: max 10 positions atteint' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Table de référence plans : garde les mêmes valeurs et fonctionnalités que
-- lib/plans.ts (analyses avancées + historique complet désormais en Free).
update public.plans
set
  max_accounts = 3,
  max_transactions = 100,
  max_positions = 10,
  features = '["basic_charts","advanced_analytics","full_history"]'::jsonb
where id = 'free';
