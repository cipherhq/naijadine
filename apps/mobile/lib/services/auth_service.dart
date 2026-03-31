import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthService extends ChangeNotifier {
  final SupabaseClient _supabase = Supabase.instance.client;

  User? get currentUser => _supabase.auth.currentUser;
  bool get isLoggedIn => currentUser != null;

  String? _firstName;
  String? _lastName;
  String? _phone;
  String? _loyaltyTier;

  String? get firstName => _firstName;
  String? get phone => _phone;
  String? get loyaltyTier => _loyaltyTier;
  String get displayName =>
      [_firstName, _lastName].where((s) => s != null && s.isNotEmpty).join(' ');

  AuthService() {
    _supabase.auth.onAuthStateChange.listen((data) {
      if (data.session != null) {
        _loadProfile();
      } else {
        _firstName = null;
        _lastName = null;
        _phone = null;
        _loyaltyTier = null;
      }
      notifyListeners();
    });

    if (isLoggedIn) _loadProfile();
  }

  Future<void> _loadProfile() async {
    if (currentUser == null) return;
    final res = await _supabase
        .from('profiles')
        .select('first_name, last_name, phone, loyalty_tier')
        .eq('id', currentUser!.id)
        .maybeSingle();

    if (res != null) {
      _firstName = res['first_name'] as String?;
      _lastName = res['last_name'] as String?;
      _phone = res['phone'] as String?;
      _loyaltyTier = res['loyalty_tier'] as String?;
      notifyListeners();
    }
  }

  Future<String?> signInWithOtp(String phone) async {
    try {
      await _supabase.auth.signInWithOtp(phone: phone);
      return null;
    } on AuthException catch (e) {
      return e.message;
    }
  }

  Future<String?> verifyOtp(String phone, String token) async {
    try {
      await _supabase.auth.verifyOTP(
        phone: phone,
        token: token,
        type: OtpType.sms,
      );
      await _loadProfile();
      return null;
    } on AuthException catch (e) {
      return e.message;
    }
  }

  Future<String?> signInWithEmail(String email, String password) async {
    try {
      await _supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );
      await _loadProfile();
      return null;
    } on AuthException catch (e) {
      return e.message;
    }
  }

  Future<String?> signUpWithEmail(
      String email, String password, String firstName) async {
    try {
      await _supabase.auth.signUp(
        email: email,
        password: password,
        data: {'first_name': firstName},
      );
      await _loadProfile();
      return null;
    } on AuthException catch (e) {
      return e.message;
    }
  }

  Future<void> updateProfile({String? firstName, String? lastName}) async {
    if (currentUser == null) return;
    final updates = <String, dynamic>{};
    if (firstName != null) updates['first_name'] = firstName;
    if (lastName != null) updates['last_name'] = lastName;
    if (updates.isNotEmpty) {
      await _supabase
          .from('profiles')
          .update(updates)
          .eq('id', currentUser!.id);
      await _loadProfile();
    }
  }

  Future<void> signOut() async {
    await _supabase.auth.signOut();
    _firstName = null;
    _lastName = null;
    _phone = null;
    _loyaltyTier = null;
    notifyListeners();
  }
}
