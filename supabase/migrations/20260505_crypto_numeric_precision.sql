-- Crypto statements can contain very small fees/amounts (for example
-- 0.000003 SOL). The original DECIMAL(15,2) money columns round those values
-- to zero, which then violates amount > 0 on FEE rows.
alter table public.transactions
  alter column amount type numeric(24, 10),
  alter column quantity type numeric(24, 12),
  alter column price_per_unit type numeric(24, 10),
  alter column target_amount type numeric(24, 10);

alter table public.stock_positions
  alter column quantity type numeric(24, 12),
  alter column average_price type numeric(24, 10);
