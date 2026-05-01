import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/constants.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  final _supabase = Supabase.instance.client;
  List<Map<String, dynamic>> _favorites = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadFavorites();
  }

  Future<void> _loadFavorites() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    final response = await _supabase
        .from('favorites')
        .select('restaurant_id, restaurants(id, name, slug, cuisine_types, avg_rating, city, neighborhood)')
        .eq('user_id', user.id);

    setState(() {
      _favorites = List<Map<String, dynamic>>.from(response);
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Favorites')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _favorites.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.favorite_border,
                          size: 64, color: Colors.grey[300]),
                      const SizedBox(height: 16),
                      Text('No favorites yet',
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 8),
                      Text('Save restaurants you love to find them quickly',
                          style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _favorites.length,
                  itemBuilder: (context, index) {
                    final fav = _favorites[index];
                    final restaurant =
                        fav['restaurants'] as Map<String, dynamic>?;
                    if (restaurant == null) return const SizedBox.shrink();

                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        title: Text(restaurant['name'] ?? ''),
                        subtitle: Text(
                          '${restaurant['city'] ?? ''} · ${(restaurant['cuisine_types'] as List?)?.first ?? ''}',
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.star,
                                color: Color(brandGold), size: 16),
                            const SizedBox(width: 4),
                            Text(
                              (restaurant['avg_rating'] ?? 0)
                                  .toStringAsFixed(1),
                            ),
                          ],
                        ),
                        onTap: () => context.go(
                            '/restaurant/${restaurant['slug']}'),
                      ),
                    );
                  },
                ),
    );
  }
}
