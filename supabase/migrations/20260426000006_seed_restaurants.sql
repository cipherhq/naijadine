-- ============================================================
-- Seed: Real Nigerian restaurants with images and details
-- Uses Unsplash source URLs for cover photos (free, no API key)
-- ============================================================

DO $$
DECLARE
  owner_id UUID;
BEGIN
  -- Get or create a seed owner
  SELECT id INTO owner_id FROM profiles WHERE role IN ('admin', 'super_admin') LIMIT 1;
  IF owner_id IS NULL THEN
    owner_id := gen_random_uuid();
    INSERT INTO auth.users (id, phone, phone_confirmed_at, created_at, updated_at)
    VALUES (owner_id, '+2349000000001', NOW(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO profiles (id, phone, first_name, last_name, role)
    VALUES (owner_id, '+2349000000001', 'DineRoot', 'Admin', 'super_admin')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ═══════════════════════════════════════
  -- LAGOS RESTAURANTS
  -- ═══════════════════════════════════════

  INSERT INTO restaurants (owner_id, name, slug, description, cuisine_types, address, city, neighborhood, phone, status, tier, product_type, business_category, price_range, rating_avg, rating_count, total_bookings, deposit_per_guest, cover_photo_url, operating_hours)
  VALUES
  (owner_id, 'Bukka Hut', 'bukka-hut', 'Authentic Nigerian cuisine in a warm, modern setting. Famous for our jollof rice, pepper soup, and traditional stews. A Lagos institution since 2010.', '["nigerian"]'::jsonb, '15 Admiralty Way, Lekki Phase 1', 'lagos', 'Lekki Phase 1', '+2348012345001', 'active', 'standard', 'marketplace', 'restaurant', 'moderate', 4.6, 342, 1850, 2000, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=500&fit=crop', '{"mon":{"open":"11:00","close":"22:00"},"tue":{"open":"11:00","close":"22:00"},"wed":{"open":"11:00","close":"22:00"},"thu":{"open":"11:00","close":"22:00"},"fri":{"open":"11:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"12:00","close":"21:00"}}'::jsonb),

  (owner_id, 'Yakoyo Nkoyo', 'yakoyo-nkoyo', 'Fine-dining Calabar cuisine with a contemporary twist. Our chefs bring Cross River State flavours to Victoria Island with dishes like edikaikong, afang, and ekpang nkukwo.', '["nigerian","seafood"]'::jsonb, '22 Akin Adesola Street, Victoria Island', 'lagos', 'Victoria Island', '+2348012345002', 'active', 'premium', 'marketplace', 'restaurant', 'upscale', 4.8, 218, 1200, 5000, 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"22:30"},"tue":{"open":"12:00","close":"22:30"},"wed":{"open":"12:00","close":"22:30"},"thu":{"open":"12:00","close":"22:30"},"fri":{"open":"12:00","close":"23:30"},"sat":{"open":"13:00","close":"23:30"},"sun":{"open":"13:00","close":"21:00"}}'::jsonb),

  (owner_id, 'The Yellow Chilli', 'the-yellow-chilli', 'Celebrity chef Opebi''s signature restaurant offering modern Nigerian fine dining. Signature dishes include gizdodo, ofada rice, and asun. Perfect for special occasions.', '["nigerian","continental"]'::jsonb, '27 Oju Olobun Close, Victoria Island', 'lagos', 'Victoria Island', '+2348012345003', 'active', 'premium', 'marketplace', 'restaurant', 'upscale', 4.7, 456, 2300, 5000, 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=500&fit=crop', '{"mon":{"open":"11:00","close":"22:00"},"tue":{"open":"11:00","close":"22:00"},"wed":{"open":"11:00","close":"22:00"},"thu":{"open":"11:00","close":"22:00"},"fri":{"open":"11:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"12:00","close":"21:00"}}'::jsonb),

  (owner_id, 'Bottles Restaurant', 'bottles-restaurant', 'Relaxed beachside dining on Lekki''s waterfront. Grilled fish, suya, cocktails, and live music on weekends. The perfect Lagos sunset spot.', '["nigerian","grill_bbq","seafood"]'::jsonb, 'Plot 1, Lekki Phase 1 Waterfront', 'lagos', 'Lekki Phase 1', '+2348012345004', 'active', 'standard', 'marketplace', 'restaurant', 'moderate', 4.5, 189, 980, 2000, 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"23:00"},"tue":{"open":"12:00","close":"23:00"},"wed":{"open":"12:00","close":"23:00"},"thu":{"open":"12:00","close":"23:00"},"fri":{"open":"12:00","close":"01:00"},"sat":{"open":"12:00","close":"01:00"},"sun":{"open":"12:00","close":"22:00"}}'::jsonb),

  (owner_id, 'Nok by Alara', 'nok-by-alara', 'Pan-African fine dining experience in the heart of Victoria Island. Curated tasting menus featuring ingredients from across the continent. Award-winning wine list.', '["continental","mediterranean"]'::jsonb, '12A Akin Olugbade Street, Victoria Island', 'lagos', 'Victoria Island', '+2348012345005', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.9, 167, 890, 10000, 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=500&fit=crop', '{"tue":{"open":"18:00","close":"23:00"},"wed":{"open":"18:00","close":"23:00"},"thu":{"open":"18:00","close":"23:00"},"fri":{"open":"18:00","close":"00:00"},"sat":{"open":"18:00","close":"00:00"},"sun":{"open":"13:00","close":"17:00"}}'::jsonb),

  (owner_id, 'Sky Restaurant & Lounge', 'sky-restaurant-lounge', 'Rooftop dining with panoramic views of the Lagos skyline. Asian fusion cuisine, craft cocktails, and a chic atmosphere. The place to see and be seen.', '["asian","continental"]'::jsonb, 'Eko Hotel, Victoria Island', 'lagos', 'Victoria Island', '+2348012345006', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.7, 298, 1500, 7500, 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&h=500&fit=crop', '{"mon":{"open":"17:00","close":"23:00"},"tue":{"open":"17:00","close":"23:00"},"wed":{"open":"17:00","close":"23:00"},"thu":{"open":"17:00","close":"23:00"},"fri":{"open":"17:00","close":"01:00"},"sat":{"open":"17:00","close":"01:00"},"sun":{"open":"13:00","close":"22:00"}}'::jsonb),

  (owner_id, 'Mama Cass', 'mama-cass', 'Lagos favourite for generous portions of Nigerian food at honest prices. Amala, pounded yam, egusi, and the best oxtail in town. Multiple locations across Lagos.', '["nigerian"]'::jsonb, '15 Opebi Road, Ikeja GRA', 'lagos', 'Ikeja GRA', '+2348012345007', 'active', 'standard', 'marketplace', 'restaurant', 'budget', 4.3, 567, 3200, 0, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop', '{"mon":{"open":"08:00","close":"22:00"},"tue":{"open":"08:00","close":"22:00"},"wed":{"open":"08:00","close":"22:00"},"thu":{"open":"08:00","close":"22:00"},"fri":{"open":"08:00","close":"23:00"},"sat":{"open":"09:00","close":"23:00"},"sun":{"open":"09:00","close":"21:00"}}'::jsonb),

  (owner_id, 'Shiro Lagos', 'shiro-lagos', 'Japanese-Peruvian fusion (Nikkei) cuisine in an elegant setting. Signature sushi rolls, ceviche, and wagyu beef. The best omakase experience in West Africa.', '["asian","seafood"]'::jsonb, '2 Gerrard Road, Ikoyi', 'lagos', 'Ikoyi', '+2348012345008', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.8, 134, 720, 10000, 'https://images.unsplash.com/photo-1579027989536-b7b1f875659b?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"22:30"},"tue":{"open":"12:00","close":"22:30"},"wed":{"open":"12:00","close":"22:30"},"thu":{"open":"12:00","close":"22:30"},"fri":{"open":"12:00","close":"23:30"},"sat":{"open":"13:00","close":"23:30"},"sun":{"open":"13:00","close":"21:00"}}'::jsonb),

  (owner_id, 'Hard Rock Cafe Lagos', 'hard-rock-cafe-lagos', 'The legendary Hard Rock experience comes to Lagos. Juicy burgers, BBQ ribs, and rock memorabilia. Live music every Friday and Saturday.', '["fast_casual","grill_bbq"]'::jsonb, 'Landmark Centre, Victoria Island', 'lagos', 'Victoria Island', '+2348012345009', 'active', 'standard', 'marketplace', 'restaurant', 'moderate', 4.4, 432, 2100, 3000, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=500&fit=crop', '{"mon":{"open":"11:00","close":"23:00"},"tue":{"open":"11:00","close":"23:00"},"wed":{"open":"11:00","close":"23:00"},"thu":{"open":"11:00","close":"23:00"},"fri":{"open":"11:00","close":"01:00"},"sat":{"open":"11:00","close":"01:00"},"sun":{"open":"12:00","close":"22:00"}}'::jsonb),

  (owner_id, 'Terra Kulture', 'terra-kulture', 'Art gallery meets restaurant. Nigerian dishes served alongside exhibitions and live theatre performances. A cultural dining experience like no other.', '["nigerian","continental"]'::jsonb, '1376 Tiamiyu Savage Street, Victoria Island', 'lagos', 'Victoria Island', '+2348012345010', 'active', 'standard', 'marketplace', 'restaurant', 'moderate', 4.5, 276, 1400, 2000, 'https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=800&h=500&fit=crop', '{"mon":{"open":"10:00","close":"22:00"},"tue":{"open":"10:00","close":"22:00"},"wed":{"open":"10:00","close":"22:00"},"thu":{"open":"10:00","close":"22:00"},"fri":{"open":"10:00","close":"23:00"},"sat":{"open":"11:00","close":"23:00"},"sun":{"open":"11:00","close":"20:00"}}'::jsonb),

  -- ═══════════════════════════════════════
  -- ABUJA RESTAURANTS
  -- ═══════════════════════════════════════

  (owner_id, 'BluCabana', 'blucabana-abuja', 'Abuja''s premier fine dining destination. Mediterranean and Continental cuisine with an extensive wine cellar. Private dining rooms available for corporate events.', '["continental","mediterranean"]'::jsonb, '8 Gana Street, Maitama', 'abuja', 'Maitama', '+2348012345011', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.8, 189, 950, 7500, 'https://images.unsplash.com/photo-1550966871-3ed3cdb51f3a?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"23:00"},"tue":{"open":"12:00","close":"23:00"},"wed":{"open":"12:00","close":"23:00"},"thu":{"open":"12:00","close":"23:00"},"fri":{"open":"12:00","close":"00:00"},"sat":{"open":"12:00","close":"00:00"},"sun":{"open":"13:00","close":"22:00"}}'::jsonb),

  (owner_id, 'Charcoal Grill Abuja', 'charcoal-grill-abuja', 'Open-flame grilled meats, fresh salads, and craft cocktails in a stylish outdoor setting. The best steaks and suya in the Federal Capital.', '["grill_bbq","continental"]'::jsonb, '12 Amazon Street, Maitama', 'abuja', 'Maitama', '+2348012345012', 'active', 'standard', 'marketplace', 'restaurant', 'upscale', 4.6, 234, 1200, 3000, 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"22:00"},"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"13:00","close":"21:00"}}'::jsonb),

  (owner_id, 'Wakkis Restaurant', 'wakkis-abuja', 'Authentic Indian and Oriental cuisine in the heart of Wuse. Tandoori specialties, biryani, and the best butter chicken in Nigeria. Family-friendly atmosphere.', '["indian","asian"]'::jsonb, '4 Aminu Kano Crescent, Wuse 2', 'abuja', 'Wuse 2', '+2348012345013', 'active', 'standard', 'marketplace', 'restaurant', 'moderate', 4.5, 345, 1800, 2000, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=500&fit=crop', '{"mon":{"open":"11:00","close":"22:00"},"tue":{"open":"11:00","close":"22:00"},"wed":{"open":"11:00","close":"22:00"},"thu":{"open":"11:00","close":"22:00"},"fri":{"open":"11:00","close":"22:30"},"sat":{"open":"12:00","close":"22:30"},"sun":{"open":"12:00","close":"21:00"}}'::jsonb),

  (owner_id, 'Jabi Lake Mall Food Court', 'jabi-boat-club', 'Waterfront dining at Jabi Lake with stunning sunset views. Fresh grilled fish, pepper soup, and cold drinks. The perfect escape from Abuja city life.', '["nigerian","seafood"]'::jsonb, 'Jabi Lake, Jabi', 'abuja', 'Jabi', '+2348012345014', 'active', 'standard', 'marketplace', 'restaurant', 'moderate', 4.3, 278, 1500, 2000, 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&h=500&fit=crop', '{"mon":{"open":"10:00","close":"22:00"},"tue":{"open":"10:00","close":"22:00"},"wed":{"open":"10:00","close":"22:00"},"thu":{"open":"10:00","close":"22:00"},"fri":{"open":"10:00","close":"23:00"},"sat":{"open":"10:00","close":"23:00"},"sun":{"open":"10:00","close":"21:00"}}'::jsonb),

  (owner_id, 'Cilantro Abuja', 'cilantro-abuja', 'Lebanese and Mediterranean fine dining with a wood-fired oven. Fresh hummus, shawarma, grilled halloumi, and premium steaks. Shisha lounge on the terrace.', '["lebanese","mediterranean"]'::jsonb, '7 Cairo Street, Wuse 2', 'abuja', 'Wuse 2', '+2348012345015', 'active', 'premium', 'marketplace', 'restaurant', 'upscale', 4.7, 156, 800, 5000, 'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"22:00"},"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"13:00","close":"21:00"}}'::jsonb),

  -- ═══════════════════════════════════════
  -- PORT HARCOURT RESTAURANTS
  -- ═══════════════════════════════════════

  (owner_id, 'Genesis Restaurant', 'genesis-ph', 'Port Harcourt''s most beloved restaurant since 1998. Nigerian and Continental cuisine with generous portions. The go-to spot for family celebrations and business lunches.', '["nigerian","continental"]'::jsonb, '23 Tombia Street, GRA Phase 2', 'port_harcourt', 'GRA Phase 2', '+2348012345016', 'active', 'standard', 'marketplace', 'restaurant', 'moderate', 4.5, 312, 1700, 2000, 'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&h=500&fit=crop', '{"mon":{"open":"08:00","close":"22:00"},"tue":{"open":"08:00","close":"22:00"},"wed":{"open":"08:00","close":"22:00"},"thu":{"open":"08:00","close":"22:00"},"fri":{"open":"08:00","close":"23:00"},"sat":{"open":"09:00","close":"23:00"},"sun":{"open":"10:00","close":"21:00"}}'::jsonb),

  (owner_id, 'Asia Town', 'asia-town-ph', 'Chinese and Thai cuisine prepared by authentic Asian chefs. Dim sum, stir-fry, noodle soups, and sushi. The best Asian food in the Garden City.', '["chinese","asian"]'::jsonb, '5 Stadium Road, GRA Phase 1', 'port_harcourt', 'GRA Phase 1', '+2348012345017', 'active', 'standard', 'marketplace', 'restaurant', 'moderate', 4.4, 198, 1050, 2000, 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800&h=500&fit=crop', '{"mon":{"open":"11:00","close":"22:00"},"tue":{"open":"11:00","close":"22:00"},"wed":{"open":"11:00","close":"22:00"},"thu":{"open":"11:00","close":"22:00"},"fri":{"open":"11:00","close":"22:30"},"sat":{"open":"12:00","close":"22:30"},"sun":{"open":"12:00","close":"21:00"}}'::jsonb),

  (owner_id, 'Kilimanjaro', 'kilimanjaro-ph', 'Fast casual Nigerian and International cuisine. Famous for their fried rice, grilled chicken, and fresh juices. Quick service, generous portions, great value.', '["nigerian","fast_casual"]'::jsonb, '18 Aba Road, Trans-Amadi', 'port_harcourt', 'Trans-Amadi', '+2348012345018', 'active', 'standard', 'marketplace', 'restaurant', 'budget', 4.2, 456, 2800, 0, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=500&fit=crop', '{"mon":{"open":"07:00","close":"22:00"},"tue":{"open":"07:00","close":"22:00"},"wed":{"open":"07:00","close":"22:00"},"thu":{"open":"07:00","close":"22:00"},"fri":{"open":"07:00","close":"23:00"},"sat":{"open":"08:00","close":"23:00"},"sun":{"open":"08:00","close":"21:00"}}'::jsonb),

  (owner_id, 'La Mango', 'la-mango-ph', 'Tropical-themed Italian and Continental restaurant with a lush garden setting. Wood-fired pizzas, pasta, and signature cocktails. Perfect for date nights.', '["italian","continental"]'::jsonb, '10 Forces Avenue, Old GRA', 'port_harcourt', 'Old GRA', '+2348012345019', 'active', 'standard', 'marketplace', 'restaurant', 'upscale', 4.6, 167, 890, 3000, 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"22:00"},"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"13:00","close":"21:00"}}'::jsonb),

  (owner_id, 'De Santos', 'de-santos-ph', 'Grill house and cocktail bar in the heart of GRA. Premium cuts of meat, live jazz on Saturdays, and the city''s best wine selection.', '["grill_bbq","continental"]'::jsonb, '7 Evo Road, GRA Phase 2', 'port_harcourt', 'GRA Phase 2', '+2348012345020', 'active', 'standard', 'marketplace', 'restaurant', 'upscale', 4.5, 145, 760, 3000, 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&h=500&fit=crop', '{"tue":{"open":"16:00","close":"23:00"},"wed":{"open":"16:00","close":"23:00"},"thu":{"open":"16:00","close":"23:00"},"fri":{"open":"16:00","close":"01:00"},"sat":{"open":"14:00","close":"01:00"},"sun":{"open":"14:00","close":"22:00"}}'::jsonb)

  ON CONFLICT (slug) DO UPDATE SET
    description = EXCLUDED.description,
    cuisine_types = EXCLUDED.cuisine_types,
    address = EXCLUDED.address,
    price_range = EXCLUDED.price_range,
    rating_avg = EXCLUDED.rating_avg,
    rating_count = EXCLUDED.rating_count,
    total_bookings = EXCLUDED.total_bookings,
    deposit_per_guest = EXCLUDED.deposit_per_guest,
    cover_photo_url = EXCLUDED.cover_photo_url,
    operating_hours = EXCLUDED.operating_hours;

END $$;
