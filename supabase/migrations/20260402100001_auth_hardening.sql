-- ═══════════════════════════════════════
-- AUTH HARDENING MIGRATION
-- Adds role hierarchy enforcement, enum validation,
-- and audit log INSERT policy with actor binding.
-- ═══════════════════════════════════════

-- 1. is_super_admin() helper
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- 2. Trigger: enforce role-change hierarchy on profiles
CREATE OR REPLACE FUNCTION public.enforce_role_change_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changer_id UUID;
  changer_role user_role;
BEGIN
  -- Only fire when role actually changes
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  changer_id := auth.uid();

  -- Allow service_role / server-side operations (no auth context)
  IF changer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up the role of the person making the change
  SELECT role INTO changer_role
  FROM public.profiles
  WHERE id = changer_id;

  -- Allow self-upgrade from diner to restaurant_owner (onboarding flow)
  IF changer_id = OLD.id
     AND OLD.role = 'diner'
     AND NEW.role = 'restaurant_owner'
  THEN
    RETURN NEW;
  END IF;

  -- Non-admins cannot change roles beyond the self-upgrade above
  IF changer_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;

  -- Regular admins cannot promote to or demote from admin/super_admin
  IF changer_role = 'admin' THEN
    IF OLD.role IN ('admin', 'super_admin') OR NEW.role IN ('admin', 'super_admin') THEN
      RAISE EXCEPTION 'Only super_admins can change admin-level roles';
    END IF;
  END IF;

  -- Only super_admins can touch the super_admin role
  IF changer_role != 'super_admin' THEN
    IF OLD.role = 'super_admin' OR NEW.role = 'super_admin' THEN
      RAISE EXCEPTION 'Only super_admins can assign or revoke the super_admin role';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_role_change ON public.profiles;
CREATE TRIGGER trg_enforce_role_change
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_role_change_hierarchy();

-- 3. Trigger: enforce restaurant status enum values
CREATE OR REPLACE FUNCTION public.enforce_restaurant_status_enum()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The column uses the restaurant_status enum type, so Postgres already
  -- rejects invalid values. This trigger adds a friendlier error message
  -- and ensures only admins can change status via client calls.
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Allow service_role / server-side operations (webhooks, onboarding verify, etc.)
  -- These have no auth.uid() because they bypass user-level auth.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Authenticated users must be admins to change restaurant status
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change restaurant status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_restaurant_status ON public.restaurants;
CREATE TRIGGER trg_enforce_restaurant_status
  BEFORE UPDATE OF status ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_restaurant_status_enum();

-- 4. Audit logs INSERT policy — admins only, user_id must match auth.uid()
DO $$
BEGIN
  -- Drop any existing insert policy
  DROP POLICY IF EXISTS "admins_insert_audit_logs" ON public.audit_logs;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

CREATE POLICY "admins_insert_audit_logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (
    public.is_admin()
    AND (
      -- If admin_user_id column is provided, it must match the caller
      admin_user_id IS NULL OR admin_user_id = auth.uid()
    )
  );
