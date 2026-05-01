-- ============================================================
-- CRM Marketing Automations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'no_visit_days',     -- Guest hasn't visited in X days
    'birthday',          -- X days before guest birthday
    'post_completion',   -- X hours after booking completed
    'vip_booking',       -- VIP guest makes a booking
    'no_review',         -- X hours after completion with no review
    'new_review'         -- When a new review is received
  )),
  trigger_config JSONB NOT NULL DEFAULT '{}', -- e.g. {"days": 60} or {"hours": 24}
  action_channel TEXT NOT NULL CHECK (action_channel IN ('whatsapp', 'email', 'sms', 'in_app')),
  action_template TEXT NOT NULL, -- Message template with {{placeholders}}
  is_active BOOLEAN NOT NULL DEFAULT false,
  sent_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_automations_restaurant ON public.automations(restaurant_id);
CREATE INDEX idx_automations_active ON public.automations(is_active) WHERE is_active = true;

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owners can manage automations"
  ON public.automations FOR ALL
  USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR public.is_admin()
  );

-- Auto-update timestamp
CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Track sent automation messages
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_logs_automation ON public.automation_logs(automation_id);

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owners can view automation logs"
  ON public.automation_logs FOR SELECT
  USING (
    automation_id IN (
      SELECT a.id FROM public.automations a
      JOIN public.restaurants r ON r.id = a.restaurant_id
      WHERE r.owner_id = auth.uid()
    )
    OR public.is_admin()
  );
