-- Fix remaining broken Unsplash URLs
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&h=500&fit=crop' WHERE slug = 'burgundy-abuja';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=500&fit=crop' WHERE slug = 'bella-afrik-accra';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=500&fit=crop' WHERE slug = 'the-yellow-chilli';
UPDATE public.restaurants SET cover_photo_url = 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&h=500&fit=crop' WHERE slug = 'heaven-kigali';
