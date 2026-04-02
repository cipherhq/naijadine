-- Seed 17 test businesses for new business categories
-- Each business gets menu categories and menu items for WhatsApp bot testing

DO $$
DECLARE
  test_owner UUID;
  biz_id UUID;
  cat_id UUID;
BEGIN
  -- Use first admin profile as owner (reuse existing from prior seed)
  SELECT id INTO test_owner FROM profiles WHERE role IN ('admin', 'super_admin') LIMIT 1;
  IF test_owner IS NULL THEN
    -- Check if auth user with this phone already exists
    SELECT id INTO test_owner FROM auth.users WHERE phone = '+2340000000000';
    IF test_owner IS NULL THEN
      test_owner := gen_random_uuid();
      INSERT INTO auth.users (id, phone, phone_confirmed_at, created_at, updated_at)
      VALUES (test_owner, '+2340000000000', NOW(), NOW(), NOW());
    END IF;
    INSERT INTO profiles (id, phone, first_name, last_name, role)
    VALUES (test_owner, '+2340000000000', 'Test', 'Admin', 'admin')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ═══════════════════════════════════════
  -- TEST-BARBER: King's Cutz Barbershop
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest
  ) VALUES (
    gen_random_uuid(), test_owner, 'King''s Cutz Barbershop', 'kings-cutz-barbershop',
    'Premium barbershop in Lagos',
    '[]'::jsonb, '10 Opebi Road, Ikeja', 'lagos', 'Ikeja',
    '+2341000007', 'active', 'free', 'whatsapp_standalone', 'barber', 'TEST-BARBER', 0
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Haircuts', 'Fresh cuts for every style', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Buzz Cut', 'Clean low buzz', 1500, 1),
    (cat_id, biz_id, 'Low Cut', 'Classic low cut', 2000, 2),
    (cat_id, biz_id, 'Fade', 'Sharp skin fade', 2500, 3),
    (cat_id, biz_id, 'Design Cut', 'Custom design cut', 3500, 4);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Beard', 'Beard grooming services', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Beard Trim', 'Quick beard trim', 1000, 1),
    (cat_id, biz_id, 'Beard Shape', 'Beard shaping & lineup', 1500, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Combos', 'Cut + beard packages', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Cut + Beard', 'Haircut and beard trim combo', 3000, 1),
    (cat_id, biz_id, 'VIP Package', 'Full grooming experience', 5000, 2);

  -- ═══════════════════════════════════════
  -- TEST-SALON: GlamHair Studio
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest
  ) VALUES (
    gen_random_uuid(), test_owner, 'GlamHair Studio', 'glamhair-studio',
    'Premium hair salon in Lagos',
    '[]'::jsonb, '5 Awolowo Road, Ikoyi', 'lagos', 'Ikoyi',
    '+2341000008', 'active', 'free', 'whatsapp_standalone', 'salon', 'TEST-SALON', 0
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Styling', 'Hair styling services', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Wash & Set', 'Shampoo and style', 3000, 1),
    (cat_id, biz_id, 'Braids', 'Box braids or twist', 5000, 2),
    (cat_id, biz_id, 'Cornrows', 'Traditional cornrow styling', 4000, 3),
    (cat_id, biz_id, 'Silk Press', 'Smooth silk press blowout', 8000, 4);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Treatments', 'Hair treatments', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Deep Conditioning', 'Intensive moisture treatment', 4000, 1),
    (cat_id, biz_id, 'Keratin Treatment', 'Smoothing keratin treatment', 15000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Extensions', 'Hair extensions & wigs', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Wig Install', 'Full wig installation', 10000, 1),
    (cat_id, biz_id, 'Weave-On', 'Full weave-on install', 8000, 2);

  -- ═══════════════════════════════════════
  -- TEST-BEAUTY: Slay Queen Beauty Store
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest, delivery_fee
  ) VALUES (
    gen_random_uuid(), test_owner, 'Slay Queen Beauty Store', 'slay-queen-beauty',
    'Beauty products and accessories',
    '[]'::jsonb, '12 Adeniran Ogunsanya, Surulere', 'lagos', 'Surulere',
    '+2341000009', 'active', 'free', 'whatsapp_standalone', 'beauty', 'TEST-BEAUTY', 0, 1500
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Wigs', 'Premium wigs', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Bob Wig', 'Short bob style wig', 15000, 1),
    (cat_id, biz_id, 'Frontal Wig', 'Lace frontal wig', 35000, 2),
    (cat_id, biz_id, 'HD Lace Wig', 'Premium HD lace wig', 50000, 3);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Lashes & Brows', 'Eye beauty products', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Mink Lashes', 'Premium mink lash set', 3000, 1),
    (cat_id, biz_id, 'Lash Extensions', 'Individual lash extensions', 8000, 2),
    (cat_id, biz_id, 'Brow Lamination', 'Eyebrow lamination service', 5000, 3);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Makeup', 'Makeup products', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Full Makeup Kit', 'Complete makeup set', 12000, 1),
    (cat_id, biz_id, 'Setting Spray', 'Long-lasting setting spray', 4000, 2);

  -- ═══════════════════════════════════════
  -- TEST-LAUNDRY: FreshPress Laundry
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest, delivery_fee
  ) VALUES (
    gen_random_uuid(), test_owner, 'FreshPress Laundry', 'freshpress-laundry',
    'Professional laundry and dry cleaning',
    '[]'::jsonb, '3 Toyin Street, Ikeja', 'lagos', 'Ikeja',
    '+2341000010', 'active', 'free', 'whatsapp_standalone', 'laundry', 'TEST-LAUNDRY', 0, 1000
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Wash & Fold', 'Regular laundry service', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Small Bag 5kg', 'Up to 5kg laundry bag', 2000, 1),
    (cat_id, biz_id, 'Medium Bag 10kg', 'Up to 10kg laundry bag', 3500, 2),
    (cat_id, biz_id, 'Large Bag 15kg', 'Up to 15kg laundry bag', 5000, 3);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Dry Cleaning', 'Professional dry cleaning', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Suit', 'Full suit dry clean', 2500, 1),
    (cat_id, biz_id, 'Agbada', 'Agbada dry clean', 3000, 2),
    (cat_id, biz_id, 'Wedding Dress', 'Wedding gown cleaning', 8000, 3);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Ironing', 'Press and iron service', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Shirt Iron', 'Iron one shirt', 500, 1),
    (cat_id, biz_id, 'Trouser Iron', 'Iron one trouser', 500, 2);

  -- ═══════════════════════════════════════
  -- TEST-CARWASH: SparkleClean Auto Wash
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest
  ) VALUES (
    gen_random_uuid(), test_owner, 'SparkleClean Auto Wash', 'sparkleclean-auto-wash',
    'Professional car wash and detailing',
    '[]'::jsonb, '18 Oba Akran Avenue, Ikeja', 'lagos', 'Ikeja',
    '+2341000011', 'active', 'free', 'whatsapp_standalone', 'car_wash', 'TEST-CARWASH', 0
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Exterior', 'Exterior wash packages', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Basic Wash', 'Quick exterior wash', 2000, 1),
    (cat_id, biz_id, 'Foam Wash', 'Premium foam wash', 3000, 2),
    (cat_id, biz_id, 'Wax & Polish', 'Wax and polish finish', 5000, 3);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Interior', 'Interior cleaning', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Interior Vacuum', 'Full interior vacuum', 2000, 1),
    (cat_id, biz_id, 'Full Interior Detail', 'Deep interior cleaning', 5000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Full Service', 'Complete packages', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Complete Detail', 'Full interior + exterior detail', 8000, 1);

  -- ═══════════════════════════════════════
  -- TEST-MECHANIC: AutoFix Garage
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest
  ) VALUES (
    gen_random_uuid(), test_owner, 'AutoFix Garage', 'autofix-garage',
    'Trusted auto repair and maintenance',
    '[]'::jsonb, '22 Agege Motor Road, Mushin', 'lagos', 'Mushin',
    '+2341000012', 'active', 'free', 'whatsapp_standalone', 'mechanic', 'TEST-MECHANIC', 0
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Diagnostics', 'Vehicle diagnostics', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Computer Scan', 'Full OBD diagnostic scan', 5000, 1),
    (cat_id, biz_id, 'Engine Check', 'Manual engine inspection', 3000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Maintenance', 'Regular maintenance', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Oil Change', 'Engine oil and filter change', 8000, 1),
    (cat_id, biz_id, 'Brake Service', 'Brake pad replacement', 12000, 2),
    (cat_id, biz_id, 'AC Repair', 'Air conditioning repair', 15000, 3);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Repairs', 'Major repairs', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Tire Change', 'Tire replacement', 3000, 1),
    (cat_id, biz_id, 'Battery Replacement', 'New battery installation', 25000, 2);

  -- ═══════════════════════════════════════
  -- TEST-HOTEL: LagosNights Shortlet
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest
  ) VALUES (
    gen_random_uuid(), test_owner, 'LagosNights Shortlet', 'lagosnights-shortlet',
    'Premium shortlet apartments in Lagos',
    '[]'::jsonb, '7 Admiralty Way, Lekki Phase 1', 'lagos', 'Lekki',
    '+2341000013', 'active', 'free', 'whatsapp_standalone', 'hotel', 'TEST-HOTEL', 0
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Standard', 'Standard rooms', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Standard Room', 'Comfortable standard room per night', 25000, 1),
    (cat_id, biz_id, 'Deluxe Room', 'Spacious deluxe room per night', 40000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Suites', 'Premium suites', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Executive Suite', 'Executive suite per night', 65000, 1),
    (cat_id, biz_id, 'Penthouse', 'Luxury penthouse per night', 100000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Add-ons', 'Extra services', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Airport Pickup', 'Airport pickup transfer', 10000, 1),
    (cat_id, biz_id, 'Breakfast Add-on', 'Daily breakfast per person', 5000, 2);

  -- ═══════════════════════════════════════
  -- TEST-CLINIC: CareFirst Medical Centre
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest
  ) VALUES (
    gen_random_uuid(), test_owner, 'CareFirst Medical Centre', 'carefirst-medical',
    'Quality healthcare services',
    '[]'::jsonb, '30 Isaac John Street, GRA Ikeja', 'lagos', 'Ikeja',
    '+2341000014', 'active', 'free', 'whatsapp_standalone', 'clinic', 'TEST-CLINIC', 0
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Consultations', 'Doctor consultations', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'GP Consultation', 'General practitioner visit', 10000, 1),
    (cat_id, biz_id, 'Specialist Visit', 'Specialist doctor visit', 20000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Tests', 'Medical tests and lab work', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Malaria Test', 'Rapid malaria test', 3000, 1),
    (cat_id, biz_id, 'Full Blood Work', 'Complete blood panel', 15000, 2),
    (cat_id, biz_id, 'COVID Test', 'COVID-19 PCR test', 10000, 3);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Dental', 'Dental services', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Dental Cleaning', 'Professional teeth cleaning', 8000, 1),
    (cat_id, biz_id, 'Tooth Extraction', 'Tooth extraction service', 12000, 2);

  -- ═══════════════════════════════════════
  -- TEST-TUTOR: BrainBoost Tutoring
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest
  ) VALUES (
    gen_random_uuid(), test_owner, 'BrainBoost Tutoring', 'brainboost-tutoring',
    'Expert home tutoring services',
    '[]'::jsonb, '14 Bode Thomas Street, Surulere', 'lagos', 'Surulere',
    '+2341000015', 'active', 'free', 'whatsapp_standalone', 'tutor', 'TEST-TUTOR', 0
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Primary', 'Primary school subjects', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Primary Maths 1hr', 'Primary school maths tutoring', 5000, 1),
    (cat_id, biz_id, 'Primary English 1hr', 'Primary school English tutoring', 5000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Secondary', 'Secondary school subjects', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'JSS Maths 1hr', 'Junior secondary maths', 6000, 1),
    (cat_id, biz_id, 'SSS Physics 1hr', 'Senior secondary physics', 8000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Exam Prep', 'Exam preparation', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'JAMB Prep Session', 'JAMB exam preparation', 10000, 1),
    (cat_id, biz_id, 'WAEC Crash Course', 'WAEC intensive preparation', 15000, 2);

  -- ═══════════════════════════════════════
  -- TEST-PHOTO: SnapKing Studios
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest
  ) VALUES (
    gen_random_uuid(), test_owner, 'SnapKing Studios', 'snapking-studios',
    'Professional photography services',
    '[]'::jsonb, '6 Karimu Kotun Street, VI', 'lagos', 'Victoria Island',
    '+2341000016', 'active', 'free', 'whatsapp_standalone', 'photography', 'TEST-PHOTO', 0
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Portrait', 'Portrait photography', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Passport Photos', 'Standard passport photos', 3000, 1),
    (cat_id, biz_id, 'Portrait Session 1hr', 'Professional portrait shoot', 15000, 2),
    (cat_id, biz_id, 'Couple Shoot', 'Couple portrait session', 25000, 3);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Events', 'Event photography', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Birthday Coverage', 'Full birthday event coverage', 40000, 1),
    (cat_id, biz_id, 'Wedding Full Day', 'Full day wedding coverage', 150000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Commercial', 'Commercial photography', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Product Photography', 'Product photo shoot', 20000, 1);

  -- ═══════════════════════════════════════
  -- TEST-CATERING: NaijaPlate Catering
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest, delivery_fee
  ) VALUES (
    gen_random_uuid(), test_owner, 'NaijaPlate Catering', 'naijaplatte-catering',
    'Professional catering for all events',
    '[]'::jsonb, '9 Murtala Mohammed Way, Yaba', 'lagos', 'Yaba',
    '+2341000017', 'active', 'free', 'whatsapp_standalone', 'catering', 'TEST-CATERING', 0, 2000
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Small Chops', 'Party small chops', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, '50 pcs Small Chops', 'Assorted small chops 50 pieces', 15000, 1),
    (cat_id, biz_id, '100 pcs Small Chops', 'Assorted small chops 100 pieces', 25000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Main Dishes', 'Main course dishes', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Jollof Rice 25 plates', 'Party jollof rice for 25', 30000, 1),
    (cat_id, biz_id, 'Fried Rice 25 plates', 'Fried rice for 25 guests', 30000, 2),
    (cat_id, biz_id, 'Assorted Meat', 'Assorted meat platter', 20000, 3);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Packages', 'Full catering packages', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Bronze 50 guests', 'Full package for 50 guests', 100000, 1),
    (cat_id, biz_id, 'Gold 100 guests', 'Full package for 100 guests', 200000, 2);

  -- ═══════════════════════════════════════
  -- TEST-CLEANING: CleanSpace Services
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest
  ) VALUES (
    gen_random_uuid(), test_owner, 'CleanSpace Services', 'cleanspace-services',
    'Professional cleaning services',
    '[]'::jsonb, '4 Akin Adesola Street, VI', 'lagos', 'Victoria Island',
    '+2341000018', 'active', 'free', 'whatsapp_standalone', 'cleaning', 'TEST-CLEANING', 0
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Residential', 'Home cleaning', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Studio/1-Bed', 'Studio or 1-bedroom cleaning', 10000, 1),
    (cat_id, biz_id, '2-3 Bed Flat', '2 or 3 bedroom flat cleaning', 18000, 2),
    (cat_id, biz_id, 'Duplex', 'Full duplex cleaning', 30000, 3);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Commercial', 'Office & commercial cleaning', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Office Cleaning', 'Standard office cleaning', 15000, 1);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Specialized', 'Special cleaning services', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Post-Construction', 'Post-construction cleanup', 50000, 1),
    (cat_id, biz_id, 'Fumigation', 'Pest control fumigation', 20000, 2);

  -- ═══════════════════════════════════════
  -- TEST-TAILOR: StitchMaster Lagos
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest, delivery_fee
  ) VALUES (
    gen_random_uuid(), test_owner, 'StitchMaster Lagos', 'stitchmaster-lagos',
    'Custom tailoring and fashion',
    '[]'::jsonb, '11 Ogunlana Drive, Surulere', 'lagos', 'Surulere',
    '+2341000019', 'active', 'free', 'whatsapp_standalone', 'tailor', 'TEST-TAILOR', 0, 1000
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Men''s Wear', 'Men''s traditional & modern wear', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Agbada Set', 'Full agbada with cap', 25000, 1),
    (cat_id, biz_id, 'Senator Style', 'Modern senator outfit', 15000, 2),
    (cat_id, biz_id, 'Kaftan', 'Simple kaftan design', 10000, 3);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Women''s Wear', 'Women''s fashion', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Ankara Gown', 'Custom ankara gown', 12000, 1),
    (cat_id, biz_id, 'Aso-Oke Set', 'Complete aso-oke outfit', 35000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Alterations', 'Clothing alterations', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Trouser Hem', 'Trouser hemming', 2000, 1),
    (cat_id, biz_id, 'Dress Alteration', 'Dress size alteration', 5000, 2);

  -- ═══════════════════════════════════════
  -- TEST-PRINTING: PrintHub Lagos
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest, delivery_fee
  ) VALUES (
    gen_random_uuid(), test_owner, 'PrintHub Lagos', 'printhub-lagos',
    'Professional printing services',
    '[]'::jsonb, '16 Nnamdi Azikiwe Street, Lagos Island', 'lagos', 'Lagos Island',
    '+2341000020', 'active', 'free', 'whatsapp_standalone', 'printing', 'TEST-PRINTING', 0, 1500
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Business', 'Business printing', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Business Cards 100', '100 premium business cards', 5000, 1),
    (cat_id, biz_id, 'Flyers 100', '100 A5 colour flyers', 8000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Events', 'Event printing', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Banner 3x6ft', 'Full colour vinyl banner', 10000, 1),
    (cat_id, biz_id, 'Event Backdrop', 'Custom event backdrop', 25000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Merch', 'Custom merchandise', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Custom T-Shirt', 'Printed custom t-shirt', 4000, 1),
    (cat_id, biz_id, 'Branded Mug', 'Custom printed mug', 3000, 2),
    (cat_id, biz_id, 'Tote Bag', 'Custom printed tote bag', 3500, 3);

  -- ═══════════════════════════════════════
  -- TEST-LOGISTICS: SwiftMove Dispatch
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest, delivery_fee
  ) VALUES (
    gen_random_uuid(), test_owner, 'SwiftMove Dispatch', 'swiftmove-dispatch',
    'Fast and reliable dispatch services',
    '[]'::jsonb, '2 Western Avenue, Surulere', 'lagos', 'Surulere',
    '+2341000021', 'active', 'free', 'whatsapp_standalone', 'logistics', 'TEST-LOGISTICS', 0, 0
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Same-Day', 'Same-day delivery', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Mainland-Mainland', 'Same-day mainland to mainland', 1500, 1),
    (cat_id, biz_id, 'Mainland-Island', 'Same-day mainland to island', 2500, 2),
    (cat_id, biz_id, 'Island-Island', 'Same-day island to island', 2000, 3);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Scheduled', 'Scheduled delivery', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Next-Day Delivery', 'Next business day delivery', 1000, 1);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Special', 'Special delivery options', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Bulk up to 20kg', 'Bulk item delivery up to 20kg', 5000, 1),
    (cat_id, biz_id, 'Fragile Item', 'Careful handling for fragile items', 3500, 2);

  -- ═══════════════════════════════════════
  -- TEST-BAKERY: SweetTooth Bakery
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest, delivery_fee
  ) VALUES (
    gen_random_uuid(), test_owner, 'SweetTooth Bakery', 'sweettooth-bakery',
    'Fresh baked goods and custom cakes',
    '[]'::jsonb, '8 Adetokunbo Ademola, VI', 'lagos', 'Victoria Island',
    '+2341000022', 'active', 'free', 'whatsapp_standalone', 'bakery', 'TEST-BAKERY', 0, 1000
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Cakes', 'Custom cakes', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Birthday Cake 8inch', 'Custom birthday cake', 15000, 1),
    (cat_id, biz_id, 'Wedding Cake 3-tier', 'Elegant 3-tier wedding cake', 80000, 2),
    (cat_id, biz_id, 'Cupcakes 12pcs', 'Box of 12 assorted cupcakes', 8000, 3);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Pastries', 'Freshly baked pastries', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Meat Pie 12pcs', 'Box of 12 meat pies', 6000, 1),
    (cat_id, biz_id, 'Sausage Roll 12pcs', 'Box of 12 sausage rolls', 5000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Bread', 'Fresh bread', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Agege Bread', 'Classic agege bread loaf', 1500, 1),
    (cat_id, biz_id, 'Coconut Bread', 'Coconut flavoured bread', 2000, 2);

  -- ═══════════════════════════════════════
  -- TEST-COWORK: HubSpace Lagos
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest
  ) VALUES (
    gen_random_uuid(), test_owner, 'HubSpace Lagos', 'hubspace-lagos',
    'Modern coworking space in Lagos',
    '[]'::jsonb, '1 Saka Tinubu Street, VI', 'lagos', 'Victoria Island',
    '+2341000023', 'active', 'free', 'whatsapp_standalone', 'coworking', 'TEST-COWORK', 0
  ) RETURNING id INTO biz_id;

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Desks', 'Desk options', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Hot Desk Day', 'Shared hot desk for the day', 3000, 1),
    (cat_id, biz_id, 'Dedicated Desk Day', 'Your own desk for the day', 5000, 2),
    (cat_id, biz_id, 'Private Office Day', 'Private office for the day', 10000, 3);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Meeting Rooms', 'Meeting room bookings', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Meeting Room 1hr', '1 hour meeting room', 5000, 1),
    (cat_id, biz_id, 'Meeting Room Half Day', 'Half day meeting room', 15000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), biz_id, 'Events', 'Event space', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, biz_id, 'Event Hall Full Day', 'Full day event hall booking', 50000, 1);

END $$;
