-- ═══════════════════════════════════════════════════════
-- NaijaDine Database Schema
-- Migration: 003 - Notifications, CRM, Bot, Admin
-- ═══════════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- NOTIFICATION TEMPLATES
-- ═══════════════════════════════════════

CREATE TABLE public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  channel notification_channel NOT NULL,
  subject VARCHAR(200),
  body TEXT NOT NULL,
  whatsapp_template_name VARCHAR(100),
  whatsapp_template_status VARCHAR(20),
  gupshup_template_id VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════
-- NOTIFICATIONS
-- ═══════════════════════════════════════

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  channel notification_channel NOT NULL,
  title VARCHAR(200),
  body TEXT NOT NULL,
  template_id UUID REFERENCES public.notification_templates(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status notification_status NOT NULL DEFAULT 'queued',
  gateway_message_id VARCHAR(100),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_status ON public.notifications(status) WHERE status = 'queued';

-- ═══════════════════════════════════════
-- BROADCASTS (Admin & Restaurant messaging)
-- ═══════════════════════════════════════

CREATE TABLE public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_type broadcast_sender NOT NULL,
  sender_id UUID NOT NULL, -- admin user_id or restaurant_id
  audience_type broadcast_audience NOT NULL,
  audience_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  channels JSONB NOT NULL DEFAULT '["whatsapp"]'::jsonb,
  subject VARCHAR(200),
  body TEXT NOT NULL,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  opened_count INTEGER NOT NULL DEFAULT 0,
  clicked_count INTEGER NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status broadcast_status NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- GUEST CRM
-- ═══════════════════════════════════════

CREATE TABLE public.guest_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tag_name VARCHAR(50) NOT NULL,
  tag_type VARCHAR(20) NOT NULL DEFAULT 'custom', -- dietary, behavioral, custom
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, user_id, tag_name)
);

CREATE TABLE public.guest_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- REVIEWS
-- ═══════════════════════════════════════

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID UNIQUE NOT NULL REFERENCES public.reservations(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false, -- Private to restaurant initially (Resy model)
  moderation_status moderation_status NOT NULL DEFAULT 'approved',
  flagged_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_restaurant ON public.reviews(restaurant_id, created_at DESC);

-- Update restaurant rating on new review
CREATE OR REPLACE FUNCTION public.update_restaurant_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.restaurants SET
    rating_avg = (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.reviews WHERE restaurant_id = NEW.restaurant_id AND moderation_status = 'approved'),
    rating_count = (SELECT COUNT(*) FROM public.reviews WHERE restaurant_id = NEW.restaurant_id AND moderation_status = 'approved')
  WHERE id = NEW.restaurant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rating_on_review
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_restaurant_rating();

-- ═══════════════════════════════════════
-- WHATSAPP BOT SESSIONS
-- ═══════════════════════════════════════

CREATE TABLE public.bot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number VARCHAR(20) NOT NULL,
  user_id UUID REFERENCES public.profiles(id),
  restaurant_id UUID REFERENCES public.restaurants(id), -- For standalone bots
  current_step VARCHAR(50) NOT NULL DEFAULT 'greeting',
  session_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_bot_sessions_updated_at
  BEFORE UPDATE ON public.bot_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_bot_sessions_active ON public.bot_sessions(whatsapp_number, is_active) WHERE is_active = true;

-- ═══════════════════════════════════════
-- CAMPAIGNS & PROMOTIONS
-- ═══════════════════════════════════════

CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'platform', -- platform, restaurant_week, seasonal
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  co_fund_budget INTEGER DEFAULT 0,
  total_bookings INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, scheduled, active, ended
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.featured_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  campaign_id UUID REFERENCES public.campaigns(id),
  position VARCHAR(50) NOT NULL DEFAULT 'home_feed', -- home_feed, search_top, city_featured
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  bookings INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- SUPPORT TICKETS
-- ═══════════════════════════════════════

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(10) UNIQUE NOT NULL,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id),
  assignee_id UUID REFERENCES public.profiles(id),
  restaurant_id UUID REFERENCES public.restaurants(id),
  reservation_id UUID REFERENCES public.reservations(id),
  subject VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general', -- general, refund, technical, dispute, billing
  priority ticket_priority NOT NULL DEFAULT 'medium',
  status ticket_status NOT NULL DEFAULT 'open',
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-generate ticket number
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number := 'TK-' || LPAD(NEXTVAL('ticket_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE ticket_seq START 1000;

CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL OR NEW.ticket_number = '')
  EXECUTE FUNCTION public.generate_ticket_number();

-- ═══════════════════════════════════════
-- AUDIT LOG
-- ═══════════════════════════════════════

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES public.profiles(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL, -- restaurant, user, reservation, payout, refund, config
  target_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_admin ON public.audit_logs(admin_user_id, created_at DESC);

-- ═══════════════════════════════════════
-- SYSTEM CONFIGURATION
-- ═══════════════════════════════════════

CREATE TABLE public.system_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general', -- general, fees, cities, notifications, features
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_configs_updated_at
  BEFORE UPDATE ON public.system_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════
-- FEATURE FLAGS
-- ═══════════════════════════════════════

CREATE TABLE public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════
-- CITIES & NEIGHBORHOODS
-- ═══════════════════════════════════════

CREATE TABLE public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  country VARCHAR(2) NOT NULL DEFAULT 'NG',
  is_active BOOLEAN NOT NULL DEFAULT false,
  neighborhoods JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
