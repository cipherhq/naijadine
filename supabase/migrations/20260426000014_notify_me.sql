-- ============================================================
-- "Notify Me" when table opens at a fully-booked restaurant
-- ============================================================

CREATE TABLE IF NOT EXISTS public.availability_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 2,
  notified BOOLEAN NOT NULL DEFAULT false,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, user_id, date)
);

ALTER TABLE public.availability_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own alerts"
  ON public.availability_alerts FOR ALL
  USING (user_id = auth.uid() OR public.is_admin());

-- Dietary tags for restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] DEFAULT '{}';
