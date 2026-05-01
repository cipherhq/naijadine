-- ============================================================
-- Rebrand: has_blowded -> has_whatsapp_bot
-- Rebrand: site_pages product 'naijadine' -> 'dineroot'
-- Idempotent: safe to re-run if partially applied
-- ============================================================

-- Rename column (skip if already renamed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'restaurants' AND column_name = 'has_blowded'
  ) THEN
    ALTER TABLE public.restaurants RENAME COLUMN has_blowded TO has_whatsapp_bot;
  END IF;
END $$;

-- Rename index
DROP INDEX IF EXISTS idx_restaurants_has_blowded;
CREATE INDEX IF NOT EXISTS idx_restaurants_has_whatsapp_bot
  ON public.restaurants(has_whatsapp_bot) WHERE has_whatsapp_bot = true;

-- Drop ALL check constraints on site_pages.product (handles auto-generated names)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attnum = ANY(con.conkey)
      AND att.attrelid = con.conrelid
    WHERE con.conrelid = 'public.site_pages'::regclass
      AND con.contype = 'c'
      AND att.attname = 'product'
  LOOP
    EXECUTE format('ALTER TABLE public.site_pages DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Migrate existing data
UPDATE public.site_pages SET product = 'dineroot' WHERE product = 'naijadine';
UPDATE public.site_pages SET product = 'whatsapp' WHERE product = 'blowded';

-- Add new constraint
ALTER TABLE public.site_pages
  ADD CONSTRAINT site_pages_product_check
  CHECK (product IN ('dineroot', 'whatsapp', 'both'));
