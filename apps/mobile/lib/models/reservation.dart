class Reservation {
  final String id;
  final String referenceCode;
  final String restaurantId;
  final String date;
  final String time;
  final int partySize;
  final String status;
  final String? guestName;
  final String? guestPhone;
  final String? specialRequests;
  final int depositAmount;
  final String depositStatus;
  final String createdAt;
  final String? restaurantName;
  final String? restaurantCoverPhoto;
  final String? restaurantNeighborhood;
  final String? restaurantCity;

  Reservation({
    required this.id,
    required this.referenceCode,
    required this.restaurantId,
    required this.date,
    required this.time,
    required this.partySize,
    required this.status,
    this.guestName,
    this.guestPhone,
    this.specialRequests,
    required this.depositAmount,
    required this.depositStatus,
    required this.createdAt,
    this.restaurantName,
    this.restaurantCoverPhoto,
    this.restaurantNeighborhood,
    this.restaurantCity,
  });

  factory Reservation.fromJson(Map<String, dynamic> json) {
    final restaurant = json['restaurants'];
    final rest = restaurant is List
        ? (restaurant.isNotEmpty ? restaurant[0] : null)
        : restaurant;

    return Reservation(
      id: json['id'] as String,
      referenceCode: json['reference_code'] as String? ?? '',
      restaurantId: json['restaurant_id'] as String? ?? '',
      date: json['date'] as String? ?? '',
      time: json['time'] as String? ?? '',
      partySize: (json['party_size'] as num?)?.toInt() ?? 1,
      status: json['status'] as String? ?? 'pending',
      guestName: json['guest_name'] as String?,
      guestPhone: json['guest_phone'] as String?,
      specialRequests: json['special_requests'] as String?,
      depositAmount: (json['deposit_amount'] as num?)?.toInt() ?? 0,
      depositStatus: json['deposit_status'] as String? ?? 'not_required',
      createdAt: json['created_at'] as String? ?? '',
      restaurantName: rest?['name'] as String?,
      restaurantCoverPhoto: rest?['cover_photo_url'] as String?,
      restaurantNeighborhood: rest?['neighborhood'] as String?,
      restaurantCity: rest?['city'] as String?,
    );
  }

  bool get isUpcoming {
    final today = DateTime.now().toIso8601String().split('T')[0];
    return date.compareTo(today) >= 0 &&
        !['cancelled', 'no_show', 'completed'].contains(status);
  }

  String get statusLabel => status.replaceAll('_', ' ');
}
