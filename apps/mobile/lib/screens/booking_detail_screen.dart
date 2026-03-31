import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../config/theme.dart';
import '../config/constants.dart';
import '../models/reservation.dart';
import '../services/booking_service.dart';
import '../utils/formatters.dart';

class BookingDetailScreen extends StatefulWidget {
  final String referenceCode;

  const BookingDetailScreen({super.key, required this.referenceCode});

  @override
  State<BookingDetailScreen> createState() => _BookingDetailScreenState();
}

class _BookingDetailScreenState extends State<BookingDetailScreen> {
  final _bookingService = BookingService();
  Reservation? _booking;
  bool _loading = true;
  bool _cancelling = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final booking = await _bookingService.getByRef(widget.referenceCode);
    if (!mounted) return;
    setState(() {
      _booking = booking;
      _loading = false;
    });
  }

  Future<void> _cancel() async {
    if (_booking == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel Reservation?'),
        content: const Text(
          'Are you sure you want to cancel this reservation? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep It'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(
              'Cancel',
              style: TextStyle(color: Colors.red.shade600),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _cancelling = true);
    final success = await _bookingService.cancelBooking(_booking!.id);
    if (!mounted) return;

    if (success) {
      await _load();
    } else {
      setState(() => _cancelling = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to cancel. Please try again.')),
        );
      }
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'confirmed':
        return AppTheme.primary;
      case 'seated':
        return Colors.blue;
      case 'completed':
        return AppTheme.gold;
      case 'cancelled':
        return Colors.red;
      case 'no_show':
        return Colors.orange;
      default:
        return AppTheme.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Booking')),
        body: const Center(
          child: CircularProgressIndicator(color: AppTheme.primary),
        ),
      );
    }

    if (_booking == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Booking')),
        body: const Center(child: Text('Booking not found')),
      );
    }

    final b = _booking!;

    return Scaffold(
      appBar: AppBar(title: const Text('Booking Details')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Status badge
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.border, width: 0.5),
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: _statusColor(b.status).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      b.statusLabel.toUpperCase(),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: _statusColor(b.status),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    b.restaurantName ?? 'Restaurant',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  if (b.restaurantNeighborhood != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      '${b.restaurantNeighborhood}, ${b.restaurantCity?.replaceAll('_', ' ') ?? ''}',
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Reference code
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(brandLight),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  const Text(
                    'Reference Code',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    b.referenceCode,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 2,
                      color: AppTheme.primary,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Details card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.border, width: 0.5),
              ),
              child: Column(
                children: [
                  _DetailRow(
                    icon: Icons.calendar_today,
                    label: 'Date',
                    value: formatDate(b.date),
                  ),
                  const Divider(height: 20),
                  _DetailRow(
                    icon: Icons.access_time,
                    label: 'Time',
                    value: b.time,
                  ),
                  const Divider(height: 20),
                  _DetailRow(
                    icon: Icons.people_outline,
                    label: 'Party Size',
                    value: '${b.partySize} guest${b.partySize != 1 ? 's' : ''}',
                  ),
                  if (b.guestName != null) ...[
                    const Divider(height: 20),
                    _DetailRow(
                      icon: Icons.person_outline,
                      label: 'Name',
                      value: b.guestName!,
                    ),
                  ],
                  if (b.guestPhone != null) ...[
                    const Divider(height: 20),
                    _DetailRow(
                      icon: Icons.phone_outlined,
                      label: 'Phone',
                      value: b.guestPhone!,
                    ),
                  ],
                  if (b.specialRequests != null &&
                      b.specialRequests!.isNotEmpty) ...[
                    const Divider(height: 20),
                    _DetailRow(
                      icon: Icons.note_outlined,
                      label: 'Requests',
                      value: b.specialRequests!,
                    ),
                  ],
                  if (b.depositAmount > 0) ...[
                    const Divider(height: 20),
                    _DetailRow(
                      icon: Icons.payments_outlined,
                      label: 'Deposit',
                      value:
                          '${formatNaira(b.depositAmount)} (${b.depositStatus.replaceAll('_', ' ')})',
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Cancel button (only for upcoming bookings)
            if (b.isUpcoming && b.status != 'cancelled')
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _cancelling ? null : _cancel,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red,
                    side: const BorderSide(color: Colors.red),
                  ),
                  child: _cancelling
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.red,
                          ),
                        )
                      : const Text('Cancel Reservation'),
                ),
              ),

            const SizedBox(height: 12),

            // Back to bookings
            TextButton(
              onPressed: () => context.go('/bookings'),
              child: const Text(
                'View All Bookings',
                style: TextStyle(fontSize: 13),
              ),
            ),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppTheme.textSecondary),
        const SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                color: AppTheme.textTertiary,
              ),
            ),
            Text(
              value,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: AppTheme.textPrimary,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
