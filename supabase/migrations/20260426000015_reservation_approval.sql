-- ============================================================
-- Restaurant setting: require manual approval for bookings
-- Events/private dining table
-- Referral tracking
-- ============================================================

-- Approval mode setting
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS require_approval BOOLEAN NOT NULL DEFAULT false;

-- Events & private dining
CREATE TABLE IF NOT EXISTS public.restaurant_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  cover_photo_url TEXT,
  price_per_person NUMERIC(10,2),
  max_capacity INTEGER,
  spots_remaining INTEGER,
  is_private_dining BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active events"
  ON public.restaurant_events FOR SELECT
  USING (is_active = true);

CREATE POLICY "Restaurant owners manage events"
  ON public.restaurant_events FOR ALL
  USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR public.is_admin()
  );

-- Referral program
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id),
  referred_restaurant_id UUID REFERENCES public.restaurants(id),
  referred_user_id UUID REFERENCES auth.users(id),
  referral_code TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rewarded')),
  reward_amount NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR ALL
  USING (referrer_id = auth.uid() OR public.is_admin());
