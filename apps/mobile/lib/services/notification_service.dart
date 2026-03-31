import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/app_notification.dart';

class NotificationService {
  final SupabaseClient _supabase = Supabase.instance.client;

  Future<List<AppNotification>> getNotifications({int limit = 30}) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return [];

    final res = await _supabase
        .from('notifications')
        .select('id, type, title, body, is_read, created_at, metadata')
        .eq('user_id', user.id)
        .order('created_at', ascending: false)
        .limit(limit);

    return (res as List).map((n) => AppNotification.fromJson(n)).toList();
  }

  Future<int> getUnreadCount() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return 0;

    final res = await _supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_read', false);

    return (res as List).length;
  }

  Future<void> markAsRead(String id) async {
    await _supabase
        .from('notifications')
        .update({'is_read': true})
        .eq('id', id);
  }

  Future<void> markAllAsRead() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    await _supabase
        .from('notifications')
        .update({'is_read': true})
        .eq('user_id', user.id)
        .eq('is_read', false);
  }
}
