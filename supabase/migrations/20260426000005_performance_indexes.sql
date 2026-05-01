-- ============================================================
-- Performance indexes for common query patterns
-- ============================================================

-- Reservation availability lookups (restaurant + date + time)
CREATE INDEX IF NOT EXISTS idx_reservations_availability
  ON public.reservations(restaurant_id, date, time)
  WHERE status NOT IN ('cancelled', 'no_show');

-- Reservation listing by user (for account page)
CREATE INDEX IF NOT EXISTS idx_reservations_user_date
  ON public.reservations(user_id, date DESC);

-- Orders by restaurant and status
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status
  ON public.orders(restaurant_id, status);

-- Payments by reservation (for payout calculation)
CREATE INDEX IF NOT EXISTS idx_payments_reservation
  ON public.payments(reservation_id)
  WHERE status = 'success';

-- Reviews by restaurant (for public listing)
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_public
  ON public.reviews(restaurant_id, created_at DESC)
  WHERE is_public = true AND moderation_status = 'approved';

-- Bot sessions active lookup
CREATE INDEX IF NOT EXISTS idx_bot_sessions_active
  ON public.bot_sessions(whatsapp_number)
  WHERE is_active = true;

-- Notifications by user (for in-app feed)
CREATE INDEX IF NOT EXISTS idx_notifications_user_channel
  ON public.notifications(user_id, created_at DESC)
  WHERE channel = 'in_app';
