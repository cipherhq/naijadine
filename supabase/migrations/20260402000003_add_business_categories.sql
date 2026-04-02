-- Add 17 new business categories
-- Categories: barber, salon, beauty, laundry, car_wash, mechanic, hotel, clinic,
--            tutor, photography, catering, cleaning, tailor, printing, logistics, bakery, coworking

ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'barber';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'salon';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'beauty';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'laundry';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'car_wash';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'mechanic';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'hotel';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'clinic';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'tutor';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'photography';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'catering';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'cleaning';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'tailor';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'printing';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'logistics';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'bakery';
ALTER TYPE business_category ADD VALUE IF NOT EXISTS 'coworking';
