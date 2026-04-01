-- Seed test businesses for multi-category WhatsApp bot testing
-- Each business gets a unique bot_code, menu categories, and menu items

DO $$
DECLARE
  test_owner UUID;
  spa_id UUID;
  church_id UUID;
  gym_id UUID;
  cinema_id UUID;
  events_id UUID;
  shop_id UUID;
  cat_id UUID;
BEGIN
  -- Use first admin profile as owner, or create one if none exist
  SELECT id INTO test_owner FROM profiles WHERE role IN ('admin', 'super_admin') LIMIT 1;
  IF test_owner IS NULL THEN
    test_owner := gen_random_uuid();
    INSERT INTO auth.users (id, phone, phone_confirmed_at, created_at, updated_at)
    VALUES (test_owner, '+2340000000000', NOW(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO profiles (id, phone, first_name, last_name, role)
    VALUES (test_owner, '+2340000000000', 'Test', 'Admin', 'admin')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ═══════════════════════════════════════
  -- TEST-SPA: Serenity Spa Lagos
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest
  ) VALUES (
    gen_random_uuid(), test_owner, 'Serenity Spa Lagos', 'serenity-spa-lagos',
    'Premium spa and wellness centre in Lagos',
    '[]'::jsonb, '15 Admiralty Way, Lekki Phase 1', 'lagos', 'Lekki',
    '+2341000001', 'active', 'free', 'whatsapp_standalone', 'spa', 'TEST-SPA', 0
  ) RETURNING id INTO spa_id;

  -- Spa categories
  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), spa_id, 'Massages', 'Relaxing body massages', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, spa_id, 'Swedish Massage', '60 min full body relaxation', 15000, 1),
    (cat_id, spa_id, 'Deep Tissue Massage', '60 min deep muscle therapy', 20000, 2),
    (cat_id, spa_id, 'Hot Stone Massage', '90 min heated stone therapy', 25000, 3);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), spa_id, 'Facials', 'Revitalizing facial treatments', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, spa_id, 'Classic Facial', '45 min cleanse & hydrate', 10000, 1),
    (cat_id, spa_id, 'Anti-Aging Facial', '60 min anti-wrinkle treatment', 18000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), spa_id, 'Body Treatments', 'Full body pampering', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, spa_id, 'Body Scrub', '45 min exfoliating treatment', 12000, 1);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), spa_id, 'Nail Services', 'Manicure & pedicure', 4) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, spa_id, 'Manicure', 'Classic nail care', 5000, 1),
    (cat_id, spa_id, 'Pedicure', 'Full foot care & polish', 6000, 2);

  -- ═══════════════════════════════════════
  -- TEST-CHURCH: Grace Chapel
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest
  ) VALUES (
    gen_random_uuid(), test_owner, 'Grace Chapel', 'grace-chapel',
    'A place of worship and giving',
    '[]'::jsonb, '20 Herbert Macaulay Way, Yaba', 'lagos', 'Yaba',
    '+2341000002', 'active', 'free', 'whatsapp_standalone', 'church', 'TEST-CHURCH', 0
  ) RETURNING id INTO church_id;

  -- Church categories
  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), church_id, 'Tithes & Offerings', 'Regular giving', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, church_id, 'Tithe ₦1,000', 'Monthly tithe', 1000, 1),
    (cat_id, church_id, 'Tithe ₦5,000', 'Monthly tithe', 5000, 2),
    (cat_id, church_id, 'Tithe ₦10,000', 'Monthly tithe', 10000, 3),
    (cat_id, church_id, 'Sunday Offering ₦500', 'Weekly offering', 500, 4),
    (cat_id, church_id, 'Sunday Offering ₦2,000', 'Weekly offering', 2000, 5);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), church_id, 'Special Seeds', 'Project & building fund', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, church_id, 'Building Fund ₦5,000', 'New sanctuary project', 5000, 1);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), church_id, 'Missions', 'Outreach & ministry support', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, church_id, 'Missions Support ₦2,000', 'Global outreach', 2000, 1),
    (cat_id, church_id, 'Youth Ministry ₦1,000', 'Youth programs', 1000, 2);

  -- ═══════════════════════════════════════
  -- TEST-GYM: FitZone Gym
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest
  ) VALUES (
    gen_random_uuid(), test_owner, 'FitZone Gym', 'fitzone-gym',
    'Premium fitness centre with group classes & personal training',
    '[]'::jsonb, '8 Ozumba Mbadiwe Ave, Victoria Island', 'lagos', 'Victoria Island',
    '+2341000003', 'active', 'free', 'whatsapp_standalone', 'gym', 'TEST-GYM', 0
  ) RETURNING id INTO gym_id;

  -- Gym categories
  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), gym_id, 'Group Classes', 'Join a group session', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, gym_id, 'Yoga Class', '60 min guided yoga', 3000, 1),
    (cat_id, gym_id, 'CrossFit', '45 min high-intensity', 4000, 2),
    (cat_id, gym_id, 'Spinning', '45 min indoor cycling', 3500, 3),
    (cat_id, gym_id, 'HIIT', '30 min interval training', 3500, 4);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), gym_id, 'Personal Training', '1-on-1 coaching', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, gym_id, 'PT Session', '60 min personal training', 10000, 1),
    (cat_id, gym_id, 'PT 5-Pack', '5 sessions bundle', 40000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), gym_id, 'Memberships', 'Gym access passes', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, gym_id, 'Day Pass', 'Full day gym access', 5000, 1),
    (cat_id, gym_id, 'Monthly Membership', '30 days unlimited access', 25000, 2);

  -- ═══════════════════════════════════════
  -- TEST-CINEMA: StarScreen Cinemas
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest
  ) VALUES (
    gen_random_uuid(), test_owner, 'StarScreen Cinemas', 'starscreen-cinemas',
    'Premium movie experience in Lagos',
    '[]'::jsonb, '12 Adeola Odeku St, Victoria Island', 'lagos', 'Victoria Island',
    '+2341000004', 'active', 'free', 'whatsapp_standalone', 'cinema', 'TEST-CINEMA', 0
  ) RETURNING id INTO cinema_id;

  -- Cinema categories
  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), cinema_id, 'Now Showing', 'Currently in cinemas', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, cinema_id, 'Action Movie', 'Standard screen', 3500, 1),
    (cat_id, cinema_id, 'Comedy Special', 'Standard screen', 3000, 2),
    (cat_id, cinema_id, 'Horror Night', 'Late night showing', 3500, 3),
    (cat_id, cinema_id, 'Kids Movie', 'Family friendly', 2000, 4),
    (cat_id, cinema_id, 'IMAX Experience', 'Premium IMAX screen', 5000, 5),
    (cat_id, cinema_id, 'VIP Screening', 'Private lounge viewing', 8000, 6);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), cinema_id, 'Coming Soon', 'Advance tickets', 2) RETURNING id INTO cat_id;

  -- ═══════════════════════════════════════
  -- TEST-EVENTS: Lagos Live Events
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest
  ) VALUES (
    gen_random_uuid(), test_owner, 'Lagos Live Events', 'lagos-live-events',
    'Live concerts, comedy shows, and workshops',
    '[]'::jsonb, '5 Tafawa Balewa Square, Lagos Island', 'lagos', 'Lagos Island',
    '+2341000005', 'active', 'free', 'whatsapp_standalone', 'events', 'TEST-EVENTS', 0
  ) RETURNING id INTO events_id;

  -- Events categories
  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), events_id, 'Concerts', 'Live music events', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, events_id, 'Afrobeats Concert Regular', 'General admission', 10000, 1),
    (cat_id, events_id, 'Afrobeats Concert VIP', 'VIP area with drinks', 25000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), events_id, 'Comedy Shows', 'Stand-up comedy nights', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, events_id, 'Comedy Night', 'General admission', 5000, 1),
    (cat_id, events_id, 'Comedy VIP', 'Front row + meet & greet', 12000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), events_id, 'Workshops', 'Learning experiences', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, events_id, 'Tech Workshop', 'Full day coding bootcamp', 15000, 1),
    (cat_id, events_id, 'Art Class', 'Paint & sip evening', 8000, 2);

  -- ═══════════════════════════════════════
  -- TEST-SHOP: NaijaMarket Store
  -- ═══════════════════════════════════════
  INSERT INTO restaurants (
    id, owner_id, name, slug, description, cuisine_types, address, city, neighborhood,
    phone, status, tier, product_type, business_category, bot_code, deposit_per_guest, delivery_fee
  ) VALUES (
    gen_random_uuid(), test_owner, 'NaijaMarket Store', 'naijamarket-store',
    'Online marketplace for fashion, electronics & home goods',
    '[]'::jsonb, '25 Allen Avenue, Ikeja', 'lagos', 'Ikeja',
    '+2341000006', 'active', 'free', 'whatsapp_standalone', 'shop', 'TEST-SHOP', 0, 1500
  ) RETURNING id INTO shop_id;

  -- Shop categories
  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), shop_id, 'Fashion', 'Clothing & accessories', 1) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, shop_id, 'Ankara Dress', 'Beautiful Ankara print dress', 8000, 1),
    (cat_id, shop_id, 'Agbada Set', 'Complete traditional set', 25000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), shop_id, 'Electronics', 'Gadgets & accessories', 2) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, shop_id, 'Phone Case', 'Premium protective case', 2500, 1),
    (cat_id, shop_id, 'Wireless Earbuds', 'Bluetooth 5.0 earbuds', 12000, 2);

  INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order)
  VALUES (gen_random_uuid(), shop_id, 'Home & Kitchen', 'Home essentials', 3) RETURNING id INTO cat_id;
  INSERT INTO menu_items (category_id, restaurant_id, name, description, price, sort_order) VALUES
    (cat_id, shop_id, 'Blender', 'High-speed kitchen blender', 15000, 1),
    (cat_id, shop_id, 'Cooking Pot Set', '3-piece stainless steel set', 10000, 2);

END $$;
