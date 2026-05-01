-- ============================================================
-- Expand: More Nigerian cities + African countries
-- ============================================================

-- Add new cities
INSERT INTO public.cities (name, country, is_active, neighborhoods, sort_order) VALUES
  ('Ibadan', 'NG', true, '["Bodija", "Ring Road", "Dugbe", "UI Area", "Oluyole", "Challenge", "Jericho", "Alalubosa"]'::jsonb, 4),
  ('Enugu', 'NG', true, '["Independence Layout", "New Haven", "GRA", "Trans-Ekulu", "Achara Layout", "Ogui Road"]'::jsonb, 5),
  ('Calabar', 'NG', true, '["State Housing", "Marian Road", "Satellite Town", "Diamond Hill", "Ekpo Abasi"]'::jsonb, 6),
  ('Benin City', 'NG', true, '["GRA", "Ring Road", "Uselu", "Ugbowo", "Sapele Road", "Airport Road"]'::jsonb, 7),
  ('Kano', 'NG', true, '["Nassarawa GRA", "Bompai", "Zoo Road", "Ibrahim Taiwo Road", "Sabon Gari"]'::jsonb, 8),
  ('Accra', 'GH', true, '["Osu", "East Legon", "Airport Residential", "Cantonments", "Labone", "Ridge", "Dzorwulu", "Spintex Road"]'::jsonb, 10),
  ('Kumasi', 'GH', true, '["Ahodwo", "Bantama", "Nhyiaeso", "Adum", "Danyame"]'::jsonb, 11),
  ('Nairobi', 'KE', true, '["Westlands", "Karen", "Kilimani", "Lavington", "Hurlingham", "Gigiri", "Kileleshwa", "CBD"]'::jsonb, 12),
  ('Mombasa', 'KE', true, '["Nyali", "Bamburi", "Diani", "Old Town", "Shanzu"]'::jsonb, 13),
  ('Johannesburg', 'ZA', true, '["Sandton", "Rosebank", "Braamfontein", "Melville", "Parkhurst", "Fourways", "Maboneng"]'::jsonb, 14),
  ('Cape Town', 'ZA', true, '["Camps Bay", "Clifton", "Waterfront", "Gardens", "Sea Point", "Stellenbosch", "Constantia"]'::jsonb, 15),
  ('Dar es Salaam', 'TZ', true, '["Masaki", "Oysterbay", "Mikocheni", "Msasani", "Kariakoo"]'::jsonb, 16),
  ('Kigali', 'RW', true, '["Kiyovu", "Kimihurura", "Nyarutarama", "Remera", "Kacyiru"]'::jsonb, 17)
ON CONFLICT (name) DO UPDATE SET
  is_active = true,
  neighborhoods = EXCLUDED.neighborhoods,
  sort_order = EXCLUDED.sort_order;

-- Seed restaurants for new cities
DO $$
DECLARE
  owner_id UUID;
