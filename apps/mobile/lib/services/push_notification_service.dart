import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Push notification service
/// NOTE: Firebase packages (firebase_core, firebase_messaging) must be added
/// and configured before this service is fully functional.
/// For now, this stores the FCM token pattern and handles in-app notifications.
class PushNotificationService {
  static final PushNotificationService _instance =
      PushNotificationService._internal();
  factory PushNotificationService() => _instance;
  PushNotificationService._internal();

  final _supabase = Supabase.instance.client;

  /// Initialize push notifications
  /// Call this after Firebase.initializeApp() when firebase_messaging is added
  Future<void> initialize() async {
    // TODO: When firebase_messaging is added:
    // 1. final messaging = FirebaseMessaging.instance;
    // 2. await messaging.requestPermission();
    // 3. final token = await messaging.getToken();
    // 4. await _saveFcmToken(token);
    // 5. messaging.onTokenRefresh.listen(_saveFcmToken);
    // 6. FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
    // 7. FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageTap);
    debugPrint('PushNotificationService initialized (FCM pending)');
  }

  /// Save FCM token to user profile
  Future<void> saveFcmToken(String token) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    await _supabase
        .from('profiles')
        .update({'fcm_token': token}).eq('id', user.id);
  }

  /// Get unread notification count
  Future<int> getUnreadCount() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return 0;

    final response = await _supabase
        .from('notifications')
        .select('id', const FetchOptions(count: CountOption.exact, head: true))
        .eq('user_id', user.id)
        .eq('channel', 'in_app')
        .eq('status', 'sent');

    return response.count ?? 0;
  }

  /// Mark notification as read
  Future<void> markAsRead(String notificationId) async {
    await _supabase
        .from('notifications')
        .update({'status': 'read'}).eq('id', notificationId);
  }

  /// Mark all notifications as read
  Future<void> markAllAsRead() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    await _supabase
        .from('notifications')
        .update({'status': 'read'})
        .eq('user_id', user.id)
        .eq('channel', 'in_app')
        .eq('status', 'sent');
  }
}
