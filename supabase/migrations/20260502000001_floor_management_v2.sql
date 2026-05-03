-- ============================================================
-- Floor Management Module v2 — production-grade
-- Versioned layouts, separate table_states, audit triggers, RLS
-- ============================================================

-- ── Floor Plans (versioned layouts) ──
CREATE TABLE IF NOT EXISTS public.floor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  width_px INTEGER NOT NULL DEFAULT 900 CHECK (width_px BETWEEN 200 AND 5000),
  height_px INTEGER NOT NULL DEFAULT 600 CHECK (height_px BETWEEN 200 AND 5000),
  background_color TEXT NOT NULL DEFAULT '#f5f5f4',
  created_by UUID REFERENCES auth.users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active plan per restaurant
CREATE UNIQUE INDEX IF NOT EXISTS one_active_plan_per_restaurant
  ON public.floor_plans (restaurant_id) WHERE is_active;

ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "floor_plans_select" ON public.floor_plans FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM public.restaurant_staff WHERE user_id = auth.uid()));

CREATE POLICY "floor_plans_write" ON public.floor_plans FOR ALL
  USING (restaurant_id IN (
    SELECT restaurant_id FROM public.restaurant_staff
    WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
  ));

-- ── Add floor_plan_id to tables (if not exists) ──
ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS floor_plan_id UUID REFERENCES public.floor_plans(id) ON DELETE CASCADE;

-- ── Table States (separate from layout) ──
CREATE TABLE IF NOT EXISTS public.table_states (
  table_id UUID PRIMARY KEY REFERENCES public.tables(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'free' CHECK (state IN ('free', 'reserved', 'seated', 'check_dropped', 'needs_bussing', 'out_of_service')),
  party_size INTEGER CHECK (party_size BETWEEN 0 AND 30),
  seated_at TIMESTAMPTZ,
  server_user_id UUID REFERENCES auth.users(id),
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_table_states_restaurant ON public.table_states (restaurant_id, state);

ALTER TABLE public.table_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "table_states_select" ON public.table_states FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM public.restaurant_staff WHERE user_id = auth.uid()));

CREATE POLICY "table_states_write" ON public.table_states FOR ALL
  USING (restaurant_id IN (
    SELECT restaurant_id FROM public.restaurant_staff
    WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'host')
  ));

-- Enable realtime on table_states
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_states;
ALTER PUBLICATION supabase_realtime ADD TABLE public.floor_plans;

-- ── Triggers: auto-increment version on update ──
CREATE OR REPLACE FUNCTION public.increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'table_states_version_trigger') THEN
    CREATE TRIGGER table_states_version_trigger
      BEFORE UPDATE ON public.table_states
      FOR EACH ROW EXECUTE FUNCTION public.increment_version();
  END IF;
END $$;

-- ── Audit log trigger for table_states ──
CREATE OR REPLACE FUNCTION public.audit_table_state_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (action, entity_type, entity_id, performed_by, details)
  VALUES (
    'state_change',
    'table_state',
    NEW.table_id,
    NEW.updated_by,
    jsonb_build_object(
      'before', jsonb_build_object('state', OLD.state, 'party_size', OLD.party_size),
      'after', jsonb_build_object('state', NEW.state, 'party_size', NEW.party_size),
      'restaurant_id', NEW.restaurant_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_table_state_trigger') THEN
    CREATE TRIGGER audit_table_state_trigger
      AFTER UPDATE ON public.table_states
      FOR EACH ROW
      WHEN (OLD.state IS DISTINCT FROM NEW.state)
      EXECUTE FUNCTION public.audit_table_state_change();
  END IF;
END $$;
