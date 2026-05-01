import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ClaimsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Search restaurants available for claiming
   */
  async searchRestaurants(query: string) {
    const { data } = await this.supabase
      .from('restaurants')
      .select('id, name, slug, city, neighborhood, address, cover_photo_url')
      .in('status', ['active', 'approved'])
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(20);

    return data || [];
  }

  /**
   * Submit a claim for a restaurant
   */
  async submitClaim(data: {
    restaurant_id: string;
    claimant_id: string;
    claimant_name: string;
    claimant_email: string;
    claimant_phone: string;
    role_at_restaurant: string;
    proof_description?: string;
    proof_document_url?: string;
    verification_method?: string;
    address_on_proof?: string;
    cac_registration_number?: string;
  }) {
    // Check restaurant exists with full location details
    const { data: restaurant } = await this.supabase
      .from('restaurants')
      .select('id, name, city, neighborhood, address, phone')
      .eq('id', data.restaurant_id)
      .single();

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    // Check no approved claim already exists
    const { data: existingApproved } = await this.supabase
      .from('restaurant_claims')
      .select('id')
      .eq('restaurant_id', data.restaurant_id)
      .eq('status', 'approved')
      .single();

    if (existingApproved) {
      throw new ConflictException('This restaurant has already been claimed');
    }

    // Check user doesn't already have a pending claim for THIS restaurant
    const { data: existingPending } = await this.supabase
      .from('restaurant_claims')
      .select('id')
      .eq('restaurant_id', data.restaurant_id)
      .eq('claimant_id', data.claimant_id)
      .eq('status', 'pending')
      .single();

    if (existingPending) {
      throw new ConflictException(
        'You already have a pending claim for this restaurant',
      );
    }

    // ── Anti-squatting: max 3 pending claims per user ──
    const { count: pendingCount } = await this.supabase
      .from('restaurant_claims')
      .select('*', { count: 'exact', head: true })
      .eq('claimant_id', data.claimant_id)
      .eq('status', 'pending');

    if ((pendingCount || 0) >= 3) {
      throw new BadRequestException(
        'You have too many pending claims. Please wait for existing claims to be reviewed.',
      );
    }

    // ── Fraud detection: build flags for admin review ──
    const fraudFlags: string[] = [];

    // Flag: user already owns other restaurants (chain or squatter?)
    const { count: ownedCount } = await this.supabase
      .from('restaurants')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', data.claimant_id);

    if ((ownedCount || 0) > 0) {
      fraudFlags.push(`OWNS_${ownedCount}_OTHER_RESTAURANTS`);
    }

    // Flag: competing claim from another user
    const { count: otherClaims } = await this.supabase
      .from('restaurant_claims')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', data.restaurant_id)
      .eq('status', 'pending')
      .neq('claimant_id', data.claimant_id);

    if ((otherClaims || 0) > 0) {
      fraudFlags.push('COMPETING_CLAIM_EXISTS');
    }

    // Flag: phone doesn't match restaurant's listed phone
    if (
      restaurant.phone &&
      data.claimant_phone &&
      data.claimant_phone !== restaurant.phone
    ) {
      fraudFlags.push('PHONE_MISMATCH');
    }

    // Flag: user has prior rejections
    const { count: rejectedCount } = await this.supabase
      .from('restaurant_claims')
      .select('*', { count: 'exact', head: true })
      .eq('claimant_id', data.claimant_id)
      .eq('status', 'rejected');

    if ((rejectedCount || 0) > 0) {
      fraudFlags.push(`${rejectedCount}_PRIOR_REJECTIONS`);
    }

    // Flag: no verification document
    if (!data.proof_document_url && !data.cac_registration_number) {
      fraudFlags.push('NO_DOCUMENT_PROVIDED');
    }

    // Flag: address on proof doesn't match restaurant address
    if (
      data.address_on_proof &&
      restaurant.address &&
      !restaurant.address
        .toLowerCase()
        .includes(data.address_on_proof.toLowerCase().slice(0, 20))
    ) {
      fraudFlags.push('ADDRESS_MISMATCH');
    }

    const { data: claim, error } = await this.supabase
      .from('restaurant_claims')
      .insert({
        ...data,
        fraud_flags: fraudFlags,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return claim;
  }

  /**
   * Get claims for a user
   */
  async getUserClaims(userId: string) {
    const { data } = await this.supabase
      .from('restaurant_claims')
      .select('*, restaurants(name, slug, city, neighborhood, cover_photo_url)')
      .eq('claimant_id', userId)
      .order('created_at', { ascending: false });

    return data || [];
  }

  /**
   * Admin: Get all pending claims
   */
  async getPendingClaims(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { data, count } = await this.supabase
      .from('restaurant_claims')
      .select(
        '*, restaurants(name, slug, city, neighborhood, address), profiles!restaurant_claims_claimant_id_fkey(first_name, last_name, email, phone)',
        { count: 'exact' },
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    return { data: data || [], total: count || 0, page, limit };
  }

  /**
   * Admin: Approve a claim — transfers ownership
   */
  async approveClaim(claimId: string, adminId: string) {
    const { data: claim } = await this.supabase
      .from('restaurant_claims')
      .select('*, restaurants(name)')
      .eq('id', claimId)
      .eq('status', 'pending')
      .single();

    if (!claim) {
      throw new NotFoundException('Claim not found or not pending');
    }

    // Transfer ownership
    await this.supabase
      .from('restaurants')
      .update({ owner_id: claim.claimant_id })
      .eq('id', claim.restaurant_id);

    // Update user role to restaurant_owner
    await this.supabase
      .from('profiles')
      .update({ role: 'restaurant_owner' })
      .eq('id', claim.claimant_id);

    // Add to restaurant_staff as owner
    await this.supabase.from('restaurant_staff').upsert(
      {
        restaurant_id: claim.restaurant_id,
        user_id: claim.claimant_id,
        role: 'owner',
        permissions: {
          manage_reservations: true,
          manage_menu: true,
          manage_staff: true,
          manage_finance: true,
          manage_settings: true,
        },
      },
      { onConflict: 'restaurant_id,user_id' },
    );

    // Mark claim as approved
    await this.supabase
      .from('restaurant_claims')
      .update({
        status: 'approved',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', claimId);

    // Reject other pending claims for same restaurant
    await this.supabase
      .from('restaurant_claims')
      .update({
        status: 'rejected',
        admin_notes: 'Another claim was approved for this restaurant',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('restaurant_id', claim.restaurant_id)
      .eq('status', 'pending')
      .neq('id', claimId);

    // Notify the claimant
    await this.notificationsService.dispatch({
      userId: claim.claimant_id,
      type: 'system',
      channels: ['email', 'in_app'],
      title: 'Restaurant Claim Approved!',
      body: `Your claim for "${claim.restaurants?.name}" has been approved. You can now manage your restaurant from the dashboard.`,
      emailSubject: 'Your restaurant is now yours on DineRoot!',
      emailHtml: `<p>Great news! Your claim for <strong>${claim.restaurants?.name}</strong> has been approved.</p><p>You can now log in to the <a href="https://dashboard.dineroot.com">DineRoot Dashboard</a> to manage your restaurant.</p>`,
    });

    // Audit log
    await this.supabase.from('audit_logs').insert({
      action: 'claim_approved',
      entity_type: 'restaurant_claim',
      entity_id: claimId,
      performed_by: adminId,
      details: {
        restaurant_id: claim.restaurant_id,
        claimant_id: claim.claimant_id,
      },
    });

    return { success: true };
  }

  /**
   * Admin: Reject a claim
   */
  async rejectClaim(claimId: string, adminId: string, reason: string) {
    const { data: claim } = await this.supabase
      .from('restaurant_claims')
      .select('*, restaurants(name)')
      .eq('id', claimId)
      .eq('status', 'pending')
      .single();

    if (!claim) {
      throw new NotFoundException('Claim not found or not pending');
    }

    await this.supabase
      .from('restaurant_claims')
      .update({
        status: 'rejected',
        admin_notes: reason,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', claimId);

    // Notify the claimant
    await this.notificationsService.dispatch({
      userId: claim.claimant_id,
      type: 'system',
      channels: ['email', 'in_app'],
      title: 'Restaurant Claim Update',
      body: `Your claim for "${claim.restaurants?.name}" was not approved. Reason: ${reason}. You may submit a new claim with additional documentation.`,
      emailSubject: 'Restaurant Claim Update — DineRoot',
      emailHtml: `<p>Your claim for <strong>${claim.restaurants?.name}</strong> was not approved.</p><p><strong>Reason:</strong> ${reason}</p><p>You may submit a new claim with additional verification documents.</p>`,
    });

    return { success: true };
  }
}
