import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';

@Injectable()
export class SupportService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ── Tickets ──

  async createTicket(data: {
    reporter_id: string;
    subject: string;
    description: string;
    category?: string;
    priority?: string;
  }) {
    const { data: ticket, error } = await this.supabase
      .from('support_tickets')
      .insert({
        ...data,
        status: 'open',
        priority: data.priority || 'medium',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return ticket;
  }

  async getUserTickets(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { data, count } = await this.supabase
      .from('support_tickets')
      .select('*', { count: 'exact' })
      .eq('reporter_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { data: data || [], total: count || 0, page, limit };
  }

  async getAllTickets(
    page = 1,
    limit = 20,
    status?: string,
    priority?: string,
  ) {
    const offset = (page - 1) * limit;
    let query = this.supabase
      .from('support_tickets')
      .select('*, profiles(first_name, last_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);

    const { data, count } = await query;
    return { data: data || [], total: count || 0, page, limit };
  }

  async getTicket(ticketId: string) {
    const { data: ticket } = await this.supabase
      .from('support_tickets')
      .select('*, profiles(first_name, last_name, email)')
      .eq('id', ticketId)
      .single();

    if (!ticket) throw new NotFoundException('Ticket not found');

    // Get comments
    const { data: comments } = await this.supabase
      .from('ticket_comments')
      .select('*, profiles(first_name, last_name, role)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    return { ...ticket, comments: comments || [] };
  }

  async updateTicket(
    ticketId: string,
    updates: {
      status?: string;
      priority?: string;
      assigned_to?: string;
    },
  ) {
    const updateData: Record<string, unknown> = { ...updates };
    if (updates.status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Ticket not found');
    return data;
  }

  // ── Comments ──

  async addComment(data: {
    ticket_id: string;
    author_id: string;
    message: string;
    is_internal?: boolean;
  }) {
    const { data: comment, error } = await this.supabase
      .from('ticket_comments')
      .insert({
        ...data,
        is_internal: data.is_internal || false,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return comment;
  }
}
