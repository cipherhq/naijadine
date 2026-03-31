import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../config/theme.dart';
import '../config/constants.dart';
import '../models/restaurant.dart';
import '../services/restaurant_service.dart';
import '../services/auth_service.dart';
import '../utils/formatters.dart';

class RestaurantDetailScreen extends StatefulWidget {
  final String slug;

  const RestaurantDetailScreen({super.key, required this.slug});

  @override
  State<RestaurantDetailScreen> createState() => _RestaurantDetailScreenState();
}

class _RestaurantDetailScreenState extends State<RestaurantDetailScreen> {
  final _service = RestaurantService();
  Restaurant? _restaurant;
  List<Map<String, dynamic>> _photos = [];
  List<Map<String, dynamic>> _reviews = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final restaurant = await _service.getBySlug(widget.slug);
    if (restaurant == null || !mounted) return;

    final results = await Future.wait([
      _service.getPhotos(restaurant.id),
      _service.getReviews(restaurant.id),
    ]);

    if (!mounted) return;
    setState(() {
      _restaurant = restaurant;
      _photos = results[0] as List<Map<String, dynamic>>;
      _reviews = results[1] as List<Map<String, dynamic>>;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(
          child: CircularProgressIndicator(color: AppTheme.primary),
        ),
      );
    }

    if (_restaurant == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Restaurant not found')),
      );
    }

    final r = _restaurant!;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // Cover photo header
          SliverAppBar(
            expandedHeight: 220,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: r.coverPhotoUrl != null
                  ? CachedNetworkImage(
                      imageUrl: r.coverPhotoUrl!,
                      fit: BoxFit.cover,
                    )
                  : Container(
                      color: const Color(brandLight),
                      child: Center(
                        child: Text(
                          r.name.substring(0, 1),
                          style: const TextStyle(
                            fontSize: 56,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.primary,
                          ),
                        ),
                      ),
                    ),
            ),
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Name & rating
                  Text(
                    r.name,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      if (r.avgRating > 0) ...[
                        const Icon(Icons.star, size: 16, color: AppTheme.gold),
                        const SizedBox(width: 4),
                        Text(
                          '${r.avgRating.toStringAsFixed(1)} (${r.totalReviews} reviews)',
                          style: const TextStyle(
                            fontSize: 14,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(width: 12),
                      ],
                      Text(
                        r.priceLabel,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    r.cuisineDisplay,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppTheme.textTertiary,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Location
                  _InfoRow(
                    icon: Icons.location_on_outlined,
                    text: '${r.neighborhood}, ${r.cityDisplay}',
                    subtitle: r.address,
                  ),
                  if (r.phone != null)
                    _InfoRow(
                      icon: Icons.phone_outlined,
                      text: r.phone!,
                    ),
                  if (r.instagramHandle != null)
                    _InfoRow(
                      icon: Icons.camera_alt_outlined,
                      text: '@${r.instagramHandle}',
                    ),

                  if (r.description != null && r.description!.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const Text(
                      'About',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      r.description!,
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppTheme.textSecondary,
                        height: 1.5,
                      ),
                    ),
                  ],

                  // Booking info
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(brandLight),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Booking Info',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (r.depositPerGuest > 0)
                          Text(
                            'Deposit: ${formatNaira(r.depositPerGuest)} per guest',
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                        Text(
                          'Max party size: ${r.maxPartySize}',
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        Text(
                          'Book up to ${r.advanceBookingDays} days ahead',
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        Text(
                          'Free cancellation up to ${r.cancellationHours}h before',
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Photos
                  if (_photos.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    const Text(
                      'Photos',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 120,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _photos.length,
                        itemBuilder: (context, index) {
                          final photo = _photos[index];
                          return Container(
                            width: 160,
                            margin: const EdgeInsets.only(right: 10),
                            clipBehavior: Clip.antiAlias,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: CachedNetworkImage(
                              imageUrl: photo['url'] as String,
                              fit: BoxFit.cover,
                            ),
                          );
                        },
                      ),
                    ),
                  ],

                  // Reviews
                  if (_reviews.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    Text(
                      'Reviews (${r.totalReviews})',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 10),
                    ..._reviews.map((review) {
                      final profile = review['profiles'];
                      final prof = profile is List
                          ? (profile.isNotEmpty ? profile[0] : null)
                          : profile;
                      final name = prof?['first_name'] as String? ?? 'Guest';
                      final rating = (review['rating'] as num?)?.toInt() ?? 0;
                      final text = review['text'] as String?;
                      final date = review['created_at'] as String? ?? '';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.border, width: 0.5),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  name,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13,
                                  ),
                                ),
                                Text(
                                  timeAgo(date),
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppTheme.textTertiary,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: List.generate(
                                5,
                                (i) => Icon(
                                  i < rating ? Icons.star : Icons.star_border,
                                  size: 14,
                                  color: AppTheme.gold,
                                ),
                              ),
                            ),
                            if (text != null && text.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(
                                text,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: AppTheme.textSecondary,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ],
                        ),
                      );
                    }),
                  ],

                  const SizedBox(height: 80),
                ],
              ),
            ),
          ),
        ],
      ),

      // Reserve button
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(
          20,
          12,
          20,
          MediaQuery.of(context).padding.bottom + 12,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppTheme.border)),
        ),
        child: ElevatedButton(
          onPressed: () {
            final auth = context.read<AuthService>();
            if (!auth.isLoggedIn) {
              context.push('/login');
              return;
            }
            context.push('/book/${r.slug}');
          },
          child: Text(
            r.depositPerGuest > 0
                ? 'Reserve — ${formatNaira(r.depositPerGuest)}/guest deposit'
                : 'Reserve a Table',
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  final String? subtitle;

  const _InfoRow({required this.icon, required this.text, this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppTheme.textSecondary),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  text,
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppTheme.textPrimary,
                  ),
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppTheme.textTertiary,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
