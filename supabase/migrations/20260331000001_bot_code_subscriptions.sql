-- Add bot_code to restaurants for keyword routing
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS bot_code VARCHAR(30) UNIQUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_bot_code
  ON public.restaurants(bot_code) WHERE bot_code IS NOT NULL;

-- Subscriptions table for recurring WhatsApp plan payments
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  plan VARCHAR(20) NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  amount INTEGER NOT NULL,
  paystack_subscription_code VARCHAR(100),
  paystack_customer_code VARCHAR(100),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own subscription"
  ON public.subscriptions FOR SELECT
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_subscriptions_restaurant ON public.subscriptions(restaurant_id);
