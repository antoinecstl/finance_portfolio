-- Free tier enforcement: defense-in-depth at the database level.
-- If a user's plan is 'free' and is_founder=false, block inserts beyond plan limits.
-- Pro subscriptions (active/trialing/past_due) and founder accounts bypass all limits.

-- Helper: returns true if user has unlimited access (pro active, trialing, past_due, or founder)
create or replace function public.user_has_pro_access(p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_founder boolean;
  v_plan text;
  v_status text;
begin
  select is_founder into v_founder from public.profiles where id = p_user;
  if coalesce(v_founder, false) then
    return true;
  end if;

  select plan_id, status into v_plan, v_status
  from public.subscriptions
  where user_id = p_user;

  return v_plan = 'pro' and v_status in ('active', 'trialing', 'past_due');
end;
$$;

-- Accounts: max 1 for free tier
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
  if v_count >= 1 then
    raise exception 'FREE_TIER_LIMIT: max 1 compte atteint' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_free_tier_accounts_trigger on public.accounts;
create trigger enforce_free_tier_accounts_trigger
before insert on public.accounts
for each row execute function public.enforce_free_tier_accounts();

-- Transactions: max 50 for free tier
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
  if v_count >= 50 then
    raise exception 'FREE_TIER_LIMIT: max 50 transactions atteint' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_free_tier_transactions_trigger on public.transactions;
create trigger enforce_free_tier_transactions_trigger
before insert on public.transactions
for each row execute function public.enforce_free_tier_transactions();

-- Stock positions: max 5 for free tier
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
  if v_count >= 5 then
    raise exception 'FREE_TIER_LIMIT: max 5 positions atteint' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_free_tier_positions_trigger on public.stock_positions;
create trigger enforce_free_tier_positions_trigger
before insert on public.stock_positions
for each row execute function public.enforce_free_tier_positions();
