-- ============================================================
-- Add increment_total_bookings RPC
-- Called by the API after a reservation is created
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_total_bookings(restaurant_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.restaurants
  SET total_bookings = total_bookings + 1
  WHERE id = restaurant_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
