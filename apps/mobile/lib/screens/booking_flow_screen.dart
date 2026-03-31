import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../config/theme.dart';
import '../config/constants.dart';
import '../models/restaurant.dart';
import '../services/restaurant_service.dart';
import '../services/booking_service.dart';
import '../services/auth_service.dart';
import '../utils/formatters.dart';

class BookingFlowScreen extends StatefulWidget {
  final String slug;

  const BookingFlowScreen({super.key, required this.slug});

  @override
  State<BookingFlowScreen> createState() => _BookingFlowScreenState();
}

class _BookingFlowScreenState extends State<BookingFlowScreen> {
  final _restaurantService = RestaurantService();
  final _bookingService = BookingService();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _requestsController = TextEditingController();

  Restaurant? _restaurant;
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  // Booking fields
  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  String _selectedTime = '19:00';
  int _partySize = 2;

  final List<String> _timeSlots = [
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
  ];

  @override
  void initState() {
    super.initState();
    _loadRestaurant();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _requestsController.dispose();
    super.dispose();
  }

  Future<void> _loadRestaurant() async {
    final restaurant = await _restaurantService.getBySlug(widget.slug);
    if (!mounted) return;

    // Pre-fill name from auth
    final auth = context.read<AuthService>();
    if (auth.displayName.isNotEmpty) {
      _nameController.text = auth.displayName;
    }
    if (auth.phone != null) {
      _phoneController.text = auth.phone!;
    }
    if (auth.currentUser?.email != null) {
      _emailController.text = auth.currentUser!.email!;
    }

    setState(() {
      _restaurant = restaurant;
      _loading = false;
    });
  }

  Future<void> _selectDate() async {
    final now = DateTime.now();
    final maxDays = _restaurant?.advanceBookingDays ?? advanceBookingDays;
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: now,
      lastDate: now.add(Duration(days: maxDays)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(primary: AppTheme.primary),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _submit() async {
    if (_restaurant == null) return;
    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();
    if (name.isEmpty || phone.isEmpty) {
      setState(() => _error = 'Name and phone number are required');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    final result = await _bookingService.createBooking(
      restaurantId: _restaurant!.id,
      date: _selectedDate.toIso8601String().split('T')[0],
      time: _selectedTime,
      partySize: _partySize,
      guestName: name,
      guestPhone: phone,
      guestEmail:
          _emailController.text.trim().isNotEmpty ? _emailController.text.trim() : null,
      specialRequests: _requestsController.text.trim().isNotEmpty
          ? _requestsController.text.trim()
          : null,
    );

    if (!mounted) return;

    if (result != null) {
      final ref = result['reference_code'] as String;
      context.go('/booking/$ref');
    } else {
      setState(() {
        _error = 'Failed to create booking. Please try again.';
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Reserve')),
        body: const Center(
          child: CircularProgressIndicator(color: AppTheme.primary),
        ),
      );
    }

    if (_restaurant == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Reserve')),
        body: const Center(child: Text('Restaurant not found')),
      );
    }

    final r = _restaurant!;
    final deposit = r.depositPerGuest * _partySize;
    final dateStr = formatDate(_selectedDate.toIso8601String().split('T')[0]);

    return Scaffold(
      appBar: AppBar(title: Text('Reserve at ${r.name}')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_error != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _error!,
                  style: TextStyle(color: Colors.red.shade700, fontSize: 13),
                ),
              ),

            // Date picker
            const Text(
              'Date',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
            ),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _selectDate,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.border),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(dateStr,
                        style: const TextStyle(fontSize: 14)),
                    const Icon(Icons.calendar_today,
                        size: 18, color: AppTheme.textSecondary),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Time picker
            const Text(
              'Time',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _timeSlots.map((time) {
                final selected = _selectedTime == time;
                return GestureDetector(
                  onTap: () => setState(() => _selectedTime = time),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: selected ? AppTheme.primary : Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: selected ? AppTheme.primary : AppTheme.border,
                      ),
                    ),
                    child: Text(
                      time,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: selected ? Colors.white : AppTheme.textPrimary,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),

            const SizedBox(height: 20),

            // Party size
            const Text(
              'Party Size',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                IconButton(
                  onPressed: _partySize > 1
                      ? () => setState(() => _partySize--)
                      : null,
                  icon: const Icon(Icons.remove_circle_outline),
                  color: AppTheme.primary,
                ),
                Container(
                  width: 48,
                  alignment: Alignment.center,
                  child: Text(
                    '$_partySize',
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w600),
                  ),
                ),
                IconButton(
                  onPressed: _partySize < r.maxPartySize
                      ? () => setState(() => _partySize++)
                      : null,
                  icon: const Icon(Icons.add_circle_outline),
                  color: AppTheme.primary,
                ),
                Text(
                  'guest${_partySize != 1 ? 's' : ''}',
                  style: const TextStyle(
                      fontSize: 14, color: AppTheme.textSecondary),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // Guest details
            const Text(
              'Your Details',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(
                hintText: 'Full name',
                prefixIcon: Icon(Icons.person_outline),
              ),
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _phoneController,
              decoration: const InputDecoration(
                hintText: 'Phone number',
                prefixIcon: Icon(Icons.phone_outlined),
              ),
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _emailController,
              decoration: const InputDecoration(
                hintText: 'Email (optional)',
                prefixIcon: Icon(Icons.email_outlined),
              ),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _requestsController,
              decoration: const InputDecoration(
                hintText: 'Special requests (optional)',
                prefixIcon: Icon(Icons.note_outlined),
              ),
              maxLines: 2,
            ),

            // Deposit info
            if (r.depositPerGuest > 0) ...[
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(brandLight),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline,
                        size: 18, color: AppTheme.primary),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Deposit: ${formatNaira(deposit)} (${formatNaira(r.depositPerGuest)} x $_partySize guests)',
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 24),

            // Submit
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        deposit > 0
                            ? 'Confirm — ${formatNaira(deposit)} deposit'
                            : 'Confirm Reservation',
                      ),
              ),
            ),

            const SizedBox(height: 12),
            Center(
              child: Text(
                'Free cancellation up to ${r.cancellationHours}h before',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppTheme.textTertiary,
                ),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
