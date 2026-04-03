-- ═══════════════════════════════════════════════════════
-- Dynamic Business Categories + Per-Business Custom Fees
-- ═══════════════════════════════════════════════════════

-- A. business_categories table
CREATE TABLE IF NOT EXISTS public.business_categories (
  key VARCHAR(50) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  "group" VARCHAR(50) NOT NULL DEFAULT 'services',
  icon VARCHAR(10) NOT NULL DEFAULT '🏢',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  default_greeting TEXT,
  booking_type VARCHAR(30) NOT NULL DEFAULT 'appointment',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: public read, admin write
ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active categories"
  ON public.business_categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert categories"
  ON public.business_categories FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update categories"
  ON public.business_categories FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete categories"
  ON public.business_categories FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed all 25 current categories
INSERT INTO public.business_categories (key, label, "group", icon, sort_order, booking_type, default_greeting) VALUES
  ('restaurant', 'Restaurant', 'food', '🍽️', 1, 'order', 'Welcome to {business_name}! I can help you place an order or book a table.'),
  ('bakery', 'Bakery', 'food', '🧁', 2, 'order', 'Welcome to {business_name}! I can help you place an order.'),
  ('catering', 'Catering', 'food', '🍱', 3, 'order', 'Welcome to {business_name}! I can help you place a catering order.'),
  ('barber', 'Barber', 'beauty', '💈', 4, 'appointment', 'Welcome to {business_name}! I can help you book an appointment.'),
  ('salon', 'Salon', 'beauty', '💇', 5, 'appointment', 'Welcome to {business_name}! I can help you book an appointment.'),
  ('beauty', 'Beauty', 'beauty', '💄', 6, 'appointment', 'Welcome to {business_name}! I can help you book a beauty session.'),
  ('spa', 'Spa', 'beauty', '🧖', 7, 'appointment', 'Welcome to {business_name}! I can help you book a spa session.'),
  ('gym', 'Gym', 'health', '🏋️', 8, 'appointment', 'Welcome to {business_name}! I can help you book a session.'),
  ('clinic', 'Clinic', 'health', '🏥', 9, 'appointment', 'Welcome to {business_name}! I can help you book an appointment.'),
  ('hotel', 'Hotel', 'hospitality', '🏨', 10, 'appointment', 'Welcome to {business_name}! I can help you book a room or make a reservation.'),
  ('coworking', 'Coworking', 'hospitality', '💻', 11, 'general', 'Welcome to {business_name}! How can I assist you today?'),
  ('church', 'Church', 'community', '⛪', 12, 'general', 'Welcome to {business_name}! How can I assist you?'),
  ('cinema', 'Cinema', 'community', '🎬', 13, 'general', 'Welcome to {business_name}! I can help you book tickets.'),
  ('events', 'Events', 'community', '🎉', 14, 'general', 'Welcome to {business_name}! How can I assist you?'),
  ('shop', 'Shop', 'community', '🛍️', 15, 'order', 'Welcome to {business_name}! I can help you place an order.'),
  ('laundry', 'Laundry', 'services', '👔', 16, 'order', 'Welcome to {business_name}! I can help you schedule a pickup or place an order.'),
  ('car_wash', 'Car Wash', 'services', '🚗', 17, 'appointment', 'Welcome to {business_name}! I can help you book a car wash.'),
  ('mechanic', 'Mechanic', 'services', '🔧', 18, 'appointment', 'Welcome to {business_name}! I can help you book a service appointment.'),
  ('cleaning', 'Cleaning', 'services', '🧹', 19, 'order', 'Welcome to {business_name}! I can help you schedule a cleaning.'),
  ('tailor', 'Tailor', 'services', '🪡', 20, 'order', 'Welcome to {business_name}! I can help you place an order.'),
  ('printing', 'Printing', 'services', '🖨️', 21, 'order', 'Welcome to {business_name}! I can help you place a print order.'),
  ('logistics', 'Logistics', 'services', '📦', 22, 'order', 'Welcome to {business_name}! I can help you schedule a delivery.'),
  ('tutor', 'Tutor', 'services', '📚', 23, 'appointment', 'Welcome to {business_name}! I can help you book a tutoring session.'),
  ('photography', 'Photography', 'services', '📸', 24, 'appointment', 'Welcome to {business_name}! I can help you book a photography session.'),
  ('other', 'Other', 'services', '🏢', 25, 'general', 'Welcome to {business_name}! How can I help you today?')
ON CONFLICT (key) DO NOTHING;

-- B. Convert restaurants.business_category from ENUM to TEXT
DO $$
BEGIN
  -- Only alter if the column type is an enum (not already text)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurants'
      AND column_name = 'business_category'
      AND data_type = 'USER-DEFINED'
  ) THEN
    -- Drop the enum-typed default first, then convert, then set a text default
    ALTER TABLE public.restaurants
      ALTER COLUMN business_category DROP DEFAULT;
    ALTER TABLE public.restaurants
      ALTER COLUMN business_category TYPE TEXT USING business_category::TEXT;
    ALTER TABLE public.restaurants
      ALTER COLUMN business_category SET DEFAULT 'restaurant';
  END IF;
END $$;

-- Drop the old enum type if it exists (safe now that no column references it)
DROP TYPE IF EXISTS business_category;

-- C. custom_commission_rate column on restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS custom_commission_rate DECIMAL(5,2) DEFAULT NULL;

COMMENT ON COLUMN public.restaurants.custom_commission_rate IS
  'Per-business commission override. NULL = use global platform_commission_pct.';
