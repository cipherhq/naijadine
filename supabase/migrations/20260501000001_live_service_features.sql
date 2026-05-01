-- ============================================================
-- Live Service Features: service board, pace control, walk-in
-- queue, pre-shift notes, server sections, guest messaging
-- ============================================================

-- ── Pace Control: shifts + cover limits ──
CREATE TABLE IF NOT EXISTS public.restaurant_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 'Lunch', 'Dinner', 'Brunch'
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
  start_time TEXT NOT NULL, -- '11:00'
  end_time TEXT NOT NULL, -- '15:00'
  max_covers_per_interval INTEGER DEFAULT 20,
  interval_minutes INTEGER DEFAULT 15,
  turn_time_minutes INTEGER DEFAULT 90,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(restaurant_id, name, day_of_week)
);

ALTER TABLE public.restaurant_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Restaurant owners manage shifts" ON public.restaurant_shifts FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()) OR public.is_admin());

-- ── Server Sections ──
ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS section TEXT;

-- ── Walk-in Queue ──
CREATE TABLE IF NOT EXISTS public.walkin_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  party_size INTEGER NOT NULL DEFAULT 2,
  position INTEGER NOT NULL DEFAULT 0,
  estimated_wait_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'seated', 'left', 'no_show')),
  notes TEXT,
  seated_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_walkin_queue_restaurant ON public.walkin_queue(restaurant_id, status);
ALTER TABLE public.walkin_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Restaurant staff manage walk-in queue" ON public.walkin_queue FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()) OR public.is_admin());

-- Enable realtime on walk-in queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.walkin_queue;

-- ── Pre-shift Notes ──
CREATE TABLE IF NOT EXISTS public.service_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note_type TEXT NOT NULL CHECK (note_type IN ('vip', 'allergy', 'birthday', 'anniversary', 'general', 'kitchen')),
  content TEXT NOT NULL,
  reservation_id UUID REFERENCES public.reservations(id),
  table_label TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_notes_date ON public.service_notes(restaurant_id, date);
ALTER TABLE public.service_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Restaurant staff manage service notes" ON public.service_notes FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()) OR public.is_admin());

-- ── Guest Messages ──
CREATE TABLE IF NOT EXISTS public.guest_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.reservations(id),
  guest_phone TEXT NOT NULL,
  guest_name TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'whatsapp')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'received')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_guest_messages_restaurant ON public.guest_messages(restaurant_id, created_at DESC);
ALTER TABLE public.guest_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Restaurant staff manage messages" ON public.guest_messages FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()) OR public.is_admin());

-- ── Custom Booking Rules ──
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS booking_rules JSONB DEFAULT '{}'::jsonb;
-- Example: {"min_party_booth": 4, "no_single_friday": true, "peak_turn_minutes": 90}

-- Add seated_at timestamp to reservations if missing
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS seated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
