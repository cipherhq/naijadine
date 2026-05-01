import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/constants.dart';

class LoyaltyScreen extends StatefulWidget {
  const LoyaltyScreen({super.key});

  @override
  State<LoyaltyScreen> createState() => _LoyaltyScreenState();
}

class _LoyaltyScreenState extends State<LoyaltyScreen> {
  final _supabase = Supabase.instance.client;
  Map<String, dynamic>? _profile;
  int _completedBookings = 0;
  bool _loading = true;

  static const _tiers = {
    'bronze': {'name': 'Bronze', 'minBookings': 0, 'discount': 0, 'color': 0xFFCD7F32},
    'silver': {'name': 'Silver', 'minBookings': 5, 'discount': 5, 'color': 0xFFC0C0C0},
    'gold': {'name': 'Gold', 'minBookings': 15, 'discount': 10, 'color': 0xFFE8A817},
    'platinum': {'name': 'Platinum', 'minBookings': 30, 'discount': 15, 'color': 0xFF8B5CF6},
  };

  @override
  void initState() {
    super.initState();
    _loadLoyalty();
  }

  Future<void> _loadLoyalty() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    final profile = await _supabase
        .from('profiles')
        .select('loyalty_tier, loyalty_points')
        .eq('id', user.id)
        .single();

    final bookings = await _supabase
        .from('reservations')
        .select('id', const FetchOptions(count: CountOption.exact, head: true))
        .eq('user_id', user.id)
        .eq('status', 'completed');

    setState(() {
      _profile = profile;
      _completedBookings = bookings.count ?? 0;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final currentTier = (_profile?['loyalty_tier'] ?? 'bronze') as String;
    final tierInfo = _tiers[currentTier]!;
    final points = (_profile?['loyalty_points'] ?? 0) as int;

    // Find next tier
    final tierKeys = _tiers.keys.toList();
    final currentIndex = tierKeys.indexOf(currentTier);
    final nextTier = currentIndex < tierKeys.length - 1
        ? tierKeys[currentIndex + 1]
        : null;
    final nextTierInfo = nextTier != null ? _tiers[nextTier] : null;
    final bookingsToNext = nextTierInfo != null
        ? (nextTierInfo['minBookings'] as int) - _completedBookings
        : 0;

    return Scaffold(
      appBar: AppBar(title: const Text('Loyalty & Rewards')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Current tier card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Color(tierInfo['color'] as int).withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: Color(tierInfo['color'] as int).withOpacity(0.3),
                ),
              ),
              child: Column(
                children: [
                  Icon(Icons.workspace_premium,
                      size: 48, color: Color(tierInfo['color'] as int)),
                  const SizedBox(height: 12),
                  Text(
                    '${tierInfo['name']} Member',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${tierInfo['discount']}% discount on deposits',
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _statBadge('$_completedBookings', 'Bookings'),
                      const SizedBox(width: 24),
                      _statBadge('$points', 'Points'),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Progress to next tier
            if (nextTierInfo != null) ...[
              Text('Next: ${nextTierInfo['name']}',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: _completedBookings /
                    (nextTierInfo['minBookings'] as int),
                backgroundColor: Colors.grey[200],
                color: const Color(brandPrimary),
              ),
              const SizedBox(height: 8),
              Text('$bookingsToNext more bookings to reach ${nextTierInfo['name']}',
                  style: Theme.of(context).textTheme.bodySmall),
            ],

            const SizedBox(height: 32),

            // All tiers
            Text('All Tiers',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            ..._tiers.entries.map((entry) {
              final isActive = entry.key == currentTier;
              final info = entry.value;
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isActive
                      ? Color(info['color'] as int).withOpacity(0.1)
                      : Colors.grey[50],
                  borderRadius: BorderRadius.circular(12),
                  border: isActive
                      ? Border.all(color: Color(info['color'] as int))
                      : null,
                ),
                child: Row(
                  children: [
                    Icon(
                      isActive ? Icons.check_circle : Icons.circle_outlined,
                      color: Color(info['color'] as int),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(info['name'] as String,
                              style: const TextStyle(fontWeight: FontWeight.bold)),
                          Text('${info['minBookings']}+ bookings · ${info['discount']}% off',
                              style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _statBadge(String value, String label) {
    return Column(
      children: [
        Text(value,
            style: const TextStyle(
                fontSize: 24, fontWeight: FontWeight.bold)),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
