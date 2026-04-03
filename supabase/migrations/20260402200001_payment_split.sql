-- Payment split: add gateway columns to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gateway_subaccount_code VARCHAR(100);

COMMENT ON COLUMN public.restaurants.payment_gateway IS 'paystack | flutterwave | NULL';
COMMENT ON COLUMN public.restaurants.gateway_subaccount_code IS 'Subaccount code from chosen payment gateway';

-- Create platform_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.platform_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage platform config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_config' AND policyname = 'admins_manage_platform_config'
  ) THEN
    CREATE POLICY "admins_manage_platform_config"
      ON public.platform_config FOR ALL
      USING (public.is_admin());
  END IF;
END $$;

-- Allow authenticated users to read platform config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_config' AND policyname = 'authenticated_read_platform_config'
  ) THEN
    CREATE POLICY "authenticated_read_platform_config"
      ON public.platform_config FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Seed platform commission config
INSERT INTO public.platform_config (key, value, description)
VALUES ('platform_commission_pct', '10', 'Platform commission percentage for payment splits')
ON CONFLICT (key) DO NOTHING;
