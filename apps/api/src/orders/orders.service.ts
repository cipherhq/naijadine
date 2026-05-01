import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderStatus } from './dto/update-order-status.dto';

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['picked_up', 'delivered'],
  picked_up: ['delivered'],
  delivered: [],
  cancelled: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async getUserOrders(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { data, count } = await this.supabase
      .from('orders')
      .select('*, order_items(*), restaurants(name, slug)', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { data: data || [], total: count || 0, page, limit };
  }

  async getRestaurantOrders(
    restaurantId: string,
    status?: string,
    page = 1,
    limit = 20,
  ) {
    const offset = (page - 1) * limit;
    let query = this.supabase
      .from('orders')
      .select('*, order_items(*), profiles(first_name, last_name, phone)', {
        count: 'exact',
      })
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count } = await query;
    return { data: data || [], total: count || 0, page, limit };
  }

  async updateStatus(
    orderId: string,
    newStatus: OrderStatus,
    reason?: string,
  ) {
    // Fetch current order
    const { data: order } = await this.supabase
      .from('orders')
      .select('*, restaurants(name)')
      .eq('id', orderId)
      .single();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from "${order.status}" to "${newStatus}". Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }

    // Update status
    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === OrderStatus.CANCELLED && reason) {
      updateData.cancellation_reason = reason;
    }
    if (newStatus === OrderStatus.DELIVERED) {
      updateData.delivered_at = new Date().toISOString();
    }

    const { data: updated, error } = await this.supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    // Send notification to customer
    const statusMessages: Record<string, string> = {
      confirmed: `Your order from ${order.restaurants?.name} has been confirmed.`,
      preparing: `Your order from ${order.restaurants?.name} is being prepared.`,
      ready: `Your order from ${order.restaurants?.name} is ready for pickup!`,
      delivered: `Your order from ${order.restaurants?.name} has been delivered.`,
      cancelled: `Your order from ${order.restaurants?.name} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
    };

    if (statusMessages[newStatus]) {
      await this.notificationsService.dispatch({
        userId: order.user_id,
        type: 'system',
        channels: ['push', 'in_app'],
        title: `Order ${newStatus.replace('_', ' ')}`,
        body: statusMessages[newStatus],
        metadata: {
          order_id: orderId,
          reference_code: order.reference_code,
        },
      });
    }

    return updated;
  }

  async cancelOrder(orderId: string, userId: string, reason?: string) {
    const { data: order } = await this.supabase
      .from('orders')
      .select('status, user_id')
      .eq('id', orderId)
      .single();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.user_id !== userId) {
      throw new BadRequestException('You can only cancel your own orders');
    }

    const cancellable = ['pending_payment', 'confirmed'];
    if (!cancellable.includes(order.status)) {
      throw new BadRequestException(
        'Order can only be cancelled when pending or confirmed',
      );
    }

    return this.updateStatus(orderId, OrderStatus.CANCELLED, reason);
  }
}
