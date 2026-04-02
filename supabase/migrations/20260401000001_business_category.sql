-- Add business_category to restaurants for industry-aware bot UX
-- Allows the WhatsApp bot to tailor responses by business type

DO $$ BEGIN
  CREATE TYPE business_category AS ENUM (
    'restaurant', 'church', 'gym', 'cinema', 'spa', 'events', 'shop', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS business_category business_category NOT NULL DEFAULT 'restaurant';
