-- ═══════════════════════════════════════════════════════
-- NaijaDine Database Schema
-- Migration: 012 - Food Ordering via WhatsApp
-- ═══════════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- NEW ENUMS
-- ═══════════════════════════════════════

CREATE TYPE order_status AS ENUM (
  'cart', 'pending_payment', 'confirmed', 'preparing',
  'ready', 'picked_up', 'delivered', 'cancelled'
);

CREATE TYPE order_type AS ENUM ('pickup', 'delivery');

-- ═══════════════════════════════════════
-- ALTER RESTAURANTS — add delivery_fee
-- ═══════════════════════════════════════

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS delivery_fee INTEGER DEFAULT NULL;
  -- NULL = no delivery, 0 = free delivery, >0 = fee in Naira

-- ═══════════════════════════════════════
-- MENU CATEGORIES
-- ═══════════════════════════════════════

CREATE TABLE public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_menu_categories_updated_at
  BEFORE UPDATE ON public.menu_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_menu_categories_restaurant
  ON public.menu_categories(restaurant_id, sort_order)
  WHERE is_active = true;

-- ═══════════════════════════════════════
-- MENU ITEMS
-- ═══════════════════════════════════════

CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price INTEGER NOT NULL, -- in Naira
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_menu_items_category
  ON public.menu_items(category_id, sort_order)
  WHERE is_available = true;

CREATE INDEX idx_menu_items_restaurant
  ON public.menu_items(restaurant_id)
  WHERE is_available = true;

-- ═══════════════════════════════════════
-- ORDERS
-- ═══════════════════════════════════════

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code VARCHAR(10) UNIQUE NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  order_type order_type NOT NULL DEFAULT 'pickup',
  status order_status NOT NULL DEFAULT 'pending_payment',
  subtotal INTEGER NOT NULL DEFAULT 0,
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  delivery_address TEXT,
  special_instructions TEXT,
  payment_id UUID,
  customer_name VARCHAR(200),
  customer_phone VARCHAR(20),
  customer_email VARCHAR(255),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by VARCHAR(20), -- 'customer' | 'restaurant' | 'admin'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Order reference code trigger (FO-#### format)
CREATE OR REPLACE FUNCTION public.generate_order_reference_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code VARCHAR(10);
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'FO-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.orders WHERE reference_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  NEW.reference_code := new_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_reference_code
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.reference_code IS NULL OR NEW.reference_code = '')
  EXECUTE FUNCTION public.generate_order_reference_code();

-- Indexes
CREATE INDEX idx_orders_restaurant ON public.orders(restaurant_id, status);
CREATE INDEX idx_orders_user ON public.orders(user_id, created_at DESC);
CREATE INDEX idx_orders_reference ON public.orders USING hash(reference_code);
CREATE INDEX idx_orders_status ON public.orders(status);

-- ═══════════════════════════════════════
-- ORDER ITEMS
-- ═══════════════════════════════════════

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id),
  name VARCHAR(200) NOT NULL,
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total INTEGER NOT NULL
);

CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- ═══════════════════════════════════════
-- ALTER PAYMENTS — support orders
-- ═══════════════════════════════════════

-- Allow reservation_id to be NULL (orders don't have reservations)
ALTER TABLE public.payments ALTER COLUMN reservation_id DROP NOT NULL;

-- Add order_id column
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id);

-- Ensure payment references either a reservation or an order
ALTER TABLE public.payments ADD CONSTRAINT payments_must_reference_something
  CHECK (reservation_id IS NOT NULL OR order_id IS NOT NULL);

-- Add defaults for columns that the bot omits during insert
ALTER TABLE public.payments ALTER COLUMN gateway_status SET DEFAULT 'initialized';
ALTER TABLE public.payments ALTER COLUMN payment_method SET DEFAULT 'card';

-- ═══════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════

-- Menu Categories
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active menu categories"
  ON public.menu_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Staff can manage menu categories"
  ON public.menu_categories FOR ALL
  USING (public.is_restaurant_staff(restaurant_id));

-- Menu Items
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available menu items"
  ON public.menu_items FOR SELECT
  USING (is_available = true);

CREATE POLICY "Staff can manage menu items"
  ON public.menu_items FOR ALL
  USING (public.is_restaurant_staff(restaurant_id));

-- Orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view restaurant orders"
  ON public.orders FOR SELECT
  USING (public.is_restaurant_staff(restaurant_id));

CREATE POLICY "Staff can update restaurant orders"
  ON public.orders FOR UPDATE
  USING (public.is_restaurant_staff(restaurant_id));

CREATE POLICY "Admins can manage all orders"
  ON public.orders FOR ALL
  USING (public.is_admin());

-- Order Items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order items"
  ON public.order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own order items"
  ON public.order_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
  ));

CREATE POLICY "Staff can view restaurant order items"
  ON public.order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND public.is_restaurant_staff(orders.restaurant_id)
  ));

CREATE POLICY "Admins can manage all order items"
  ON public.order_items FOR ALL
  USING (public.is_admin());
