-- ═══════════════════════════════════════════════════════
-- NaijaDine Database Schema
-- Migration: 002 - Reservations & Finance
-- ═══════════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- DEALS
-- ═══════════════════════════════════════

CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  discount_pct INTEGER NOT NULL CHECK (discount_pct BETWEEN 5 AND 50),
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  time_slots JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g., [{"start":"12:00","end":"14:00"}]
  days_of_week JSONB NOT NULL DEFAULT '[1,2,3,4,5,6,7]'::jsonb,
  max_covers_per_slot INTEGER,
  total_bookings INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════
-- RESERVATIONS
-- ═══════════════════════════════════════

CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code VARCHAR(10) UNIQUE NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  table_id UUID REFERENCES public.tables(id),
  date DATE NOT NULL,
  time TIME NOT NULL,
  end_time TIME GENERATED ALWAYS AS (time + INTERVAL '2 hours') STORED,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  status reservation_status NOT NULL DEFAULT 'pending',
  booking_type booking_type NOT NULL DEFAULT 'instant',
  channel booking_channel NOT NULL,
  special_requests TEXT,
  deposit_amount INTEGER NOT NULL DEFAULT 0,
  deposit_status deposit_status NOT NULL DEFAULT 'none',
  payment_id UUID, -- FK added after payments table
  confirmed_at TIMESTAMPTZ,
  seated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by cancelled_by,
  cancellation_reason TEXT,
  no_show_marked_at TIMESTAMPTZ,
  reminder_24h_sent BOOLEAN NOT NULL DEFAULT false,
  reminder_2h_sent BOOLEAN NOT NULL DEFAULT false,
  feedback_requested BOOLEAN NOT NULL DEFAULT false,
  deal_id UUID REFERENCES public.deals(id),
  discount_amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Generate unique reference code
CREATE OR REPLACE FUNCTION public.generate_reference_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code VARCHAR(10);
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'ND-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.reservations WHERE reference_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  NEW.reference_code := new_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_reference_code
  BEFORE INSERT ON public.reservations
  FOR EACH ROW
  WHEN (NEW.reference_code IS NULL OR NEW.reference_code = '')
  EXECUTE FUNCTION public.generate_reference_code();

-- Double-booking prevention constraint
ALTER TABLE public.reservations ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    table_id WITH =,
    tsrange(
      (date + time)::timestamp,
      (date + time + interval '2 hours')::timestamp
    ) WITH &&
  ) WHERE (status NOT IN ('cancelled', 'no_show') AND table_id IS NOT NULL);

-- Indexes
CREATE INDEX idx_reservations_restaurant_date ON public.reservations(restaurant_id, date, status) WHERE status NOT IN ('cancelled');
CREATE INDEX idx_reservations_user_date ON public.reservations(user_id, date DESC);
CREATE INDEX idx_reservations_reference ON public.reservations USING hash(reference_code);
CREATE INDEX idx_reservations_status ON public.reservations(status, date);
CREATE INDEX idx_reservations_reminder ON public.reservations(date, reminder_24h_sent) WHERE status = 'confirmed' AND reminder_24h_sent = false;

-- Enable Realtime for dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;

-- ═══════════════════════════════════════
-- PAYMENTS
-- ═══════════════════════════════════════

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  amount INTEGER NOT NULL, -- in kobo (Naira * 100)
  currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
  gateway payment_gateway NOT NULL,
  gateway_reference VARCHAR(100) UNIQUE NOT NULL,
  gateway_status VARCHAR(50) NOT NULL,
  payment_method payment_method NOT NULL,
  card_last_four VARCHAR(4),
  card_brand VARCHAR(20),
  status payment_status NOT NULL DEFAULT 'pending',
  idempotency_key VARCHAR(100) UNIQUE NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from reservations to payments
ALTER TABLE public.reservations ADD CONSTRAINT fk_reservations_payment
  FOREIGN KEY (payment_id) REFERENCES public.payments(id);

CREATE INDEX idx_payments_gateway_ref ON public.payments USING hash(gateway_reference);
CREATE INDEX idx_payments_reservation ON public.payments(reservation_id);
CREATE INDEX idx_payments_user ON public.payments(user_id, created_at DESC);

-- ═══════════════════════════════════════
-- REFUNDS
-- ═══════════════════════════════════════

CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  amount INTEGER NOT NULL,
  type refund_type NOT NULL,
  reason TEXT NOT NULL,
  status refund_status NOT NULL DEFAULT 'pending',
  gateway_refund_ref VARCHAR(100),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- BANK ACCOUNTS
-- ═══════════════════════════════════════

CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  bank_name VARCHAR(100) NOT NULL,
  bank_code VARCHAR(10) NOT NULL,
  account_number VARCHAR(10) NOT NULL,
  account_name VARCHAR(200) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  paystack_recipient_code VARCHAR(50),
  status bank_account_status NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════
-- PAYOUTS
-- ═══════════════════════════════════════

CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_amount INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,
  commission_rate DECIMAL(4, 2) NOT NULL DEFAULT 10.00,
  refund_amount INTEGER NOT NULL DEFAULT 0,
  net_amount INTEGER NOT NULL,
  status payout_status NOT NULL DEFAULT 'pending',
  gateway_transfer_ref VARCHAR(100),
  failure_reason TEXT,
  processed_by UUID REFERENCES public.profiles(id),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payouts_restaurant ON public.payouts(restaurant_id, period_start DESC);

-- ═══════════════════════════════════════
-- INVOICES
-- ═══════════════════════════════════════

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(30) UNIQUE NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  type invoice_type NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  subtotal INTEGER NOT NULL,
  tax_rate DECIMAL(4, 2) NOT NULL DEFAULT 7.50, -- Nigerian VAT
  tax_amount INTEGER NOT NULL,
  total INTEGER NOT NULL,
  status invoice_status NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- WAITLIST
-- ═══════════════════════════════════════

CREATE TABLE public.waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  guest_name VARCHAR(100) NOT NULL,
  guest_phone VARCHAR(20),
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  estimated_wait_minutes INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- waiting, notified, seated, left
  notified_at TIMESTAMPTZ,
  seated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
