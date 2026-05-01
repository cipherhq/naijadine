-- ============================================================
-- Restaurant Claims: Let owners claim existing restaurants
-- ============================================================

CREATE TABLE IF NOT EXISTS public.restaurant_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  claimant_id UUID NOT NULL REFERENCES auth.users(id),

  -- Verification info
  claimant_name TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  claimant_phone TEXT NOT NULL,
  role_at_restaurant TEXT NOT NULL CHECK (role_at_restaurant IN ('owner', 'manager', 'partner')),
  proof_description TEXT, -- "I am the owner, my CAC registration number is..."
  proof_document_url TEXT, -- uploaded doc (CAC cert, utility bill, business card)

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One pending/approved claim per restaurant per user
  UNIQUE(restaurant_id, claimant_id)
);

-- Indexes
CREATE INDEX idx_claims_status ON public.restaurant_claims(status);
CREATE INDEX idx_claims_restaurant ON public.restaurant_claims(restaurant_id);

-- Auto-update timestamp
CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON public.restaurant_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.restaurant_claims ENABLE ROW LEVEL SECURITY;

-- Users can see their own claims
CREATE POLICY "Users can view own claims"
  ON public.restaurant_claims FOR SELECT
  USING (claimant_id = auth.uid() OR public.is_admin());

-- Users can create claims
CREATE POLICY "Users can create claims"
  ON public.restaurant_claims FOR INSERT
  WITH CHECK (claimant_id = auth.uid());

-- Only admins can update claims (approve/reject)
CREATE POLICY "Admins can manage claims"
  ON public.restaurant_claims FOR UPDATE
  USING (public.is_admin());

-- Admins can delete claims
CREATE POLICY "Admins can delete claims"
  ON public.restaurant_claims FOR DELETE
  USING (public.is_admin());
