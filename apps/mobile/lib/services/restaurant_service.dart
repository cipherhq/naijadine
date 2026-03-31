import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/restaurant.dart';
import '../models/deal.dart';

class RestaurantService {
  final SupabaseClient _supabase = Supabase.instance.client;

  Future<List<Restaurant>> getFeatured({int limit = 10}) async {
    final res = await _supabase
        .from('restaurants')
        .select(
            'id, name, slug, cover_photo_url, neighborhood, city, cuisine_types, pricing_tier, avg_rating, total_reviews, deposit_per_guest')
        .inFilter('status', ['active', 'approved'])
        .order('avg_rating', ascending: false)
        .limit(limit);

    return (res as List).map((r) => Restaurant.fromJson(r)).toList();
  }

  Future<List<Restaurant>> search({
    String? query,
    String? city,
    String? cuisine,
    int limit = 20,
  }) async {
    var q = _supabase
        .from('restaurants')
        .select(
            'id, name, slug, cover_photo_url, neighborhood, city, cuisine_types, pricing_tier, avg_rating, total_reviews, deposit_per_guest')
        .inFilter('status', ['active', 'approved']);

    if (city != null && city.isNotEmpty) {
      q = q.eq('city', city);
    }
    if (cuisine != null && cuisine.isNotEmpty) {
      q = q.contains('cuisine_types', [cuisine]);
    }
    if (query != null && query.isNotEmpty) {
      q = q.ilike('name', '%$query%');
    }

    final res = await q.order('avg_rating', ascending: false).limit(limit);
    return (res as List).map((r) => Restaurant.fromJson(r)).toList();
  }

  Future<Restaurant?> getBySlug(String slug) async {
    final res = await _supabase
        .from('restaurants')
        .select('*')
        .eq('slug', slug)
        .inFilter('status', ['active', 'approved'])
        .maybeSingle();

    if (res == null) return null;
    return Restaurant.fromJson(res);
  }

  Future<List<Map<String, dynamic>>> getPhotos(String restaurantId) async {
    final res = await _supabase
        .from('restaurant_photos')
        .select('id, url, caption')
        .eq('restaurant_id', restaurantId)
        .eq('moderation_status', 'approved')
        .order('sort_order');

    return List<Map<String, dynamic>>.from(res);
  }

  Future<List<Map<String, dynamic>>> getReviews(String restaurantId,
      {int limit = 10}) async {
    final res = await _supabase
        .from('reviews')
        .select(
            'id, rating, text, created_at, profiles:user_id (first_name, avatar_url)')
        .eq('restaurant_id', restaurantId)
        .eq('is_public', true)
        .eq('moderation_status', 'approved')
        .order('created_at', ascending: false)
        .limit(limit);

    return List<Map<String, dynamic>>.from(res);
  }

  Future<List<Deal>> getDeals({int limit = 10}) async {
    final today = DateTime.now().toIso8601String().split('T')[0];
    final res = await _supabase
        .from('deals')
        .select(
            'id, title, description, discount_pct, valid_from, valid_to, restaurants (name, slug, cover_photo_url, neighborhood)')
        .eq('is_active', true)
        .gte('valid_to', today)
        .lte('valid_from', today)
        .order('discount_pct', ascending: false)
        .limit(limit);

    return (res as List).map((d) => Deal.fromJson(d)).toList();
  }
}
