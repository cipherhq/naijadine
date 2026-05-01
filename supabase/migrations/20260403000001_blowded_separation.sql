-- ═══════════════════════════════════════════════════════
-- Blowded Separation: Add has_blowded flag
-- ═══════════════════════════════════════════════════════

-- Add boolean flag for restaurants that have activated Blowded
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS has_blowded BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing whatsapp_standalone restaurants already have Blowded
UPDATE public.restaurants
  SET has_blowded = true
  WHERE product_type = 'whatsapp_standalone';

-- Partial index for fast lookups of Blowded-enabled restaurants
CREATE INDEX IF NOT EXISTS idx_restaurants_has_blowded
  ON public.restaurants(has_blowded) WHERE has_blowded = true;
