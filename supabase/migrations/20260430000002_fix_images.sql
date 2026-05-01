-- Fix broken images and diversify stock photos
-- Each restaurant gets a unique Unsplash photo

-- Fix broken URLs
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=500&fit=crop' WHERE slug = 'rsvp-lagos';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=800&h=500&fit=crop' WHERE slug = 'blucabana-abuja';

-- Diversify photos to avoid duplicates — unique photo per restaurant
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&h=500&fit=crop' WHERE slug = 'itan-test-kitchen';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?w=800&h=500&fit=crop' WHERE slug = 'mayfair-lagos';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1550966871-3ed3cdb51f3a?w=800&h=500&fit=crop' WHERE slug = 'burgundy-abuja';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1578474846511-04ba529f0b88?w=800&h=500&fit=crop' WHERE slug = 'liquid-hub-abuja';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&h=500&fit=crop' WHERE slug = 'farm-city-abuja';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=800&h=500&fit=crop' WHERE slug = 'sky-bar-phc';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=500&fit=crop' WHERE slug = 'red-coral-phc';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=800&h=500&fit=crop' WHERE slug = 'pomona-accra';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1560053608-13721e0d69e8?w=800&h=500&fit=crop' WHERE slug = 'le-petit-oiseau-accra';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1574936145840-28808d77a706?w=800&h=500&fit=crop' WHERE slug = 'bella-afrik-accra';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&h=500&fit=crop' WHERE slug = 'cultiva-nairobi';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1562802378-063ec186a863?w=800&h=500&fit=crop' WHERE slug = 'inti-nairobi';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800&h=500&fit=crop' WHERE slug = 'habesha-nairobi';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1515443961218-a51367888e4b?w=800&h=500&fit=crop' WHERE slug = 'salsify-cape-town';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&h=500&fit=crop' WHERE slug = 'rua-kigali';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800&h=500&fit=crop' WHERE slug = 'brachetto-kigali';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=800&h=500&fit=crop' WHERE slug = 'karambezi-dar';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800&h=500&fit=crop' WHERE slug = 'mediterraneo-dar';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=500&fit=crop' WHERE slug = 'ciao-italia-abuja';
