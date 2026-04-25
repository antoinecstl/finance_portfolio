-- ============================================================
-- Phase 4 — Billing (Paddle) — additive, safe for existing data
-- ============================================================

-- 1. Table plans (reference statique)
CREATE TABLE IF NOT EXISTS public.plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  interval TEXT,
  paddle_price_id TEXT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_accounts INTEGER,
  max_transactions INTEGER,
  max_positions INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.plans (id, name, price_cents, currency, interval, features, max_accounts, max_transactions, max_positions)
VALUES
  ('free', 'Free', 0, 'EUR', NULL, '["basic_charts"]'::jsonb, 1, 50, 5),
  ('pro', 'Pro', 499, 'EUR', 'month',
   '["basic_charts","advanced_analytics","csv_export","full_history","dividends_module"]'::jsonb,
   NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  features = EXCLUDED.features,
  max_accounts = EXCLUDED.max_accounts,
  max_transactions = EXCLUDED.max_transactions,
  max_positions = EXCLUDED.max_positions;

-- 2. Table subscriptions (1 row par user, cree a la demande)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  paddle_customer_id TEXT,
  paddle_subscription_id TEXT UNIQUE,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: user peut lire sa propre sub, mais pas la modifier (webhook service-role only)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Plans are public" ON public.plans;
CREATE POLICY "Plans are public" ON public.plans FOR SELECT USING (TRUE);

-- 3. Table webhook_events (idempotence)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (provider, event_id)
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- no policy = service role only

-- 4. Helper: backfill une subscription "free" pour chaque user existant
INSERT INTO public.subscriptions (user_id, plan_id, status)
SELECT id, 'free', 'active' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 5. Trigger: auto-creer subscription free a l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- 6. Index
CREATE INDEX IF NOT EXISTS idx_subscriptions_paddle_sub_id ON public.subscriptions(paddle_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paddle_customer_id ON public.subscriptions(paddle_customer_id);
