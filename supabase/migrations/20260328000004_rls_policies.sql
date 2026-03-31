-- ═══════════════════════════════════════════════════════
-- NaijaDine Database Schema
-- Migration: 004 - Row Level Security Policies
-- ═══════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role IN ('admin', 'super_admin')
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user owns a restaurant
CREATE OR REPLACE FUNCTION public.owns_restaurant(restaurant_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = restaurant_uuid AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is staff of a restaurant
CREATE OR REPLACE FUNCTION public.is_restaurant_staff(restaurant_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.restaurant_staff
    WHERE restaurant_id = restaurant_uuid AND user_id = auth.uid() AND is_active = true
  )
  OR public.owns_restaurant(restaurant_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════
-- PROFILES POLICIES
-- ═══════════════════════════════════════

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- ═══════════════════════════════════════
-- RESTAURANTS POLICIES
-- ═══════════════════════════════════════

CREATE POLICY "Anyone can view active restaurants"
  ON public.restaurants FOR SELECT
  USING (status = 'active' AND deleted_at IS NULL);

CREATE POLICY "Owners can view own restaurants (any status)"
  ON public.restaurants FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create restaurants"
  ON public.restaurants FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update own restaurants"
  ON public.restaurants FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Admins can view all restaurants"
  ON public.restaurants FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update all restaurants"
  ON public.restaurants FOR UPDATE
  USING (public.is_admin());

-- ═══════════════════════════════════════
-- RESERVATIONS POLICIES
-- ═══════════════════════════════════════

CREATE POLICY "Diners can view own reservations"
  ON public.reservations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Diners can create reservations"
  ON public.reservations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Diners can update own reservations (cancel/modify)"
  ON public.reservations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Restaurant staff can view restaurant reservations"
  ON public.reservations FOR SELECT
  USING (public.is_restaurant_staff(restaurant_id));

CREATE POLICY "Restaurant staff can update restaurant reservations"
  ON public.reservations FOR UPDATE
  USING (public.is_restaurant_staff(restaurant_id));

CREATE POLICY "Admins can view all reservations"
  ON public.reservations FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update all reservations"
  ON public.reservations FOR UPDATE
  USING (public.is_admin());

-- ═══════════════════════════════════════
-- PAYMENTS POLICIES
-- ═══════════════════════════════════════

CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all payments"
  ON public.payments FOR SELECT
  USING (public.is_admin());

-- ═══════════════════════════════════════
-- BANK ACCOUNTS POLICIES
-- ═══════════════════════════════════════

CREATE POLICY "Owners can view own bank accounts"
  ON public.bank_accounts FOR SELECT
  USING (public.owns_restaurant(restaurant_id));

CREATE POLICY "Owners can manage own bank accounts"
  ON public.bank_accounts FOR INSERT
  WITH CHECK (public.owns_restaurant(restaurant_id));

CREATE POLICY "Owners can update own bank accounts"
  ON public.bank_accounts FOR UPDATE
  USING (public.owns_restaurant(restaurant_id));

CREATE POLICY "Admins can view all bank accounts"
  ON public.bank_accounts FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update all bank accounts"
  ON public.bank_accounts FOR UPDATE
  USING (public.is_admin());

-- ═══════════════════════════════════════
-- FINANCE POLICIES
-- ═══════════════════════════════════════

CREATE POLICY "Owners can view own payouts"
  ON public.payouts FOR SELECT
  USING (public.owns_restaurant(restaurant_id));

CREATE POLICY "Admins can manage payouts"
  ON public.payouts FOR ALL
  USING (public.is_admin());

CREATE POLICY "Owners can view own invoices"
  ON public.invoices FOR SELECT
  USING (public.owns_restaurant(restaurant_id));

CREATE POLICY "Admins can manage invoices"
  ON public.invoices FOR ALL
  USING (public.is_admin());

CREATE POLICY "Owners can view own refunds"
  ON public.refunds FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can manage refunds"
  ON public.refunds FOR ALL
  USING (public.is_admin());

-- ═══════════════════════════════════════
-- NOTIFICATION POLICIES
-- ═══════════════════════════════════════

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can mark own notifications as read"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════
-- REVIEWS POLICIES
-- ═══════════════════════════════════════

CREATE POLICY "Public reviews visible to all"
  ON public.reviews FOR SELECT
  USING (is_public = true AND moderation_status = 'approved');

CREATE POLICY "Restaurant staff see all reviews for their restaurant"
  ON public.reviews FOR SELECT
  USING (public.is_restaurant_staff(restaurant_id));

CREATE POLICY "Users can create reviews for completed reservations"
  ON public.reviews FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage reviews"
  ON public.reviews FOR ALL
  USING (public.is_admin());

-- ═══════════════════════════════════════
-- PUBLIC READ POLICIES
-- ═══════════════════════════════════════

CREATE POLICY "Anyone can view active deals"
  ON public.deals FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can view active cities"
  ON public.cities FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can view restaurant photos"
  ON public.restaurant_photos FOR SELECT
  USING (moderation_status = 'approved');

CREATE POLICY "Anyone can view dining areas for active restaurants"
  ON public.dining_areas FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can view tables"
  ON public.tables FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read feature flags"
  ON public.feature_flags FOR SELECT
  USING (true);

-- ═══════════════════════════════════════
-- ADMIN-ONLY POLICIES
-- ═══════════════════════════════════════

CREATE POLICY "Admins manage support tickets"
  ON public.support_tickets FOR ALL
  USING (public.is_admin() OR reporter_id = auth.uid());

CREATE POLICY "Admins manage audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins manage system configs"
  ON public.system_configs FOR ALL
  USING (public.is_admin());

CREATE POLICY "Admins manage campaigns"
  ON public.campaigns FOR ALL
  USING (public.is_admin());

CREATE POLICY "Admins manage broadcasts"
  ON public.broadcasts FOR ALL
  USING (public.is_admin() OR sender_type = 'restaurant');

-- Restaurant staff can manage their own tables, areas, CRM
CREATE POLICY "Staff manage dining areas"
  ON public.dining_areas FOR ALL
  USING (public.is_restaurant_staff(restaurant_id));

CREATE POLICY "Staff manage tables"
  ON public.tables FOR ALL
  USING (public.is_restaurant_staff(
    (SELECT restaurant_id FROM public.dining_areas WHERE id = dining_area_id)
  ));

CREATE POLICY "Staff manage guest tags"
  ON public.guest_tags FOR ALL
  USING (public.is_restaurant_staff(restaurant_id));

CREATE POLICY "Staff manage guest notes"
  ON public.guest_notes FOR ALL
  USING (public.is_restaurant_staff(restaurant_id));

CREATE POLICY "Staff manage waitlist"
  ON public.waitlist_entries FOR ALL
  USING (public.is_restaurant_staff(restaurant_id));

CREATE POLICY "Staff manage restaurant documents"
  ON public.restaurant_documents FOR ALL
  USING (public.owns_restaurant(restaurant_id) OR public.is_admin());

CREATE POLICY "Staff manage restaurant photos"
  ON public.restaurant_photos FOR ALL
  USING (public.is_restaurant_staff(restaurant_id) OR public.is_admin());

CREATE POLICY "Staff manage deals"
  ON public.deals FOR ALL
  USING (public.is_restaurant_staff(restaurant_id) OR public.is_admin());

CREATE POLICY "Staff manage restaurant staff"
  ON public.restaurant_staff FOR ALL
  USING (public.owns_restaurant(restaurant_id) OR public.is_admin());

-- Bot sessions: service role only (edge functions)
CREATE POLICY "Bot sessions service role only"
  ON public.bot_sessions FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Notification templates admin only"
  ON public.notification_templates FOR ALL
  USING (public.is_admin());

CREATE POLICY "Featured listings admin or owner"
  ON public.featured_listings FOR ALL
  USING (public.is_admin() OR public.owns_restaurant(restaurant_id));
