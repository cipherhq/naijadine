import { SupabaseClient } from '@supabase/supabase-js';

export async function createInAppNotification(
  supabase: SupabaseClient,
  userId: string,
  type: string,
  title: string,
  body: string,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    channel: 'in_app',
    title,
    body,
    metadata,
    status: 'delivered',
    delivered_at: new Date().toISOString(),
  });
}
