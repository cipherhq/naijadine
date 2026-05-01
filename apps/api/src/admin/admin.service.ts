import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformConfigService } from '../common/services/platform-config.service';
import { CacheService } from '../common/services/cache.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly platformConfig: PlatformConfigService,
    private readonly cacheService: CacheService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ── Platform Stats ──

  async getStats() {
    const [restaurants, users, reservations, revenue] = await Promise.all([
      this.supabase
        .from('restaurants')
        .select('status', { count: 'exact', head: true }),
      this.supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true }),
      this.supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true }),
      this.supabase
        .from('payments')
        .select('amount')
        .eq('status', 'success'),
    ]);

    const totalRevenue = (revenue.data || []).reduce(
      (sum, p) => sum + (p.amount || 0),
      0,
    );

    // Pending restaurants
    const { count: pendingCount } = await this.supabase
      .from('restaurants')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Today's reservations
    const today = new Date().toISOString().split('T')[0];
    const { count: todayReservations } = await this.supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('date', today);

    return {
      totalRestaurants: restaurants.count || 0,
      pendingRestaurants: pendingCount || 0,
      totalUsers: users.count || 0,
      totalReservations: reservations.count || 0,
      todayReservations: todayReservations || 0,
      totalRevenue,
    };
  }

  // ── Restaurant Management ──

  async getPendingRestaurants(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { data, count } = await this.supabase
      .from('restaurants')
      .select('*, profiles!restaurants_owner_id_fkey(first_name, last_name, phone, email)', {
        count: 'exact',
      })
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { data: data || [], total: count || 0, page, limit };
  }

  async approveRestaurant(restaurantId: string, approvedBy: string) {
    const { data: restaurant, error } = await this.supabase
      .from('restaurants')
      .update({
        status: 'active',
        approved_at: new Date().toISOString(),
        approved_by: approvedBy,
      })
      .eq('id', restaurantId)
      .eq('status', 'pending')
      .select('*, profiles!restaurants_owner_id_fkey(first_name, email)')
      .single();

    if (error || !restaurant) {
      throw new NotFoundException('Restaurant not found or not pending');
    }

    // Notify owner
    await this.notificationsService.dispatch({
      userId: restaurant.owner_id,
      type: 'system',
      channels: ['email', 'in_app'],
      title: 'Restaurant Approved',
      body: `Your restaurant "${restaurant.name}" has been approved and is now live on DineRoot.`,
      emailSubject: 'Your restaurant is now live on DineRoot!',
      emailHtml: `<p>Congratulations! <strong>${restaurant.name}</strong> has been approved and is now live on DineRoot.</p><p>You can start managing reservations from your dashboard.</p>`,
    });

    return restaurant;
  }

  async suspendRestaurant(
    restaurantId: string,
    reason: string,
    suspendedBy: string,
  ) {
    if (!reason) {
      throw new BadRequestException('Suspension reason is required');
    }

    const { data: restaurant, error } = await this.supabase
      .from('restaurants')
      .update({
        status: 'suspended',
      })
      .eq('id', restaurantId)
      .select('name, owner_id')
      .single();

    if (error || !restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    // Log the suspension
    await this.supabase.from('audit_logs').insert({
      action: 'restaurant_suspended',
      entity_type: 'restaurant',
      entity_id: restaurantId,
      performed_by: suspendedBy,
      details: { reason },
    });

    // Notify owner
    await this.notificationsService.dispatch({
      userId: restaurant.owner_id,
      type: 'system',
      channels: ['email', 'in_app'],
      title: 'Restaurant Suspended',
      body: `Your restaurant "${restaurant.name}" has been suspended. Reason: ${reason}`,
      emailSubject: 'Restaurant Suspended — DineRoot',
      emailHtml: `<p>Your restaurant <strong>${restaurant.name}</strong> has been suspended.</p><p><strong>Reason:</strong> ${reason}</p><p>Please contact support@dineroot.com if you believe this is in error.</p>`,
    });

    return { success: true };
  }

  // ── User Management ──

  async getUsers(
    page = 1,
    limit = 20,
    role?: string,
    search?: string,
  ) {
    const offset = (page - 1) * limit;
    let query = this.supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (role) {
      query = query.eq('role', role);
    }
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
      );
    }

    const { data, count } = await query;
    return { data: data || [], total: count || 0, page, limit };
  }

  async updateUserRole(
    userId: string,
    newRole: string,
    updatedBy: string,
  ) {
    const validRoles = [
      'diner',
      'restaurant_owner',
      'restaurant_staff',
      'admin',
    ];
    if (!validRoles.includes(newRole)) {
      throw new BadRequestException(
        `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      );
    }

    // Only super_admin can promote to admin
    const { data: performer } = await this.supabase
      .from('profiles')
      .select('role')
      .eq('id', updatedBy)
      .single();

    if (newRole === 'admin' && performer?.role !== 'super_admin') {
      throw new BadRequestException('Only super admins can promote to admin');
    }

    const { data, error } = await this.supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('User not found');
    }

    await this.supabase.from('audit_logs').insert({
      action: 'user_role_changed',
      entity_type: 'profile',
      entity_id: userId,
      performed_by: updatedBy,
      details: { new_role: newRole },
    });

    return data;
  }

  async suspendUser(
    userId: string,
    suspend: boolean,
    reason: string,
    performedBy: string,
  ) {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ is_suspended: suspend })
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('User not found');
    }

    await this.supabase.from('audit_logs').insert({
      action: suspend ? 'user_suspended' : 'user_unsuspended',
      entity_type: 'profile',
      entity_id: userId,
      performed_by: performedBy,
      details: { reason },
    });

    return data;
  }

  // ── Refund Management ──

  async getPendingRefunds(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { data, count } = await this.supabase
      .from('refunds')
      .select(
        '*, payments(amount, gateway_reference, reservations(reference_code, restaurant_id))',
        { count: 'exact' },
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { data: data || [], total: count || 0, page, limit };
  }

  async approveRefund(refundId: string, approvedBy: string) {
    const { data: refund, error } = await this.supabase
      .from('refunds')
      .select('*, payments(amount, gateway_reference, user_id)')
      .eq('id', refundId)
      .eq('status', 'pending')
      .single();

    if (error || !refund) {
      throw new NotFoundException('Refund not found or not pending');
    }

    // Update refund status
    await this.supabase
      .from('refunds')
      .update({
        status: 'completed',
        approved_by: approvedBy,
        processed_at: new Date().toISOString(),
      })
      .eq('id', refundId);

    // Update payment status
    await this.supabase
      .from('payments')
      .update({ status: 'refunded' })
      .eq('id', refund.payment_id);

    return { success: true };
  }

  async rejectRefund(
    refundId: string,
    reason: string,
    rejectedBy: string,
  ) {
    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const { error } = await this.supabase
      .from('refunds')
      .update({
        status: 'rejected',
        approved_by: rejectedBy,
        processed_at: new Date().toISOString(),
      })
      .eq('id', refundId)
      .eq('status', 'pending');

    if (error) {
      throw new NotFoundException('Refund not found or not pending');
    }

    return { success: true };
  }

  // ── System Config ──

  async updateConfig(key: string, value: unknown, updatedBy: string) {
    const { data, error } = await this.supabase
      .from('system_configs')
      .upsert(
        {
          key,
          value: String(value),
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' },
      )
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to update config: ${error.message}`);
    }

    // Invalidate cached platform config so changes take effect immediately
    await this.cacheService.del('platform_config');
    await this.platformConfig.reload();

    return data;
  }

  /**
   * Get all config values for admin display
   */
  async getAllConfig() {
    const { data } = await this.supabase
      .from('system_configs')
      .select('key, value, category, description, updated_at')
      .order('category')
      .order('key');

    return data || [];
  }
}
