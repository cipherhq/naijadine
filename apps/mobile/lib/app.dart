import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'config/theme.dart';
import 'services/auth_service.dart';
import 'screens/shell_screen.dart';
import 'screens/home_screen.dart';
import 'screens/explore_screen.dart';
import 'screens/bookings_screen.dart';
import 'screens/account_screen.dart';
import 'screens/login_screen.dart';
import 'screens/restaurant_detail_screen.dart';
import 'screens/booking_flow_screen.dart';
import 'screens/booking_detail_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/deals_screen.dart';
import 'screens/favorites_screen.dart';
import 'screens/loyalty_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/review_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

class DineRootApp extends StatelessWidget {
  const DineRootApp({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    final router = GoRouter(
      navigatorKey: _rootNavigatorKey,
      initialLocation: '/',
      redirect: (context, state) {
        final loggedIn = auth.isLoggedIn;
        final isLoginRoute = state.matchedLocation == '/login';

        if (!loggedIn && !isLoginRoute && state.matchedLocation != '/') {
          return '/login';
        }
        if (loggedIn && isLoginRoute) {
          return '/';
        }
        return null;
      },
      routes: [
        ShellRoute(
          navigatorKey: _shellNavigatorKey,
          builder: (context, state, child) => ShellScreen(child: child),
          routes: [
            GoRoute(
              path: '/',
              builder: (context, state) => const HomeScreen(),
            ),
            GoRoute(
              path: '/explore',
              builder: (context, state) => ExploreScreen(
                city: state.uri.queryParameters['city'],
                cuisine: state.uri.queryParameters['cuisine'],
              ),
            ),
            GoRoute(
              path: '/bookings',
              builder: (context, state) => const BookingsScreen(),
            ),
            GoRoute(
              path: '/account',
              builder: (context, state) => const AccountScreen(),
            ),
          ],
        ),
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginScreen(),
        ),
        GoRoute(
          path: '/restaurant/:slug',
          builder: (context, state) =>
              RestaurantDetailScreen(slug: state.pathParameters['slug']!),
        ),
        GoRoute(
          path: '/book/:slug',
          builder: (context, state) =>
              BookingFlowScreen(slug: state.pathParameters['slug']!),
        ),
        GoRoute(
          path: '/booking/:ref',
          builder: (context, state) =>
              BookingDetailScreen(referenceCode: state.pathParameters['ref']!),
        ),
        GoRoute(
          path: '/notifications',
          builder: (context, state) => const NotificationsScreen(),
        ),
        GoRoute(
          path: '/deals',
          builder: (context, state) => const DealsScreen(),
        ),
        GoRoute(
          path: '/favorites',
          builder: (context, state) => const FavoritesScreen(),
        ),
        GoRoute(
          path: '/loyalty',
          builder: (context, state) => const LoyaltyScreen(),
        ),
        GoRoute(
          path: '/settings',
          builder: (context, state) => const SettingsScreen(),
        ),
        GoRoute(
          path: '/review/:reservationId',
          builder: (context, state) => ReviewScreen(
            reservationId: state.pathParameters['reservationId']!,
            restaurantName: state.uri.queryParameters['name'] ?? '',
          ),
        ),
      ],
    );

    return MaterialApp.router(
      title: 'DineRoot',
      theme: AppTheme.lightTheme,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
