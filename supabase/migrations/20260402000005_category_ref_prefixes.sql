-- ============================================================
-- Category-specific reference ID prefixes
-- Reservation refs: category prefix + 4-digit random
-- Order refs: category prefix + 4-digit random
-- ============================================================

-- Reservation reference codes (service categories)
CREATE OR REPLACE FUNCTION public.generate_reference_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code VARCHAR(10);
  code_exists BOOLEAN;
  cat TEXT;
  prefix TEXT;
BEGIN
  -- Look up the business category from the restaurant
  SELECT r.business_category INTO cat
  FROM public.restaurants r
  WHERE r.id = NEW.restaurant_id;

  -- Map category to prefix
  prefix := CASE cat
    WHEN 'barber'      THEN 'BAR'
    WHEN 'salon'       THEN 'SAL'
    WHEN 'spa'         THEN 'SPA'
    WHEN 'gym'         THEN 'GYM'
    WHEN 'car_wash'    THEN 'CWS'
    WHEN 'mechanic'    THEN 'MCH'
    WHEN 'hotel'       THEN 'HTL'
    WHEN 'clinic'      THEN 'CLN'
    WHEN 'tutor'       THEN 'TUT'
    WHEN 'photography' THEN 'PHT'
    WHEN 'cleaning'    THEN 'CLG'
    WHEN 'coworking'   THEN 'CWK'
    ELSE 'ND'
  END;

  LOOP
    new_code := prefix || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.reservations WHERE reference_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;

  NEW.reference_code := new_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Order reference codes (purchase categories)
CREATE OR REPLACE FUNCTION public.generate_order_reference_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code VARCHAR(10);
  code_exists BOOLEAN;
  cat TEXT;
  prefix TEXT;
BEGIN
  -- Look up the business category from the restaurant
  SELECT r.business_category INTO cat
  FROM public.restaurants r
  WHERE r.id = NEW.restaurant_id;

  -- Map category to prefix
  prefix := CASE cat
    WHEN 'beauty'     THEN 'BTY'
    WHEN 'laundry'    THEN 'LDY'
    WHEN 'catering'   THEN 'CTR'
    WHEN 'tailor'     THEN 'TLR'
    WHEN 'printing'   THEN 'PRT'
    WHEN 'logistics'  THEN 'LGS'
    WHEN 'bakery'     THEN 'BKR'
    WHEN 'church'     THEN 'CHR'
    WHEN 'cinema'     THEN 'CIN'
    WHEN 'events'     THEN 'EVT'
    WHEN 'shop'       THEN 'SHP'
    ELSE 'FO'
  END;

  LOOP
    new_code := prefix || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.orders WHERE reference_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;

  NEW.reference_code := new_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
