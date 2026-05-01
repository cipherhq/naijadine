-- ============================================================
-- Ensure all platform-configurable values exist in system_configs
-- Admin can update these from the dashboard
-- ============================================================

INSERT INTO public.system_configs (key, value, category, description) VALUES
  ('free_tier_booking_limit', '50', 'tiers', 'Max monthly bookings for free tier restaurants'),
  ('starter_tier_booking_limit', '100', 'tiers', 'Max monthly bookings for starter tier restaurants'),
  ('standard_tier_price', '25000', 'tiers', 'Monthly price in Naira for standard tier'),
  ('premium_tier_price', '75000', 'tiers', 'Monthly price in Naira for premium tier'),
  ('wa_starter_tier_price', '15000', 'tiers', 'Monthly price for WhatsApp starter tier'),
  ('wa_professional_tier_price', '35000', 'tiers', 'Monthly price for WhatsApp professional tier'),
  ('default_deposit_per_guest', '2000', 'bookings', 'Default deposit per guest in Naira'),
  ('default_cancellation_window_hours', '4', 'bookings', 'Default hours before booking for free cancellation'),
  ('default_max_party_size', '20', 'bookings', 'Maximum party size per reservation'),
  ('default_advance_booking_days', '30', 'bookings', 'Maximum days in advance a booking can be made'),
  ('slot_duration_minutes', '120', 'bookings', 'Default dining slot duration in minutes'),
  ('walk_in_ratio_default', '60', 'bookings', 'Default percentage of capacity reserved for walk-ins'),
  ('no_show_suspension_days', '30', 'moderation', 'Days of suspension after reaching no-show strike limit'),
  ('bank_change_hold_hours', '48', 'finance', 'Hold period after bank account change before payouts resume'),
  ('whatsapp_marketing_cap_per_week', '2', 'notifications', 'Max marketing WhatsApp messages per user per week')
ON CONFLICT (key) DO NOTHING;
