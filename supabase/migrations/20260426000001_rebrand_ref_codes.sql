-- ============================================================
-- Rebrand: ND -> DR reference code prefix
-- Does NOT retroactively change existing codes
-- ============================================================

-- Update reservation reference code generator: default prefix ND -> DR
CREATE OR REPLACE FUNCTION public.generate_reference_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code VARCHAR(10);
  code_exists BOOLEAN;
  cat TEXT;
  prefix TEXT;
BEGIN
  SELECT r.business_category INTO cat
  FROM public.restaurants r
  WHERE r.id = NEW.restaurant_id;

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
    ELSE 'DR'
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
