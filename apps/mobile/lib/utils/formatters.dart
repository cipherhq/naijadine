import 'package:intl/intl.dart';

String formatNaira(num amount) {
  final formatter = NumberFormat.currency(
    locale: 'en_NG',
    symbol: '\u20A6',
    decimalDigits: 0,
  );
  return formatter.format(amount);
}

String formatDate(String dateStr) {
  try {
    final date = DateTime.parse('${dateStr}T00:00:00');
    return DateFormat('EEE, d MMM yyyy').format(date);
  } catch (_) {
    return dateStr;
  }
}

String timeAgo(String dateStr) {
  try {
    final date = DateTime.parse(dateStr);
    final diff = DateTime.now().difference(date);

    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('d MMM').format(date);
  } catch (_) {
    return '';
  }
}
