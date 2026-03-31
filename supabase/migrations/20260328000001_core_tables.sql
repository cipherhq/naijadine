-- ═══════════════════════════════════════════════════════
-- NaijaDine Database Schema
-- Migration: 001 - Core Tables (Users, Restaurants)
-- ═══════════════════════════════════════════════════════

-- Enable required extensions
-- gen_random_uuid() is native in Postgres 17+, no extension needed
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ═══════════════════════════════════════
-- ENUM TYPES
-- ═══════════════════════════════════════

CREATE TYPE user_role AS ENUM ('diner', 'restaurant_owner', 'restaurant_staff', 'admin', 'super_admin');
CREATE TYPE loyalty_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum');
CREATE TYPE restaurant_status AS ENUM ('pending', 'approved', 'active', 'suspended', 'churned');
CREATE TYPE restaurant_tier AS ENUM ('free', 'standard', 'premium');
CREATE TYPE product_type AS ENUM ('marketplace', 'whatsapp_standalone');
CREATE TYPE whatsapp_plan AS ENUM ('starter', 'professional', 'enterprise');
CREATE TYPE price_range AS ENUM ('budget', 'moderate', 'upscale', 'fine_dining');
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled');
CREATE TYPE booking_type AS ENUM ('instant', 'request');
CREATE TYPE booking_channel AS ENUM ('app', 'web', 'whatsapp', 'phone', 'walk_in');
CREATE TYPE deposit_status AS ENUM ('none', 'pending', 'paid', 'refunded', 'forfeited');
CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'refunded');
CREATE TYPE payment_gateway AS ENUM ('paystack', 'flutterwave');
CREATE TYPE payment_method AS ENUM ('card', 'bank_transfer', 'ussd', 'mobile_wallet');
CREATE TYPE table_status AS ENUM ('available', 'reserved', 'occupied', 'clearing', 'blocked');
CREATE TYPE table_shape AS ENUM ('rectangle', 'round', 'square');
CREATE TYPE refund_type AS ENUM ('auto_approved', 'restaurant_fault', 'system_error', 'dispute', 'policy_exception');
CREATE TYPE refund_status AS ENUM ('pending', 'approved', 'processing', 'completed', 'rejected');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'on_hold');
CREATE TYPE bank_account_status AS ENUM ('pending', 'verified', 'change_requested', 'suspended');
CREATE TYPE invoice_type AS ENUM ('saas_subscription', 'commission', 'featured_listing');
CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'overdue', 'void');
CREATE TYPE notification_type AS ENUM ('booking_confirmation', 'reminder_24h', 'reminder_2h', 'post_dining', 'deal', 'broadcast', 'system', 'payment', 'payout', 'welcome', 'no_show_warning', 'account_suspended', 'review_request', 'loyalty_upgrade', 'referral_reward');
CREATE TYPE notification_channel AS ENUM ('whatsapp', 'sms', 'email', 'push', 'in_app');
CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'delivered', 'failed', 'read');
CREATE TYPE broadcast_sender AS ENUM ('admin', 'restaurant');
CREATE TYPE broadcast_audience AS ENUM ('all_diners', 'city', 'segment', 'restaurant_guests', 'all_restaurants');
CREATE TYPE broadcast_status AS ENUM ('draft', 'scheduled', 'sending', 'completed', 'cancelled');
CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'rejected', 'flagged');
CREATE TYPE document_type AS ENUM ('cac_certificate', 'health_certificate', 'business_license', 'menu_pdf', 'other');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE cancelled_by AS ENUM ('diner', 'restaurant', 'system');

