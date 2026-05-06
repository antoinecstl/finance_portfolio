-- Repair for databases that already ran the first draft of
-- 20260506_transaction_time_optional.sql.
--
-- stock_positions was dropped in 20260506_drop_stock_positions.sql, but the
-- first draft of the optional-time migration reintroduced rebuild calls from
-- insert_transaction_with_fee/update_transaction_with_fee. On those databases,
-- BUY/SELL inserts fail at runtime with:
--   relation "public.stock_positions" does not exist
--
-- Positions are derived from transactions in the application now, so the
-- compatibility function is intentionally a no-op.

create or replace function public.rebuild_stock_position(
  p_user_id uuid,
  p_account_id uuid,
  p_symbol text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  return;
end;
$$;

revoke execute on function public.rebuild_stock_position(uuid, uuid, text)
  from public, anon, authenticated;
