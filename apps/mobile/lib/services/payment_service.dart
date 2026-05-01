import 'dart:convert';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Payment service for Paystack integration via API
class PaymentService {
  final _supabase = Supabase.instance.client;

  /// Initialize a deposit payment for a reservation
  /// Returns the Paystack authorization URL to open in a WebView
  Future<Map<String, dynamic>> initializePayment({
    required String reservationId,
    required String callbackUrl,
  }) async {
    final session = _supabase.auth.currentSession;
    if (session == null) throw Exception('Not authenticated');

    final response = await _supabase.functions.invoke(
      'initialize-payment',
      body: {
        'reservation_id': reservationId,
        'callback_url': callbackUrl,
      },
    );

    if (response.status != 200) {
      throw Exception('Failed to initialize payment');
    }

    return response.data as Map<String, dynamic>;
  }

  /// Verify a payment after Paystack redirect
  Future<Map<String, dynamic>> verifyPayment(String reference) async {
    final response = await _supabase.functions.invoke(
      'verify-payment',
      body: {'reference': reference},
    );

    if (response.status != 200) {
      throw Exception('Payment verification failed');
    }

    return response.data as Map<String, dynamic>;
  }
}
