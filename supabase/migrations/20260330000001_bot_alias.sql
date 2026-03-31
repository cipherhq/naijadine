-- Add bot_alias column for restaurant bot persona names
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS bot_alias VARCHAR(50) DEFAULT NULL;
