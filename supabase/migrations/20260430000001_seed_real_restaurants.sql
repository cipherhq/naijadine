-- ============================================================
-- Seed: Real restaurants sourced from TripAdvisor, TheWorlds50Best,
-- and local food blogs. Grouped by country.
-- ============================================================

DO $$
DECLARE
  owner_id UUID;
BEGIN
  SELECT id INTO owner_id FROM profiles WHERE role IN ('admin', 'super_admin') LIMIT 1;

  INSERT INTO restaurants (owner_id, name, slug, description, cuisine_types, address, city, neighborhood, phone, status, tier, product_type, business_category, price_range, rating_avg, rating_count, total_bookings, deposit_per_guest, cover_photo_url, operating_hours, latitude, longitude)
  VALUES
  -- ══════════════════════════════════
  -- NIGERIA — Lagos (additional)
  -- ══════════════════════════════════
  (owner_id, 'Ìtàn Test Kitchen', 'itan-test-kitchen', 'Lagos'' leading fine dining restaurant by Chef Michael Elégbèdé. Modern Yoruba cuisine — amala dumplings, garri chips, and storytelling through food. Multi-course tasting menus.', '["nigerian","continental"]'::jsonb, 'Victoria Island', 'lagos', 'Victoria Island', '+2348012345030', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.9, 89, 450, 15000, 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop', '{"wed":{"open":"18:00","close":"22:00"},"thu":{"open":"18:00","close":"22:00"},"fri":{"open":"18:00","close":"23:00"},"sat":{"open":"18:00","close":"23:00"}}'::jsonb, 6.4285, 3.4210),

  (owner_id, 'NOK by Alara', 'nok-by-alara-vi', 'Pan-African fine dining with contemporary flair. Signature ewa agoyin, NOK Hot Chicken, Mac & Cheese. Garden setting with creative cocktails.', '["nigerian","continental"]'::jsonb, '12A Akin Olugbade Street, Victoria Island', 'lagos', 'Victoria Island', '+2348012345031', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.8, 167, 890, 10000, 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=500&fit=crop', '{"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"13:00","close":"17:00"}}'::jsonb, 6.4312, 3.4148),

  (owner_id, 'RSVP Lagos', 'rsvp-lagos', 'Sophisticated dining with diverse cuisine. Elegant ambiance, curated cocktails, and seasonal menus. One of Lagos'' most sought-after reservations.', '["continental","mediterranean"]'::jsonb, 'Victoria Island', 'lagos', 'Victoria Island', '+2348012345032', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.7, 134, 670, 10000, 'https://images.unsplash.com/photo-1550966871-3ed3cdb51f3a?w=800&h=500&fit=crop', '{"tue":{"open":"18:00","close":"23:00"},"wed":{"open":"18:00","close":"23:00"},"thu":{"open":"18:00","close":"23:00"},"fri":{"open":"18:00","close":"00:00"},"sat":{"open":"18:00","close":"00:00"}}'::jsonb, 6.4290, 3.4225),

  (owner_id, 'The Mayfair Lagos', 'mayfair-lagos', 'Vibrant restaurant, bar, and rooftop hookah lounge. Some of the finest African cuisine in Lagos. Live music, premium cocktails, and stunning views.', '["nigerian","grill_bbq"]'::jsonb, 'Victoria Island', 'lagos', 'Victoria Island', '+2348012345033', 'active', 'standard', 'marketplace', 'restaurant', 'upscale', 4.6, 212, 1100, 5000, 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"23:00"},"tue":{"open":"12:00","close":"23:00"},"wed":{"open":"12:00","close":"23:00"},"thu":{"open":"12:00","close":"23:00"},"fri":{"open":"12:00","close":"01:00"},"sat":{"open":"12:00","close":"01:00"},"sun":{"open":"13:00","close":"22:00"}}'::jsonb, 6.4275, 3.4200),

  -- ══════════════════════════════════
  -- NIGERIA — Abuja (additional)
  -- ══════════════════════════════════
  (owner_id, 'The Burgundy by Chef Stone', 'burgundy-abuja', 'Reservation-only fine dining. 7-course Pan-African tasting menu with curated wines. Abuja''s most exclusive culinary experience.', '["continental","nigerian"]'::jsonb, 'Behind Fraser Suites, Wuse 2', 'abuja', 'Wuse 2', '+2348012345034', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.9, 78, 380, 15000, 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop', '{"thu":{"open":"19:00","close":"22:00"},"fri":{"open":"19:00","close":"23:00"},"sat":{"open":"19:00","close":"23:00"}}'::jsonb, 9.0650, 7.4910),

  (owner_id, 'Liquid Hub Abuja', 'liquid-hub-abuja', 'Upscale restaurant and lounge in the CBD. Seafood, steaks, pasta. Grilled Giant Prawns and T-Bone Steak with curated wine selection.', '["continental","seafood"]'::jsonb, 'Central Business District', 'abuja', 'Central Area', '+2348012345035', 'active', 'standard', 'marketplace', 'restaurant', 'upscale', 4.5, 189, 950, 3000, 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"23:00"},"tue":{"open":"12:00","close":"23:00"},"wed":{"open":"12:00","close":"23:00"},"thu":{"open":"12:00","close":"23:00"},"fri":{"open":"12:00","close":"00:00"},"sat":{"open":"12:00","close":"00:00"},"sun":{"open":"13:00","close":"22:00"}}'::jsonb, 9.0580, 7.4890),

  (owner_id, 'Ciao Italia Abuja', 'ciao-italia-abuja', 'Charming Italian restaurant in Central Park. Warm atmosphere, indoor and outdoor seating. Most authentic Italian dishes and the best pizzas in Abuja.', '["italian","continental"]'::jsonb, 'Central Park, Abuja', 'abuja', 'Central Area', '+2348012345036', 'active', 'standard', 'marketplace', 'restaurant', 'moderate', 4.6, 234, 1200, 2000, 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop', '{"mon":{"open":"11:00","close":"22:00"},"tue":{"open":"11:00","close":"22:00"},"wed":{"open":"11:00","close":"22:00"},"thu":{"open":"11:00","close":"22:00"},"fri":{"open":"11:00","close":"22:30"},"sat":{"open":"12:00","close":"22:30"},"sun":{"open":"12:00","close":"21:00"}}'::jsonb, 9.0560, 7.4850),

  (owner_id, 'Farm City Abuja', 'farm-city-abuja', 'Lively outdoor restaurant. Grills, Nigerian staples, and a relaxed setting. Perfect for casual dining with friends and family. Great value.', '["nigerian","grill_bbq"]'::jsonb, 'Wuse 2', 'abuja', 'Wuse 2', '+2348012345037', 'active', 'standard', 'marketplace', 'restaurant', 'budget', 4.3, 345, 1800, 0, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=500&fit=crop', '{"mon":{"open":"10:00","close":"22:00"},"tue":{"open":"10:00","close":"22:00"},"wed":{"open":"10:00","close":"22:00"},"thu":{"open":"10:00","close":"22:00"},"fri":{"open":"10:00","close":"23:00"},"sat":{"open":"10:00","close":"23:00"},"sun":{"open":"10:00","close":"21:00"}}'::jsonb, 9.0640, 7.4905),

  -- ══════════════════════════════════
  -- NIGERIA — Port Harcourt (additional)
  -- ══════════════════════════════════
  (owner_id, 'Sky Bar PHC', 'sky-bar-phc', 'Luxurious fine dining with live entertainment and panoramic views. Extensive wine selection, craft cocktails, and international cuisine.', '["continental","grill_bbq"]'::jsonb, 'GRA Phase 2, Port Harcourt', 'port_harcourt', 'GRA Phase 2', '+2348012345038', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.7, 145, 720, 5000, 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=500&fit=crop', '{"tue":{"open":"17:00","close":"23:00"},"wed":{"open":"17:00","close":"23:00"},"thu":{"open":"17:00","close":"23:00"},"fri":{"open":"17:00","close":"01:00"},"sat":{"open":"17:00","close":"01:00"},"sun":{"open":"14:00","close":"22:00"}}'::jsonb, 4.8380, 7.0095),

  (owner_id, 'The Red Coral', 'red-coral-phc', 'Upscale dining in Port Harcourt. Nigerian and Continental cuisine with an emphasis on fresh seafood. Elegant ambiance and attentive service.', '["nigerian","seafood","continental"]'::jsonb, 'Trans-Amadi, Port Harcourt', 'port_harcourt', 'Trans-Amadi', '+2348012345039', 'active', 'standard', 'marketplace', 'restaurant', 'upscale', 4.5, 178, 890, 3000, 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"22:00"},"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"13:00","close":"21:00"}}'::jsonb, 4.8105, 7.0330),

  -- ══════════════════════════════════
  -- GHANA — Accra (additional)
  -- ══════════════════════════════════
  (owner_id, 'Pomona Accra', 'pomona-accra', 'Sleek indoor/outdoor restaurant. Best Neapolitan-style pizzas in Accra, legendary truffle pasta, slow-braised beef cheek. Italian-inspired menu.', '["italian","continental"]'::jsonb, 'Osu, Accra', 'accra', 'Osu', '+233201234010', 'active', 'standard', 'marketplace', 'restaurant', 'upscale', 4.7, 198, 950, 3000, 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"22:00"},"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"12:00","close":"21:00"}}'::jsonb, 5.5562, -0.1828),

  (owner_id, 'Le Petit Oiseau', 'le-petit-oiseau-accra', 'Modern West African menu combining Ghanaian stews with French culinary influences. Pan-seared grouper, goat espetada. Osu''s hidden gem.', '["nigerian","continental"]'::jsonb, 'Osu, Accra', 'accra', 'Osu', '+233201234011', 'active', 'premium', 'marketplace', 'restaurant', 'upscale', 4.8, 112, 560, 5000, 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&h=500&fit=crop', '{"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"12:00","close":"16:00"}}'::jsonb, 5.5555, -0.1815),

  (owner_id, 'Bella Afrik Accra', 'bella-afrik-accra', 'Theatre dining with open kitchens, fire-playing chefs, and spontaneous salsa performances. A complete lifestyle experience blending art, food, and performance.', '["nigerian","continental"]'::jsonb, 'East Legon, Accra', 'accra', 'East Legon', '+233201234012', 'active', 'standard', 'marketplace', 'restaurant', 'moderate', 4.5, 234, 1100, 2000, 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"22:00"},"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"12:00","close":"21:00"}}'::jsonb, 5.6350, -0.1555),

  -- ══════════════════════════════════
  -- KENYA — Nairobi (additional)
  -- ══════════════════════════════════
  (owner_id, 'Cultiva Farm Kenya', 'cultiva-nairobi', 'Stylish farm-to-table restaurant in Karen. Seasonal organic produce with global flavours and a creative twist. Beautiful garden setting.', '["continental","mediterranean"]'::jsonb, 'Karen, Nairobi', 'nairobi', 'Karen', '+254712345010', 'active', 'premium', 'marketplace', 'restaurant', 'upscale', 4.8, 134, 670, 5000, 'https://images.unsplash.com/photo-1428515613728-6b4607e44363?w=800&h=500&fit=crop', '{"tue":{"open":"11:00","close":"22:00"},"wed":{"open":"11:00","close":"22:00"},"thu":{"open":"11:00","close":"22:00"},"fri":{"open":"11:00","close":"23:00"},"sat":{"open":"10:00","close":"23:00"},"sun":{"open":"10:00","close":"16:00"}}'::jsonb, -1.3210, 36.7150),

  (owner_id, 'INTI Nairobi', 'inti-nairobi', 'Chic Nikkei-inspired cuisine — sashimi, sushi, and Japanese-Peruvian fusion. Modern decor and inventive cocktails. Westlands hotspot.', '["asian","seafood"]'::jsonb, 'Westlands, Nairobi', 'nairobi', 'Westlands', '+254712345011', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.7, 156, 780, 7500, 'https://images.unsplash.com/photo-1579027989536-b7b1f875659b?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"22:00"},"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"13:00","close":"23:00"},"sun":{"open":"13:00","close":"21:00"}}'::jsonb, -1.2640, 36.8040),

  (owner_id, 'Habesha Nairobi', 'habesha-nairobi', 'Best Ethiopian food in Nairobi. Cozy garden setting, traditional décor, aromatic platters of injera and richly spiced stews. Authentic experience.', '["other","continental"]'::jsonb, 'Kilimani, Nairobi', 'nairobi', 'Kilimani', '+254712345012', 'active', 'standard', 'marketplace', 'restaurant', 'moderate', 4.6, 267, 1300, 2000, 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=500&fit=crop', '{"mon":{"open":"11:00","close":"22:00"},"tue":{"open":"11:00","close":"22:00"},"wed":{"open":"11:00","close":"22:00"},"thu":{"open":"11:00","close":"22:00"},"fri":{"open":"11:00","close":"22:30"},"sat":{"open":"12:00","close":"22:30"},"sun":{"open":"12:00","close":"21:00"}}'::jsonb, -1.2890, 36.7835),

  -- ══════════════════════════════════
  -- SOUTH AFRICA — Cape Town (additional)
  -- ══════════════════════════════════
  (owner_id, 'Salsify at The Roundhouse', 'salsify-cape-town', 'Made the World''s 50 Best Restaurants extended list. Seasonal tasting menus in a historic setting overlooking Camps Bay. Exceptional wine pairings.', '["continental","mediterranean"]'::jsonb, 'The Roundhouse, Camps Bay', 'cape_town', 'Camps Bay', '+27212345010', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.9, 89, 450, 10000, 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop', '{"wed":{"open":"12:00","close":"14:30"},"thu":{"open":"12:00","close":"14:30"},"fri":{"open":"12:00","close":"14:30","dinner_open":"19:00","dinner_close":"22:00"},"sat":{"open":"12:00","close":"14:30","dinner_open":"19:00","dinner_close":"22:00"}}'::jsonb, -33.9515, 18.3830),

  -- ══════════════════════════════════
  -- RWANDA — Kigali (additional)
  -- ══════════════════════════════════
  (owner_id, 'Rua Kigali', 'rua-kigali', 'Made Condé Nast Traveler''s Hot List. Contemporary Rwandan cuisine with farm-to-table ingredients. Stunning views of the city. Tasting menus available.', '["continental","mediterranean"]'::jsonb, 'Kiyovu, Kigali', 'kigali', 'Kiyovu', '+250781234010', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.9, 67, 340, 7500, 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=500&fit=crop', '{"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"12:00","close":"16:00"}}'::jsonb, -1.9490, 30.0590),

  (owner_id, 'Brachetto Kigali', 'brachetto-kigali', 'Elegant Italian dinners with fine wine. Homemade pastas, steaks, duck dishes. Romantic atmosphere in the heart of Kigali.', '["italian","continental"]'::jsonb, 'Kimihurura, Kigali', 'kigali', 'Kimihurura', '+250781234011', 'active', 'standard', 'marketplace', 'restaurant', 'upscale', 4.6, 123, 600, 3000, 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"22:00"},"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"12:00","close":"21:00"}}'::jsonb, -1.9530, 30.0620),

  -- ══════════════════════════════════
  -- TANZANIA — Dar es Salaam (additional)
  -- ══════════════════════════════════
  (owner_id, 'Karambezi Cafe', 'karambezi-dar', 'Overlooks the Indian Ocean. Fresh local ingredients, stunning sunset views. The most iconic restaurant in Dar es Salaam for seafood and ambiance.', '["seafood","continental"]'::jsonb, 'Msasani, Dar es Salaam', 'dar_es_salaam', 'Msasani', '+255712345010', 'active', 'standard', 'marketplace', 'restaurant', 'upscale', 4.7, 289, 1400, 3000, 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&h=500&fit=crop', '{"mon":{"open":"11:00","close":"22:00"},"tue":{"open":"11:00","close":"22:00"},"wed":{"open":"11:00","close":"22:00"},"thu":{"open":"11:00","close":"22:00"},"fri":{"open":"11:00","close":"23:00"},"sat":{"open":"11:00","close":"23:00"},"sun":{"open":"11:00","close":"21:00"}}'::jsonb, -6.7570, 39.2700),

  (owner_id, 'Mediterraneo Dar', 'mediterraneo-dar', 'Swahili-nuanced Mediterranean and Italian cuisine. Seaside dining with fresh pasta, grilled seafood, and an extensive wine list.', '["italian","mediterranean","seafood"]'::jsonb, 'Oysterbay, Dar es Salaam', 'dar_es_salaam', 'Oysterbay', '+255712345011', 'active', 'standard', 'marketplace', 'restaurant', 'upscale', 4.6, 198, 950, 3000, 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"22:00"},"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"12:00","close":"21:00"}}'::jsonb, -6.7520, 39.2680)

  ON CONFLICT (slug) DO UPDATE SET
    description = EXCLUDED.description,
    cover_photo_url = EXCLUDED.cover_photo_url,
    rating_avg = EXCLUDED.rating_avg,
    rating_count = EXCLUDED.rating_count,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude;

END $$;