-- ═══════════════════════════════════════
-- PROFILES TABLE (extends Supabase Auth)
-- ═══════════════════════════════════════

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(255),
  first_name VARCHAR(100) NOT NULL DEFAULT '',
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  avatar_url TEXT,
  city VARCHAR(50),
  role user_role NOT NULL DEFAULT 'diner',
  loyalty_tier loyalty_tier NOT NULL DEFAULT 'bronze',
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  no_show_count INTEGER NOT NULL DEFAULT 0,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  suspension_reason TEXT,
  dietary_preferences JSONB NOT NULL DEFAULT '[]'::jsonb,
  notification_prefs JSONB NOT NULL DEFAULT '{"whatsapp": true, "sms": true, "email": true, "push": true}'::jsonb,
  referral_code VARCHAR(10) UNIQUE,
  referred_by UUID REFERENCES public.profiles(id),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, email)
  VALUES (
    NEW.id,
    NEW.phone,
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════
-- RESTAURANTS
-- ═══════════════════════════════════════

CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) UNIQUE NOT NULL,
  description TEXT,
  cuisine_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  address TEXT NOT NULL,
  city VARCHAR(50) NOT NULL,
  neighborhood VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  status restaurant_status NOT NULL DEFAULT 'pending',
  tier restaurant_tier NOT NULL DEFAULT 'free',
  product_type product_type NOT NULL DEFAULT 'marketplace',
  whatsapp_plan whatsapp_plan,
  is_whitelabel BOOLEAN NOT NULL DEFAULT false,
  operating_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_range price_range NOT NULL DEFAULT 'moderate',
  avg_price_per_person INTEGER,
  deposit_per_guest INTEGER NOT NULL DEFAULT 0,
  cancellation_window_hours INTEGER NOT NULL DEFAULT 4,
  max_advance_booking_days INTEGER NOT NULL DEFAULT 30,
  walk_in_ratio INTEGER NOT NULL DEFAULT 60,
  rating_avg DECIMAL(2, 1) NOT NULL DEFAULT 0.0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  total_bookings INTEGER NOT NULL DEFAULT 0,
  logo_url TEXT,
  cover_photo_url TEXT,
  menu_url TEXT,
  instagram_handle VARCHAR(100),
  gupshup_app_id VARCHAR(100),
  whatsapp_phone_number_id VARCHAR(50),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes
CREATE INDEX idx_restaurants_city_neighborhood ON public.restaurants(city, neighborhood) WHERE deleted_at IS NULL;
CREATE INDEX idx_restaurants_status ON public.restaurants(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_restaurants_slug ON public.restaurants USING hash(slug);
CREATE INDEX idx_restaurants_owner ON public.restaurants(owner_id);
CREATE INDEX idx_restaurants_product_type ON public.restaurants(product_type);
CREATE INDEX idx_restaurants_name_trgm ON public.restaurants USING gin(name gin_trgm_ops);

-- ═══════════════════════════════════════
-- RESTAURANT STAFF
-- ═══════════════════════════════════════

CREATE TABLE public.restaurant_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'host', -- owner, manager, host, server
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, user_id)
);

-- ═══════════════════════════════════════
-- RESTAURANT DOCUMENTS
-- ═══════════════════════════════════════

CREATE TABLE public.restaurant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  type document_type NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size INTEGER,
  verification_status moderation_status NOT NULL DEFAULT 'pending',
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- RESTAURANT PHOTOS
-- ═══════════════════════════════════════

CREATE TABLE public.restaurant_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  type VARCHAR(20) NOT NULL DEFAULT 'interior', -- interior, food, menu, exterior, ambiance
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  moderation_status moderation_status NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- DINING AREAS & TABLES
-- ═══════════════════════════════════════

CREATE TABLE public.dining_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dining_area_id UUID NOT NULL REFERENCES public.dining_areas(id) ON DELETE CASCADE,
  table_number VARCHAR(20) NOT NULL,
  min_seats INTEGER NOT NULL DEFAULT 1,
  max_seats INTEGER NOT NULL,
  shape table_shape NOT NULL DEFAULT 'rectangle',
  position_x INTEGER,
  position_y INTEGER,
  status table_status NOT NULL DEFAULT 'available',
  is_combinable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Realtime on tables for dashboard live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
