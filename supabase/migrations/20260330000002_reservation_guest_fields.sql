-- Add guest info columns to reservations for dashboard display and manual bookings
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS guest_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255);
