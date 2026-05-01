-- ============================================================
-- Ticket comments for support system
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by ticket
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id
  ON public.ticket_comments(ticket_id);

-- RLS
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

-- Users can see non-internal comments on their tickets
CREATE POLICY "Users can see their ticket comments"
  ON public.ticket_comments FOR SELECT
  USING (
    (NOT is_internal AND author_id = auth.uid())
    OR
    (NOT is_internal AND ticket_id IN (
      SELECT id FROM public.support_tickets WHERE reporter_id = auth.uid()
    ))
    OR
    public.is_admin()
  );

-- Users can add comments to their tickets
CREATE POLICY "Users can comment on their tickets"
  ON public.ticket_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      ticket_id IN (SELECT id FROM public.support_tickets WHERE reporter_id = auth.uid())
      OR public.is_admin()
    )
  );

-- Admins can manage all comments
CREATE POLICY "Admins can manage comments"
  ON public.ticket_comments FOR ALL
  USING (public.is_admin());
