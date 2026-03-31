-- WhatsApp Bot Configuration per Restaurant
-- Supports white-label greetings and message templates

CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  bot_greeting TEXT NOT NULL DEFAULT 'Welcome! Let''s book you a table.',
  bot_confirmation_template TEXT NOT NULL DEFAULT '✅ Booking Confirmed!\n\n🍽️ {restaurant_name}\n📅 {date}\n🕐 {time}\n👥 {party_size} guests\n🔑 Ref: {reference_code}',
  bot_reminder_template TEXT NOT NULL DEFAULT '⏰ Reminder\n\nYour reservation at {restaurant_name} is tomorrow at {time} for {party_size} guests.\n\nRef: {reference_code}',
  auto_confirm BOOLEAN NOT NULL DEFAULT true,
  welcome_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policies
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Restaurant owners can read/write their own config
CREATE POLICY "Restaurant owners manage own whatsapp config"
  ON public.whatsapp_config
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

-- Admins can manage all configs
CREATE POLICY "Admins manage all whatsapp configs"
  ON public.whatsapp_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Service role (API) can read for bot processing
CREATE POLICY "Service role reads whatsapp config"
  ON public.whatsapp_config
  FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX idx_whatsapp_config_restaurant ON public.whatsapp_config(restaurant_id);

-- Update trigger
CREATE TRIGGER update_whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
