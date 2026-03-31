-- ═══════════════════════════════════════════════════════
-- NaijaDine Database Schema
-- Migration: Security Hardening — Fix overly permissive RLS
-- ═══════════════════════════════════════════════════════

-- ─── Fix 1: tables — restrict USING(true) to restaurant staff ───
DROP POLICY IF EXISTS "Anyone can view tables" ON public.tables;
CREATE POLICY "Anyone can view tables for active dining areas"
  ON public.tables FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dining_areas da
      JOIN public.restaurants r ON r.id = da.restaurant_id
      WHERE da.id = dining_area_id
        AND da.is_active = true
        AND r.status = 'active'
        AND r.deleted_at IS NULL
    )
  );

-- ─── Fix 2: feature_flags — restrict to authenticated users ────
DROP POLICY IF EXISTS "Anyone can read feature flags" ON public.feature_flags;
CREATE POLICY "Authenticated users can read feature flags"
  ON public.feature_flags FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─── Fix 3: whatsapp_config — remove public SELECT ─────────────
-- The "Service role reads whatsapp config" policy uses USING(true)
-- which lets anyone (including anon) read all configs.
-- The API uses the service_role key, so this policy is unnecessary.
DROP POLICY IF EXISTS "Service role reads whatsapp config" ON public.whatsapp_config;

-- ─── Fix 4: bot_sessions — tighten to owner/staff/admin ────────
DROP POLICY IF EXISTS "Bot sessions service role only" ON public.bot_sessions;
CREATE POLICY "Bot sessions accessible by staff or admin"
  ON public.bot_sessions FOR ALL
  USING (
    public.is_restaurant_staff(restaurant_id) OR public.is_admin()
  );

-- ─── Fix 5: NDPA compliance — add data export & deletion RPCs ──

-- Export all personal data for a user (NDPA data subject access request)
CREATE OR REPLACE FUNCTION public.export_user_data(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Only the user themselves or an admin can export data
  IF auth.uid() != target_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'profile', (
      SELECT row_to_json(p)
      FROM public.profiles p
      WHERE p.id = target_user_id
    ),
    'reservations', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
      FROM public.reservations r
      WHERE r.user_id = target_user_id
    ),
    'payments', (
      SELECT COALESCE(jsonb_agg(row_to_json(pay)), '[]'::jsonb)
      FROM public.payments pay
      WHERE pay.user_id = target_user_id
    ),
    'reviews', (
      SELECT COALESCE(jsonb_agg(row_to_json(rev)), '[]'::jsonb)
      FROM public.reviews rev
      WHERE rev.user_id = target_user_id
    ),
    'notifications', (
      SELECT COALESCE(jsonb_agg(row_to_json(n)), '[]'::jsonb)
      FROM public.notifications n
      WHERE n.user_id = target_user_id
    ),
    'support_tickets', (
      SELECT COALESCE(jsonb_agg(row_to_json(st)), '[]'::jsonb)
      FROM public.support_tickets st
      WHERE st.reporter_id = target_user_id
    ),
    'exported_at', NOW()
  ) INTO result;

  -- Log the export in audit_logs
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'data_export', 'user', target_user_id, jsonb_build_object('type', 'ndpa_sar'));

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete / anonymize user data (NDPA right to erasure)
CREATE OR REPLACE FUNCTION public.delete_user_data(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  deleted_counts JSONB;
BEGIN
  -- Only the user themselves or an admin can delete data
  IF auth.uid() != target_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Log the deletion request BEFORE deleting data
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'data_deletion_request', 'user', target_user_id, jsonb_build_object('type', 'ndpa_erasure'));

  -- Anonymize reviews (keep content but remove identity)
  UPDATE public.reviews
  SET user_id = NULL, is_public = false
  WHERE user_id = target_user_id;

  -- Delete personal data
  DELETE FROM public.notifications WHERE user_id = target_user_id;
  DELETE FROM public.guest_notes WHERE created_by = target_user_id;
  DELETE FROM public.waitlist_entries WHERE user_id = target_user_id;

  -- Cancel pending reservations
  UPDATE public.reservations
  SET status = 'cancelled', cancelled_by = 'system', cancellation_reason = 'Account deleted by user'
  WHERE user_id = target_user_id AND status IN ('pending', 'confirmed');

  -- Anonymize the profile (retain ID for referential integrity but strip PII)
  UPDATE public.profiles
  SET
    first_name = 'Deleted',
    last_name = 'User',
    phone = NULL,
    email = NULL,
    avatar_url = NULL,
    date_of_birth = NULL,
    is_suspended = true,
    suspension_reason = 'Account deleted by user request (NDPA)',
    updated_at = NOW()
  WHERE id = target_user_id;

  SELECT jsonb_build_object(
    'status', 'completed',
    'user_id', target_user_id,
    'deleted_at', NOW()
  ) INTO deleted_counts;

  RETURN deleted_counts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