BEGIN
  SELECT id INTO owner_id FROM profiles WHERE role IN ('admin', 'super_admin') LIMIT 1;

  INSERT INTO restaurants (owner_id, name, slug, description, cuisine_types, address, city, neighborhood, phone, status, tier, product_type, business_category, price_range, rating_avg, rating_count, total_bookings, deposit_per_guest, cover_photo_url, operating_hours)
  VALUES
  -- ── Ibadan ──
  (owner_id, 'Kokodome', 'kokodome-ibadan', 'Iconic Ibadan restaurant serving authentic Yoruba cuisine. Famous for amala, gbegiri, ewedu, and assorted meats. A local institution for over 20 years.', '["nigerian"]'::jsonb, '42 Bodija Road, Bodija', 'ibadan', 'Bodija', '+2348012345021', 'active', 'standard', 'marketplace', 'restaurant', 'budget', 4.4, 234, 1500, 0, 'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800&h=500&fit=crop', '{"mon":{"open":"09:00","close":"22:00"},"tue":{"open":"09:00","close":"22:00"},"wed":{"open":"09:00","close":"22:00"},"thu":{"open":"09:00","close":"22:00"},"fri":{"open":"09:00","close":"22:00"},"sat":{"open":"10:00","close":"22:00"},"sun":{"open":"10:00","close":"21:00"}}'::jsonb),

  (owner_id, 'Olaiya Foods', 'olaiya-foods-ibadan', 'Modern Nigerian restaurant with a touch of Continental flair. Sunday brunch is legendary. Beautiful garden seating and private event space.', '["nigerian","continental"]'::jsonb, '8 Ring Road, Ibadan', 'ibadan', 'Ring Road', '+2348012345022', 'active', 'standard', 'marketplace', 'restaurant', 'moderate', 4.3, 178, 950, 1500, 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&h=500&fit=crop', '{"mon":{"open":"10:00","close":"22:00"},"tue":{"open":"10:00","close":"22:00"},"wed":{"open":"10:00","close":"22:00"},"thu":{"open":"10:00","close":"22:00"},"fri":{"open":"10:00","close":"23:00"},"sat":{"open":"11:00","close":"23:00"},"sun":{"open":"11:00","close":"21:00"}}'::jsonb),

  -- ── Enugu ──
  (owner_id, 'Nnewi Kitchen', 'nnewi-kitchen-enugu', 'The finest Igbo cuisine in Enugu. Ofe Nsala, Ji Mmiri Oku, Ugba, and the best palm wine in Coal City. A celebration of Igbo culinary heritage.', '["nigerian"]'::jsonb, '15 Independence Layout', 'enugu', 'Independence Layout', '+2348012345023', 'active', 'standard', 'marketplace', 'restaurant', 'moderate', 4.5, 167, 800, 1500, 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&h=500&fit=crop', '{"mon":{"open":"10:00","close":"22:00"},"tue":{"open":"10:00","close":"22:00"},"wed":{"open":"10:00","close":"22:00"},"thu":{"open":"10:00","close":"22:00"},"fri":{"open":"10:00","close":"22:30"},"sat":{"open":"11:00","close":"22:30"},"sun":{"open":"11:00","close":"21:00"}}'::jsonb),

  -- ── Calabar ──
  (owner_id, 'Tinapa Waterfront', 'tinapa-waterfront-calabar', 'Scenic waterfront dining overlooking the Calabar River. Efik delicacies including edikaikong, ekpang nkukwo, and fresh seafood caught daily.', '["nigerian","seafood"]'::jsonb, 'Tinapa Resort, Calabar', 'calabar', 'State Housing', '+2348012345024', 'active', 'standard', 'marketplace', 'restaurant', 'moderate', 4.6, 145, 650, 2000, 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=500&fit=crop', '{"mon":{"open":"11:00","close":"22:00"},"tue":{"open":"11:00","close":"22:00"},"wed":{"open":"11:00","close":"22:00"},"thu":{"open":"11:00","close":"22:00"},"fri":{"open":"11:00","close":"23:00"},"sat":{"open":"11:00","close":"23:00"},"sun":{"open":"12:00","close":"21:00"}}'::jsonb),

  -- ── Accra, Ghana ──
  (owner_id, 'Buka Restaurant Accra', 'buka-accra', 'West African fine dining in the heart of Osu. Traditional Ghanaian dishes like banku & tilapia, jollof, kelewele, and waakye with a modern presentation.', '["nigerian","continental"]'::jsonb, '12 Oxford Street, Osu', 'accra', 'Osu', '+233201234001', 'active', 'standard', 'marketplace', 'restaurant', 'moderate', 4.5, 234, 1200, 0, 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=800&h=500&fit=crop', '{"mon":{"open":"11:00","close":"22:00"},"tue":{"open":"11:00","close":"22:00"},"wed":{"open":"11:00","close":"22:00"},"thu":{"open":"11:00","close":"22:00"},"fri":{"open":"11:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"12:00","close":"21:00"}}'::jsonb),

  (owner_id, 'Santoku', 'santoku-accra', 'Premium Japanese restaurant in East Legon. Omakase sushi, ramen, and sake. The best Japanese dining experience in West Africa.', '["asian","seafood"]'::jsonb, '8 Jungle Road, East Legon', 'accra', 'East Legon', '+233201234002', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.8, 112, 560, 5000, 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&h=500&fit=crop', '{"tue":{"open":"12:00","close":"22:30"},"wed":{"open":"12:00","close":"22:30"},"thu":{"open":"12:00","close":"22:30"},"fri":{"open":"12:00","close":"23:30"},"sat":{"open":"13:00","close":"23:30"},"sun":{"open":"13:00","close":"21:00"}}'::jsonb),

  (owner_id, 'The Republic Bar & Grill', 'republic-bar-accra', 'Rooftop bar and grill in Osu with panoramic Accra views. Cocktails, grilled meats, and live DJ sets every weekend.', '["grill_bbq","continental"]'::jsonb, '1 Osu Badu Street, Osu', 'accra', 'Osu', '+233201234003', 'active', 'standard', 'marketplace', 'restaurant', 'upscale', 4.6, 189, 900, 3000, 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=500&fit=crop', '{"mon":{"open":"16:00","close":"00:00"},"tue":{"open":"16:00","close":"00:00"},"wed":{"open":"16:00","close":"00:00"},"thu":{"open":"16:00","close":"01:00"},"fri":{"open":"16:00","close":"02:00"},"sat":{"open":"14:00","close":"02:00"},"sun":{"open":"14:00","close":"22:00"}}'::jsonb),

  -- ── Nairobi, Kenya ──
  (owner_id, 'Carnivore', 'carnivore-nairobi', 'Legendary Nairobi restaurant famous for its all-you-can-eat roasted meats. Game meats, ostrich, crocodile, and traditional nyama choma on a live grill.', '["grill_bbq","continental"]'::jsonb, 'Langata Road, Langata', 'nairobi', 'Langata', '+254712345001', 'active', 'premium', 'marketplace', 'restaurant', 'upscale', 4.7, 456, 2500, 5000, 'https://images.unsplash.com/photo-1558030006-450675393462?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"22:00"},"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"12:00","close":"22:00"}}'::jsonb),

  (owner_id, 'Talisman', 'talisman-nairobi', 'Hidden gem in Karen with eclectic global cuisine. Moroccan, Thai, and Ethiopian influences in a magical garden setting. Voted Nairobi''s most romantic restaurant.', '["continental","mediterranean"]'::jsonb, '320 Ngong Road, Karen', 'nairobi', 'Karen', '+254712345002', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.9, 178, 900, 7500, 'https://images.unsplash.com/photo-1428515613728-6b4607e44363?w=800&h=500&fit=crop', '{"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"12:00","close":"16:00"}}'::jsonb),

  (owner_id, 'Mama Oliech', 'mama-oliech-nairobi', 'The best fish in Nairobi. Famous for whole fried tilapia with ugali and sukuma wiki. No-frills, generous portions, and a true Kenyan food experience.', '["nigerian","seafood"]'::jsonb, 'Marcus Garvey Road, Kilimani', 'nairobi', 'Kilimani', '+254712345003', 'active', 'standard', 'marketplace', 'restaurant', 'budget', 4.5, 567, 3200, 0, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop', '{"mon":{"open":"08:00","close":"21:00"},"tue":{"open":"08:00","close":"21:00"},"wed":{"open":"08:00","close":"21:00"},"thu":{"open":"08:00","close":"21:00"},"fri":{"open":"08:00","close":"22:00"},"sat":{"open":"09:00","close":"22:00"},"sun":{"open":"09:00","close":"20:00"}}'::jsonb),

  -- ── Johannesburg, South Africa ──
  (owner_id, 'The Test Kitchen JHB', 'test-kitchen-jhb', 'Award-winning fine dining from celebrity chef. Innovative tasting menus showcasing the best of South African produce. Reservations essential.', '["continental","mediterranean"]'::jsonb, 'Nelson Mandela Square, Sandton', 'johannesburg', 'Sandton', '+27112345001', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.9, 134, 650, 10000, 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop', '{"tue":{"open":"18:00","close":"23:00"},"wed":{"open":"18:00","close":"23:00"},"thu":{"open":"18:00","close":"23:00"},"fri":{"open":"18:00","close":"00:00"},"sat":{"open":"18:00","close":"00:00"}}'::jsonb),

  (owner_id, 'Marble Restaurant', 'marble-rosebank', 'Open-flame cooking over indigenous woods. South African ingredients prepared with precision and creativity. Stunning views of the Johannesburg skyline.', '["grill_bbq","continental"]'::jsonb, 'Keyes Art Mile, Rosebank', 'johannesburg', 'Rosebank', '+27112345002', 'active', 'premium', 'marketplace', 'restaurant', 'upscale', 4.7, 223, 1100, 5000, 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&h=500&fit=crop', '{"mon":{"open":"12:00","close":"22:00"},"tue":{"open":"12:00","close":"22:00"},"wed":{"open":"12:00","close":"22:00"},"thu":{"open":"12:00","close":"22:00"},"fri":{"open":"12:00","close":"23:00"},"sat":{"open":"12:00","close":"23:00"},"sun":{"open":"12:00","close":"16:00"}}'::jsonb),

  -- ── Cape Town, South Africa ──
  (owner_id, 'La Colombe', 'la-colombe-cape-town', 'One of Africa''s top restaurants. French-Asian fusion cuisine with views over Constantia Valley. Multi-course tasting menu with wine pairings from nearby estates.', '["continental","asian"]'::jsonb, 'Silvermist Estate, Constantia', 'cape_town', 'Constantia', '+27212345001', 'active', 'premium', 'marketplace', 'restaurant', 'fine_dining', 4.9, 189, 780, 10000, 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=500&fit=crop', '{"wed":{"open":"12:30","close":"14:30"},"thu":{"open":"12:30","close":"14:30"},"fri":{"open":"12:30","close":"14:30","dinner_open":"19:00","dinner_close":"21:30"},"sat":{"open":"12:30","close":"14:30","dinner_open":"19:00","dinner_close":"21:30"}}'::jsonb),

  -- ── Kigali, Rwanda ──
  (owner_id, 'Heaven Restaurant', 'heaven-kigali', 'Farm-to-table dining with panoramic views of Kigali. Fresh ingredients from local farms, craft cocktails, and a warm Pan-African atmosphere.', '["continental","mediterranean"]'::jsonb, 'KN 29 Street, Kiyovu', 'kigali', 'Kiyovu', '+250781234001', 'active', 'standard', 'marketplace', 'restaurant', 'upscale', 4.7, 145, 700, 3000, 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&h=500&fit=crop', '{"mon":{"open":"07:00","close":"22:00"},"tue":{"open":"07:00","close":"22:00"},"wed":{"open":"07:00","close":"22:00"},"thu":{"open":"07:00","close":"22:00"},"fri":{"open":"07:00","close":"23:00"},"sat":{"open":"08:00","close":"23:00"},"sun":{"open":"08:00","close":"21:00"}}'::jsonb),

  -- ── Dar es Salaam, Tanzania ──
  (owner_id, 'The Waterfront', 'waterfront-dar', 'Seafood restaurant on the Indian Ocean. Fresh catch of the day, Swahili spices, and sunset views over Msasani Bay. The best prawns in East Africa.', '["seafood","continental"]'::jsonb, 'Msasani Peninsula, Msasani', 'dar_es_salaam', 'Msasani', '+255712345001', 'active', 'standard', 'marketplace', 'restaurant', 'upscale', 4.6, 167, 800, 3000, 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&h=500&fit=crop', '{"mon":{"open":"11:00","close":"22:00"},"tue":{"open":"11:00","close":"22:00"},"wed":{"open":"11:00","close":"22:00"},"thu":{"open":"11:00","close":"22:00"},"fri":{"open":"11:00","close":"23:00"},"sat":{"open":"11:00","close":"23:00"},"sun":{"open":"11:00","close":"21:00"}}'::jsonb)

  ON CONFLICT (slug) DO UPDATE SET
    description = EXCLUDED.description,
    cover_photo_url = EXCLUDED.cover_photo_url,
    rating_avg = EXCLUDED.rating_avg,
    rating_count = EXCLUDED.rating_count;

END $$;
