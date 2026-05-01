import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ── Campaigns CRUD ──

  async list(page = 1, limit = 20, status?: string) {
    const offset = (page - 1) * limit;
    let query = this.supabase
      .from('campaigns')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, count } = await query;
    return { data: data || [], total: count || 0, page, limit };
  }

  async create(campaign: {
    name: string;
    type: string;
    target_audience: Record<string, unknown>;
    content: Record<string, unknown>;
    scheduled_at?: string;
    created_by: string;
  }) {
    const { data, error } = await this.supabase
      .from('campaigns')
      .insert({
        ...campaign,
        status: campaign.scheduled_at ? 'scheduled' : 'draft',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(id: string, updates: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Campaign not found');
    return data;
  }

  async execute(campaignId: string) {
    const { data: campaign } = await this.supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (!campaign) throw new NotFoundException('Campaign not found');

    // Get target users based on audience criteria
    const audience = campaign.target_audience as Record<string, unknown>;
    let query = this.supabase.from('profiles').select('id');

    if (audience.city) query = query.eq('city', audience.city as string);
    if (audience.role) query = query.eq('role', audience.role as string);
    if (audience.loyalty_tier)
      query = query.eq('loyalty_tier', audience.loyalty_tier as string);

    const { data: users } = await query;
    const content = campaign.content as { title: string; body: string };

    let sent = 0;
    for (const user of users || []) {
      try {
        await this.notificationsService.dispatch({
          userId: user.id,
          type: 'broadcast',
          channels: ['email', 'push', 'in_app'],
          title: content.title || campaign.name,
          body: content.body || '',
          emailSubject: content.title || campaign.name,
          emailHtml: `<p>${content.body || ''}</p>`,
          metadata: { campaign_id: campaignId },
        });
        sent++;
      } catch {
        // Continue on individual failures
      }
    }

    await this.supabase
      .from('campaigns')
      .update({
        status: 'completed',
        sent_count: sent,
        completed_at: new Date().toISOString(),
      })
      .eq('id', campaignId);

    return { sent, total_audience: (users || []).length };
  }

  // ── Featured Listings ──

  async getFeaturedListings() {
    const { data } = await this.supabase
      .from('featured_listings')
      .select('*, restaurants(name, slug, cuisine_types, avg_rating)')
      .eq('is_active', true)
      .lte('start_date', new Date().toISOString())
      .gte('end_date', new Date().toISOString())
      .order('position');

    return data || [];
  }

  async createFeaturedListing(listing: {
    restaurant_id: string;
    position: number;
    start_date: string;
    end_date: string;
    created_by: string;
  }) {
    const { data, error } = await this.supabase
      .from('featured_listings')
      .insert({ ...listing, is_active: true })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }
}
