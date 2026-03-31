class Deal {
  final String id;
  final String title;
  final String? description;
  final int discountPct;
  final String validFrom;
  final String validTo;
  final String? restaurantName;
  final String? restaurantSlug;
  final String? restaurantCoverPhoto;
  final String? restaurantNeighborhood;

  Deal({
    required this.id,
    required this.title,
    this.description,
    required this.discountPct,
    required this.validFrom,
    required this.validTo,
    this.restaurantName,
    this.restaurantSlug,
    this.restaurantCoverPhoto,
    this.restaurantNeighborhood,
  });

  factory Deal.fromJson(Map<String, dynamic> json) {
    final restaurant = json['restaurants'];
    final rest = restaurant is List
        ? (restaurant.isNotEmpty ? restaurant[0] : null)
        : restaurant;

    return Deal(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      discountPct: (json['discount_pct'] as num?)?.toInt() ?? 0,
      validFrom: json['valid_from'] as String? ?? '',
      validTo: json['valid_to'] as String? ?? '',
      restaurantName: rest?['name'] as String?,
      restaurantSlug: rest?['slug'] as String?,
      restaurantCoverPhoto: rest?['cover_photo_url'] as String?,
      restaurantNeighborhood: rest?['neighborhood'] as String?,
    );
  }
}
