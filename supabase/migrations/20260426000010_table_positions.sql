-- ============================================================
-- Add x/y position and width/height to tables for floor plan
-- ============================================================

ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS x_position REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS y_position REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS width REAL NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS height REAL NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS rotation REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS reservation_id UUID REFERENCES public.reservations(id);
