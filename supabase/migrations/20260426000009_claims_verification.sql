-- ============================================================
-- Enhanced claim verification: prevent impersonation & squatting
-- ============================================================

-- Add verification fields to claims
ALTER TABLE public.restaurant_claims
  ADD COLUMN IF NOT EXISTS verification_method TEXT CHECK (verification_method IN (
    'cac_certificate',    -- CAC registration doc
    'utility_bill',       -- Utility bill matching restaurant address
    'bank_statement',     -- Business bank statement
    'business_card',      -- Business card or ID
    'phone_callback',     -- Admin will call restaurant phone to verify
    'in_person',          -- Admin visits in person
    'other'
  )),
  ADD COLUMN IF NOT EXISTS restaurant_phone_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS address_on_proof TEXT,       -- address shown on uploaded proof doc
  ADD COLUMN IF NOT EXISTS cac_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS fraud_flags JSONB DEFAULT '[]'::jsonb;

-- Track how many restaurants a user has claimed (anti-squatting)
-- One user can own multiple restaurants (chains), but each claim needs separate verification
-- The admin sees a warning if the user already owns other restaurants

-- Add chain support to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS chain_id UUID,
  ADD COLUMN IF NOT EXISTS chain_name TEXT;

-- Index for chain lookups
CREATE INDEX IF NOT EXISTS idx_restaurants_chain ON public.restaurants(chain_id) WHERE chain_id IS NOT NULL;
