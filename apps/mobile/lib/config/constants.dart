// DineRoot shared constants (mirrored from @dineroot/shared)

const String appName = 'DineRoot';
const String appTagline = 'Discover. Reserve. Dine.';
const String bookingRefPrefix = 'DR';

// These should be provided via --dart-define at build time:
//   flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
const String supabaseUrl = String.fromEnvironment(
  'SUPABASE_URL',
  defaultValue: 'https://prkghglugnvcwddsfrsm.supabase.co',
);
const String supabaseAnonKey = String.fromEnvironment(
  'SUPABASE_ANON_KEY',
  defaultValue: '',
);

// Brand colors
const int brandPrimary = 0xFFF04E37;
const int brandAccent = 0xFFD93A24;
const int brandGold = 0xFFE8A817;
const int brandLight = 0xFFE8F5EE;

// Cities
const Map<String, CityData> cities = {
  // Nigeria
  'lagos': CityData(name: 'Lagos', country: 'NG', neighborhoods: ['Victoria Island', 'Ikoyi', 'Lekki Phase 1', 'Lekki Phase 2', 'Ikeja GRA', 'Yaba', 'Surulere', 'Ajah', 'Maryland', 'Magodo']),
  'abuja': CityData(name: 'Abuja', country: 'NG', neighborhoods: ['Wuse', 'Wuse 2', 'Maitama', 'Garki', 'Asokoro', 'Jabi', 'Gwarinpa', 'Utako', 'Central Area', 'Katampe']),
  'port_harcourt': CityData(name: 'Port Harcourt', country: 'NG', neighborhoods: ['GRA Phase 1', 'GRA Phase 2', 'Trans-Amadi', 'Old GRA', 'Rumuola', 'Peter Odili Road']),
  'ibadan': CityData(name: 'Ibadan', country: 'NG', neighborhoods: ['Bodija', 'Ring Road', 'Dugbe', 'UI Area', 'Oluyole', 'Jericho']),
  'enugu': CityData(name: 'Enugu', country: 'NG', neighborhoods: ['Independence Layout', 'New Haven', 'GRA', 'Trans-Ekulu', 'Achara Layout']),
  'calabar': CityData(name: 'Calabar', country: 'NG', neighborhoods: ['State Housing', 'Marian Road', 'Satellite Town', 'Diamond Hill']),
  'benin': CityData(name: 'Benin City', country: 'NG', neighborhoods: ['GRA', 'Ring Road', 'Uselu', 'Ugbowo', 'Sapele Road']),
  'kano': CityData(name: 'Kano', country: 'NG', neighborhoods: ['Nassarawa GRA', 'Bompai', 'Zoo Road', 'Sabon Gari']),
  // Ghana
  'accra': CityData(name: 'Accra', country: 'GH', neighborhoods: ['Osu', 'East Legon', 'Airport Residential', 'Cantonments', 'Labone', 'Ridge', 'Dzorwulu']),
  'kumasi': CityData(name: 'Kumasi', country: 'GH', neighborhoods: ['Ahodwo', 'Bantama', 'Nhyiaeso', 'Adum']),
  // Kenya
  'nairobi': CityData(name: 'Nairobi', country: 'KE', neighborhoods: ['Westlands', 'Karen', 'Kilimani', 'Lavington', 'Hurlingham', 'Gigiri', 'CBD']),
  'mombasa': CityData(name: 'Mombasa', country: 'KE', neighborhoods: ['Nyali', 'Bamburi', 'Diani', 'Old Town', 'Shanzu']),
  // South Africa
  'johannesburg': CityData(name: 'Johannesburg', country: 'ZA', neighborhoods: ['Sandton', 'Rosebank', 'Braamfontein', 'Melville', 'Parkhurst', 'Maboneng']),
  'cape_town': CityData(name: 'Cape Town', country: 'ZA', neighborhoods: ['Camps Bay', 'Waterfront', 'Gardens', 'Sea Point', 'Stellenbosch', 'Constantia']),
  // Tanzania
  'dar_es_salaam': CityData(name: 'Dar es Salaam', country: 'TZ', neighborhoods: ['Masaki', 'Oysterbay', 'Mikocheni', 'Msasani']),
  // Rwanda
  'kigali': CityData(name: 'Kigali', country: 'RW', neighborhoods: ['Kiyovu', 'Kimihurura', 'Nyarutarama', 'Remera', 'Kacyiru']),
};

class CityData {
  final String name;
  final String country;
  final List<String> neighborhoods;

  const CityData({required this.name, required this.country, required this.neighborhoods});
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
