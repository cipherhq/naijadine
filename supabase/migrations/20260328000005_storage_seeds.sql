-- ═══════════════════════════════════════════════════════
-- NaijaDine Database Schema
-- Migration: 005 - Storage Buckets & Seed Data
-- ═══════════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- STORAGE BUCKETS
-- ═══════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('restaurant-photos', 'restaurant-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('restaurant-documents', 'restaurant-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('menu-files', 'menu-files', true, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('invoices', 'invoices', false, 5242880, ARRAY['application/pdf']),
  ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- Storage policies
CREATE POLICY "Restaurant photos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'restaurant-photos');

CREATE POLICY "Authenticated users can upload restaurant photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'restaurant-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Document owners can view their documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'restaurant-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'restaurant-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Menu files are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-files');

CREATE POLICY "Authenticated users can upload menus"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'menu-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Invoice access restricted to authenticated users"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'invoices' AND auth.uid() IS NOT NULL);

CREATE POLICY "Avatar upload by owner"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "Avatars are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- ═══════════════════════════════════════
-- SEED DATA: Cities & Neighborhoods
-- ═══════════════════════════════════════

INSERT INTO public.cities (name, country, is_active, neighborhoods, sort_order) VALUES
  ('Lagos', 'NG', true, '["Victoria Island", "Ikoyi", "Lekki Phase 1", "Lekki Phase 2", "Ikeja GRA", "Yaba", "Surulere", "Ajah", "Maryland", "Magodo"]'::jsonb, 1),
  ('Abuja', 'NG', true, '["Wuse", "Wuse 2", "Maitama", "Garki", "Asokoro", "Jabi", "Gwarinpa", "Utako", "Central Area", "Katampe"]'::jsonb, 2),
  ('Port Harcourt', 'NG', true, '["GRA Phase 1", "GRA Phase 2", "Trans-Amadi", "Old GRA", "Rumuola", "Elekahia", "Rumuokwurusi", "Peter Odili Road"]'::jsonb, 3),
  ('Ibadan', 'NG', false, '["Bodija", "Ring Road", "Dugbe", "UI Area", "Oluyole", "Challenge"]'::jsonb, 4),
  ('Enugu', 'NG', false, '["Independence Layout", "New Haven", "GRA", "Trans-Ekulu", "Achara Layout"]'::jsonb, 5);

-- ═══════════════════════════════════════
-- SEED DATA: System Configuration
-- ═══════════════════════════════════════

INSERT INTO public.system_configs (key, value, category, description) VALUES
  ('commission_rate', '10.00', 'fees', 'Platform commission rate on deal-driven bookings (percentage)'),
  ('vat_rate', '7.50', 'fees', 'Nigerian VAT rate (percentage)'),
  ('saas_standard_price', '25000', 'fees', 'Standard SaaS tier monthly price in Naira'),
  ('saas_premium_price', '75000', 'fees', 'Premium SaaS tier monthly price in Naira'),
  ('wa_starter_price', '15000', 'fees', 'WhatsApp Standalone Starter monthly price in Naira'),
  ('wa_professional_price', '35000', 'fees', 'WhatsApp Standalone Professional monthly price in Naira'),
  ('no_show_strike_limit', '4', 'general', 'Number of no-shows before automatic account suspension'),
  ('no_show_rolling_months', '12', 'general', 'Rolling window in months for no-show counting'),
  ('max_party_size', '20', 'general', 'Maximum party size for a single reservation'),
  ('referral_credit_amount', '500', 'general', 'Referral reward in Naira'),
  ('welcome_credit_amount', '1000', 'general', 'Welcome credit for new diners in Naira'),
  ('payout_cycle_days', '15', 'finance', 'Days per payout cycle (bi-monthly)'),
  ('bank_change_hold_hours', '48', 'finance', 'Hold period in hours after bank account change'),
  ('whatsapp_marketing_cap', '2', 'notifications', 'Maximum marketing WhatsApp messages per user per week'),
  ('booking_reference_prefix', '"ND"', 'general', 'Prefix for booking reference codes');

-- ═══════════════════════════════════════
-- SEED DATA: Feature Flags
-- ═══════════════════════════════════════

INSERT INTO public.feature_flags (key, description, is_enabled) VALUES
  ('whatsapp_booking', 'WhatsApp chatbot booking flow', true),
  ('loyalty_program', 'Points and tier system for diners', false),
  ('split_payment', 'Group bill splitting via Paystack', false),
  ('ussd_booking', 'USSD-based booking for feature phones', false),
  ('ai_recommendations', 'ML-based restaurant suggestions', false),
  ('multi_language', 'Yoruba, Hausa, Igbo language support', false),
  ('whatsapp_standalone', 'WhatsApp Standalone product available for signup', true),
  ('deal_engine', 'Time-based discount system', false),
  ('review_public', 'Allow public reviews (vs restaurant-only)', false),
  ('pos_integration', 'POS system integration for restaurants', false);

-- ═══════════════════════════════════════
-- SEED DATA: Notification Templates
-- ═══════════════════════════════════════

INSERT INTO public.notification_templates (name, channel, subject, body, whatsapp_template_name) VALUES
  ('booking_confirmation_wa', 'whatsapp', NULL, 'Your table at {{restaurant}} on {{date}} at {{time}} for {{guests}} guests is confirmed! Ref: {{ref}}', 'booking_confirmation'),
  ('booking_confirmation_email', 'email', 'Booking Confirmed — {{restaurant}}', 'Hi {{first_name}}, your reservation at {{restaurant}} is confirmed for {{date}} at {{time}} for {{guests}} guests. Reference: {{ref}}.', NULL),
  ('reminder_24h_wa', 'whatsapp', NULL, 'Reminder: your reservation at {{restaurant}} is tomorrow at {{time}}. Reply CONFIRM or CANCEL.', 'reminder_24h'),
  ('reminder_2h_wa', 'whatsapp', NULL, 'Your table at {{restaurant}} is ready in 2 hours! Directions: {{maps_link}}', 'reminder_2h'),
  ('booking_cancelled_wa', 'whatsapp', NULL, 'Your booking {{ref}} at {{restaurant}} has been cancelled. {{refund_info}}', 'booking_cancelled'),
  ('no_show_warning_wa', 'whatsapp', NULL, 'You missed your reservation at {{restaurant}}. Deposit of {{amount}} forfeited. Strike {{count}}/4.', 'no_show_warning'),
  ('feedback_request_wa', 'whatsapp', NULL, 'How was your experience at {{restaurant}}? Rate 1-5 below.', 'feedback_request'),
  ('welcome_wa', 'whatsapp', NULL, 'Welcome to DineRoot! Discover 500+ restaurants in Lagos, Abuja & PH. Start: {{link}}', 'welcome_message'),
  ('welcome_email', 'email', 'Welcome to DineRoot 🍽️', 'Hi {{first_name}}, welcome to DineRoot! Your ₦1,000 welcome credit is ready. Explore restaurants: {{link}}', NULL),
  ('payment_receipt_wa', 'whatsapp', NULL, 'Payment confirmed: {{amount}} for {{restaurant}} on {{date}}. Ref: {{ref}}', 'payment_receipt'),
  ('payout_confirmation_wa', 'whatsapp', NULL, 'Payout of {{amount}} sent to {{bank}} ****{{last4}}. Ref: {{ref}}', 'payout_confirmation'),
  ('payout_confirmation_email', 'email', 'Payout Processed — DineRoot', 'Your payout of {{amount}} has been sent to {{bank}} ****{{last4}}. Transfer ref: {{ref}}.', NULL),
  ('deal_alert_wa', 'whatsapp', NULL, '{{restaurant}} has {{discount}}% off this {{period}}! Book now: {{link}}', 'deal_alert'),
  ('restaurant_approved_email', 'email', 'Welcome to DineRoot — You''re Approved!', 'Congratulations! {{restaurant}} is now live on DineRoot. Log in to your dashboard: {{link}}', NULL),
  ('weekly_digest_email', 'email', 'Your Weekly Performance — {{restaurant}}', 'This week: {{covers}} covers, {{bookings}} bookings, {{no_show_rate}}% no-show rate, {{revenue}} revenue.', NULL);
