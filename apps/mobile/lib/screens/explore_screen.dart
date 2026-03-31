import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/theme.dart';
import '../config/constants.dart';
import '../models/restaurant.dart';
import '../services/restaurant_service.dart';

class ExploreScreen extends StatefulWidget {
  final String? city;
  final String? cuisine;

  const ExploreScreen({super.key, this.city, this.cuisine});

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  final _service = RestaurantService();
  final _searchController = TextEditingController();
  List<Restaurant> _results = [];
  bool _loading = true;
  String? _selectedCity;
  String? _selectedCuisine;

  @override
  void initState() {
    super.initState();
    _selectedCity = widget.city;
    _selectedCuisine = widget.cuisine;
    _search();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    setState(() => _loading = true);
    final results = await _service.search(
      query: _searchController.text.isEmpty ? null : _searchController.text,
      city: _selectedCity,
      cuisine: _selectedCuisine,
      limit: 30,
    );
    if (!mounted) return;
    setState(() {
      _results = results;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Explore'),
        automaticallyImplyLeading: false,
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search restaurants...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          _search();
                        },
                      )
                    : null,
              ),
              onSubmitted: (_) => _search(),
            ),
          ),

          // City filter
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _FilterChip(
                  label: 'All Cities',
                  selected: _selectedCity == null,
                  onTap: () {
                    setState(() => _selectedCity = null);
                    _search();
                  },
                ),
                ...cities.entries.map(
                  (e) => _FilterChip(
                    label: e.value.name,
                    selected: _selectedCity == e.key,
                    onTap: () {
                      setState(() => _selectedCity = e.key);
                      _search();
                    },
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Cuisine filter
          SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _FilterChip(
                  label: 'All Cuisines',
                  selected: _selectedCuisine == null,
                  onTap: () {
                    setState(() => _selectedCuisine = null);
                    _search();
                  },
                  small: true,
                ),
                ...cuisineTypes.map(
                  (type) => _FilterChip(
                    label: cuisineLabels[type] ?? type,
                    selected: _selectedCuisine == type,
                    onTap: () {
                      setState(() => _selectedCuisine = type);
                      _search();
                    },
                    small: true,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Results
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: AppTheme.primary))
                : _results.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.restaurant_outlined,
                                size: 48, color: Colors.grey.shade300),
                            const SizedBox(height: 12),
                            const Text(
                              'No restaurants found',
                              style: TextStyle(
                                  color: AppTheme.textSecondary, fontSize: 14),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _search,
                        color: AppTheme.primary,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: _results.length,
                          itemBuilder: (context, index) {
                            final r = _results[index];
                            return _ExploreCard(restaurant: r);
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool small;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.small = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: small ? 10 : 14,
            vertical: small ? 6 : 8,
          ),
          decoration: BoxDecoration(
            color: selected ? AppTheme.primary : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected ? AppTheme.primary : AppTheme.border,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: small ? 11 : 12,
              fontWeight: FontWeight.w500,
              color: selected ? Colors.white : AppTheme.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

class _ExploreCard extends StatelessWidget {
  final Restaurant restaurant;

  const _ExploreCard({required this.restaurant});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/restaurant/${restaurant.slug}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: Colors.white,
          border: Border.all(color: AppTheme.border, width: 0.5),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 140,
              width: double.infinity,
              child: restaurant.coverPhotoUrl != null
                  ? CachedNetworkImage(
                      imageUrl: restaurant.coverPhotoUrl!,
                      fit: BoxFit.cover,
                    )
                  : Container(
                      color: const Color(brandLight),
                      child: Center(
                        child: Text(
                          restaurant.name.substring(0, 1),
                          style: const TextStyle(
                              fontSize: 36,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.primary),
                        ),
                      ),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    restaurant.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 16),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${restaurant.neighborhood}, ${restaurant.cityDisplay}',
                    style: const TextStyle(
                        fontSize: 13, color: AppTheme.textSecondary),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      if (restaurant.avgRating > 0) ...[
                        const Icon(Icons.star, size: 14, color: AppTheme.gold),
                        const SizedBox(width: 3),
                        Text(
                          '${restaurant.avgRating.toStringAsFixed(1)} (${restaurant.totalReviews})',
                          style: const TextStyle(
                              fontSize: 12, color: AppTheme.textPrimary),
                        ),
                        const SizedBox(width: 12),
                      ],
                      Text(
                        restaurant.priceLabel,
                        style: const TextStyle(
                            fontSize: 12, color: AppTheme.textTertiary),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          restaurant.cuisineDisplay,
                          style: const TextStyle(
                              fontSize: 12, color: AppTheme.textTertiary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
