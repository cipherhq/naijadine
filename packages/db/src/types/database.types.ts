// ═══════════════════════════════════════════════════════
// AUTO-GENERATED FILE — DO NOT EDIT MANUALLY
// Run: npm run db:generate-types
// ═══════════════════════════════════════════════════════

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          phone: string | null;
          email: string | null;
          first_name: string;
          last_name: string;
          avatar_url: string | null;
          city: string | null;
          role: 'diner' | 'restaurant_owner' | 'restaurant_staff' | 'admin' | 'super_admin';
          loyalty_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
          loyalty_points: number;
          no_show_count: number;
          is_suspended: boolean;
          suspension_reason: string | null;
          dietary_preferences: Json;
          notification_prefs: Json;
          referral_code: string | null;
          referred_by: string | null;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      restaurants: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          description: string | null;
          cuisine_types: Json;
          address: string;
          city: string;
          neighborhood: string;
          latitude: number | null;
          longitude: number | null;
          phone: string;
          email: string | null;
          status: 'pending' | 'approved' | 'active' | 'suspended' | 'churned';
          tier: 'free' | 'standard' | 'premium';
          product_type: 'marketplace' | 'whatsapp_standalone';
          whatsapp_plan: 'starter' | 'professional' | 'enterprise' | null;
          is_whitelabel: boolean;
          operating_hours: Json;
          price_range: 'budget' | 'moderate' | 'upscale' | 'fine_dining';
          avg_price_per_person: number | null;
          deposit_per_guest: number;
          cancellation_window_hours: number;
          max_advance_booking_days: number;
          walk_in_ratio: number;
          rating_avg: number;
          rating_count: number;
          total_bookings: number;
          logo_url: string | null;
          cover_photo_url: string | null;
          menu_url: string | null;
          instagram_handle: string | null;
          gupshup_app_id: string | null;
          whatsapp_phone_number_id: string | null;
          has_whatsapp_bot: boolean;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['restaurants']['Row']> & { owner_id: string; name: string; slug: string; address: string; city: string; neighborhood: string; phone: string };
        Update: Partial<Database['public']['Tables']['restaurants']['Row']>;
      };
      reservations: {
        Row: {
          id: string;
          reference_code: string;
          restaurant_id: string;
          user_id: string;
          table_id: string | null;
          date: string;
          time: string;
          party_size: number;
          status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'no_show' | 'cancelled';
          booking_type: 'instant' | 'request';
          channel: 'app' | 'web' | 'whatsapp' | 'phone' | 'walk_in';
          special_requests: string | null;
          deposit_amount: number;
          deposit_status: 'none' | 'pending' | 'paid' | 'refunded' | 'forfeited';
          payment_id: string | null;
          deal_id: string | null;
          discount_amount: number;
          confirmed_at: string | null;
          seated_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          cancelled_by: 'diner' | 'restaurant' | 'system' | null;
          cancellation_reason: string | null;
          no_show_marked_at: string | null;
          reminder_24h_sent: boolean;
          reminder_2h_sent: boolean;
          feedback_requested: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['reservations']['Row']> & { restaurant_id: string; user_id: string; date: string; time: string; party_size: number; channel: string };
        Update: Partial<Database['public']['Tables']['reservations']['Row']>;
      };
      // Additional table types will be auto-generated
      // Run: npm run db:generate-types
    };
    Views: {};
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      owns_restaurant: { Args: { restaurant_uuid: string }; Returns: boolean };
      is_restaurant_staff: { Args: { restaurant_uuid: string }; Returns: boolean };
    };
    Enums: {
      user_role: 'diner' | 'restaurant_owner' | 'restaurant_staff' | 'admin' | 'super_admin';
      loyalty_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
      restaurant_status: 'pending' | 'approved' | 'active' | 'suspended' | 'churned';
      reservation_status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'no_show' | 'cancelled';
      payment_status: 'pending' | 'success' | 'failed' | 'refunded';
      booking_channel: 'app' | 'web' | 'whatsapp' | 'phone' | 'walk_in';
    };
  };
}
