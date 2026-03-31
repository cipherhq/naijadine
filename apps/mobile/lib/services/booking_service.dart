import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/reservation.dart';

class BookingService {
  final SupabaseClient _supabase = Supabase.instance.client;

  Future<List<Reservation>> getMyBookings({int limit = 50}) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return [];

    final res = await _supabase
        .from('reservations')
        .select(
            'id, reference_code, restaurant_id, date, time, party_size, status, guest_name, guest_phone, special_requests, deposit_amount, deposit_status, created_at, restaurants (name, cover_photo_url, neighborhood, city)')
        .eq('user_id', user.id)
        .order('date', ascending: false)
        .limit(limit);

    return (res as List).map((r) => Reservation.fromJson(r)).toList();
  }

  Future<Reservation?> getByRef(String referenceCode) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return null;

    final res = await _supabase
        .from('reservations')
        .select(
            'id, reference_code, restaurant_id, date, time, party_size, status, guest_name, guest_phone, special_requests, deposit_amount, deposit_status, created_at, restaurants (name, cover_photo_url, neighborhood, city)')
        .eq('reference_code', referenceCode)
        .eq('user_id', user.id)
        .maybeSingle();

    if (res == null) return null;
    return Reservation.fromJson(res);
  }

  Future<Map<String, dynamic>?> createBooking({
    required String restaurantId,
    required String date,
    required String time,
    required int partySize,
    required String guestName,
    required String guestPhone,
    String? guestEmail,
    String? specialRequests,
  }) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return null;

    // Generate reference code
    final timestamp = DateTime.now().millisecondsSinceEpoch.toString();
    final ref = 'ND${timestamp.substring(timestamp.length - 8)}';

    final res = await _supabase
        .from('reservations')
        .insert({
          'restaurant_id': restaurantId,
          'user_id': user.id,
          'reference_code': ref,
          'date': date,
          'time': time,
          'party_size': partySize,
          'guest_name': guestName,
          'guest_phone': guestPhone,
          'guest_email': guestEmail,
          'special_requests': specialRequests,
          'status': 'pending',
          'channel': 'mobile',
        })
        .select('id, reference_code')
        .single();

    // Create notification
    await _supabase.from('notifications').insert({
      'user_id': user.id,
      'type': 'booking_confirmed',
      'title': 'Booking Confirmed',
      'body': 'Your reservation on $date at $time for $partySize guests has been confirmed. Ref: $ref',
      'is_read': false,
    });

    return res;
  }

  Future<bool> cancelBooking(String bookingId) async {
    try {
      await _supabase
          .from('reservations')
          .update({'status': 'cancelled'})
          .eq('id', bookingId);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> submitReview({
    required String restaurantId,
    required int rating,
    String? text,
  }) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    await _supabase.from('reviews').insert({
      'restaurant_id': restaurantId,
      'user_id': user.id,
      'rating': rating,
      'text': text,
      'is_public': true,
      'moderation_status': 'pending',
    });
  }
}
