import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/auth_service.dart';
import '../config/constants.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _supabase = Supabase.instance.client;
  Map<String, dynamic>? _profile;
  bool _loading = true;

  // Notification preferences
  bool _emailNotifs = true;
  bool _smsNotifs = true;
  bool _pushNotifs = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    final profile = await _supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    final prefs = (profile['notification_preferences'] as Map?) ?? {};

    setState(() {
      _profile = profile;
      _emailNotifs = prefs['email'] ?? true;
      _smsNotifs = prefs['sms'] ?? true;
      _pushNotifs = prefs['push'] ?? true;
      _loading = false;
    });
  }

  Future<void> _updateNotifPref(String channel, bool value) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    final prefs = {
      'email': _emailNotifs,
      'sms': _smsNotifs,
      'push': _pushNotifs,
    };
    prefs[channel] = value;

    await _supabase
        .from('profiles')
        .update({'notification_preferences': prefs}).eq('id', user.id);
  }

  Future<void> _deleteAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Account'),
        content: const Text(
          'This will permanently delete your account and all associated data. '
          'This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    // Call NDPA deletion endpoint
    await _supabase.rpc('delete_user_data');
    await _supabase.auth.signOut();

    if (mounted) {
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          // Notification Preferences
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text('Notifications',
                style: TextStyle(
                    fontWeight: FontWeight.bold, color: Color(brandPrimary))),
          ),
          SwitchListTile(
            title: const Text('Email notifications'),
            subtitle: const Text('Booking confirmations and reminders'),
            value: _emailNotifs,
            onChanged: (v) {
              setState(() => _emailNotifs = v);
              _updateNotifPref('email', v);
            },
          ),
          SwitchListTile(
            title: const Text('SMS notifications'),
            subtitle: const Text('Text message reminders'),
            value: _smsNotifs,
            onChanged: (v) {
              setState(() => _smsNotifs = v);
              _updateNotifPref('sms', v);
            },
          ),
          SwitchListTile(
            title: const Text('Push notifications'),
            subtitle: const Text('Real-time alerts on your device'),
            value: _pushNotifs,
            onChanged: (v) {
              setState(() => _pushNotifs = v);
              _updateNotifPref('push', v);
            },
          ),

          const Divider(),

          // Dietary Preferences
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text('Preferences',
                style: TextStyle(
                    fontWeight: FontWeight.bold, color: Color(brandPrimary))),
          ),
          ListTile(
            leading: const Icon(Icons.restaurant_menu),
            title: const Text('Dietary preferences'),
            subtitle: Text(
              (_profile?['dietary_preferences'] as List?)?.join(', ') ??
                  'None set',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              // TODO: dietary preference editor
            },
          ),

          const Divider(),

          // Legal
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text('Legal',
                style: TextStyle(
                    fontWeight: FontWeight.bold, color: Color(brandPrimary))),
          ),
          ListTile(
            leading: const Icon(Icons.description),
            title: const Text('Terms of Service'),
            onTap: () => launchUrl(Uri.parse('https://dineroot.com/terms')),
          ),
          ListTile(
            leading: const Icon(Icons.privacy_tip),
            title: const Text('Privacy Policy'),
            onTap: () => launchUrl(Uri.parse('https://dineroot.com/privacy')),
          ),
          ListTile(
            leading: const Icon(Icons.download),
            title: const Text('Export my data'),
            subtitle: const Text('Download all your personal data'),
            onTap: () async {
              final data = await _supabase.rpc('export_user_data');
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Data export requested. Check your email.')),
                );
              }
            },
          ),

          const Divider(),

          // Danger zone
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text('Account',
                style: TextStyle(
                    fontWeight: FontWeight.bold, color: Colors.red)),
          ),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.orange),
            title: const Text('Sign Out'),
            onTap: () async {
              await context.read<AuthService>().signOut();
              if (mounted) context.go('/login');
            },
          ),
          ListTile(
            leading: const Icon(Icons.delete_forever, color: Colors.red),
            title: const Text('Delete Account',
                style: TextStyle(color: Colors.red)),
            subtitle: const Text('Permanently delete your account and data'),
            onTap: _deleteAccount,
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}
