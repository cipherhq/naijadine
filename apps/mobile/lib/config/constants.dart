// NaijaDine shared constants (mirrored from @naijadine/shared)

const String appName = 'NaijaDine';
const String appTagline = 'Discover. Reserve. Dine.';
const String bookingRefPrefix = 'ND';

const String supabaseUrl = 'https://prkghglugnvcwddsfrsm.supabase.co';
const String supabaseAnonKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBya2doZ2x1Z252Y3dkZHNmcnNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjM3MDUsImV4cCI6MjA4NDgzOTcwNX0.CW6rapdyhG_BYJtEfb8JSpnYl7Rw9Hew9FRnz0_a0N4';

// Brand colors
const int brandPrimary = 0xFF1B4332;
const int brandAccent = 0xFF2D6A4F;
const int brandGold = 0xFFE8A817;
const int brandLight = 0xFFE8F5EE;

// Cities
const Map<String, CityData> cities = {
  'lagos': CityData(
    name: 'Lagos',
    neighborhoods: [
      'Victoria Island', 'Ikoyi', 'Lekki Phase 1', 'Lekki Phase 2',
      'Ikeja', 'Surulere', 'Yaba', 'Ajah', 'Banana Island', 'Eko Atlantic',
    ],
  ),
  'abuja': CityData(
    name: 'Abuja',
    neighborhoods: [
      'Wuse', 'Wuse 2', 'Maitama', 'Garki', 'Asokoro',
      'Gwarinpa', 'Jabi', 'Utako', 'Central Area', 'Katampe',
    ],
  ),
  'port_harcourt': CityData(
    name: 'Port Harcourt',
    neighborhoods: [
      'GRA Phase 1', 'GRA Phase 2', 'Trans-Amadi', 'Old GRA',
      'Rumuola', 'Eleme Junction', 'Ada George', 'Woji',
    ],
  ),
};

class CityData {
  final String name;
  final List<String> neighborhoods;

  const CityData({required this.name, required this.neighborhoods});
}

const List<String> cuisineTypes = [
  'nigerian', 'continental', 'asian', 'mediterranean', 'fast_casual',
  'grill_bbq', 'seafood', 'italian', 'chinese', 'indian', 'lebanese', 'other',
];

const Map<String, String> cuisineLabels = {
  'nigerian': 'Nigerian',
  'continental': 'Continental',
  'asian': 'Asian',
  'mediterranean': 'Mediterranean',
  'fast_casual': 'Fast Casual',
  'grill_bbq': 'Grill & BBQ',
  'seafood': 'Seafood',
  'italian': 'Italian',
  'chinese': 'Chinese',
  'indian': 'Indian',
  'lebanese': 'Lebanese',
  'other': 'Other',
};

// Booking defaults
const int maxPartySize = 20;
const int advanceBookingDays = 30;
const int cancellationHours = 4;
