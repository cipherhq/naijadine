class Restaurant {
  final String id;
  final String name;
  final String slug;
  final String? description;
  final String address;
  final String city;
  final String neighborhood;
  final String? phone;
  final List<String> cuisineTypes;
  final String pricingTier;
  final String? coverPhotoUrl;
  final double avgRating;
  final int totalReviews;
  final int depositPerGuest;
  final int maxPartySize;
  final int advanceBookingDays;
  final int cancellationHours;
  final Map<String, dynamic>? operatingHours;
  final String? instagramHandle;
  final String status;

  Restaurant({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    required this.address,
    required this.city,
    required this.neighborhood,
    this.phone,
    required this.cuisineTypes,
    required this.pricingTier,
    this.coverPhotoUrl,
    required this.avgRating,
    required this.totalReviews,
    required this.depositPerGuest,
    required this.maxPartySize,
    required this.advanceBookingDays,
    required this.cancellationHours,
    this.operatingHours,
    this.instagramHandle,
    required this.status,
  });

  factory Restaurant.fromJson(Map<String, dynamic> json) {
    return Restaurant(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      description: json['description'] as String?,
      address: json['address'] as String? ?? '',
      city: json['city'] as String? ?? '',
      neighborhood: json['neighborhood'] as String? ?? '',
      phone: json['phone'] as String?,
      cuisineTypes: (json['cuisine_types'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      pricingTier: json['pricing_tier'] as String? ?? 'moderate',
      coverPhotoUrl: json['cover_photo_url'] as String?,
      avgRating: (json['avg_rating'] as num?)?.toDouble() ?? 0,
      totalReviews: (json['total_reviews'] as num?)?.toInt() ?? 0,
      depositPerGuest: (json['deposit_per_guest'] as num?)?.toInt() ?? 0,
      maxPartySize: (json['max_party_size'] as num?)?.toInt() ?? 20,
      advanceBookingDays: (json['advance_booking_days'] as num?)?.toInt() ?? 30,
      cancellationHours: (json['cancellation_hours'] as num?)?.toInt() ?? 4,
      operatingHours: json['operating_hours'] as Map<String, dynamic>?,
      instagramHandle: json['instagram_handle'] as String?,
      status: json['status'] as String? ?? 'active',
    );
  }

  String get cityDisplay => city.replaceAll('_', ' ');

  String get cuisineDisplay =>
      cuisineTypes.map((c) => c.replaceAll('_', ' ')).join(', ');

  String get priceLabel {
    switch (pricingTier) {
      case 'budget':
        return 'Budget';
      case 'upscale':
        return 'Upscale';
      case 'fine_dining':
        return 'Fine Dining';
      default:
        return 'Moderate';
    }
  }
}
