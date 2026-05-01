import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Submit a review for a completed reservation
   */
  async create(dto: CreateReviewDto, userId: string) {
    // Verify reservation exists, belongs to user, and is completed
    const { data: reservation } = await this.supabase
      .from('reservations')
      .select('id, restaurant_id, status')
      .eq('id', dto.reservation_id)
      .eq('user_id', userId)
      .single();

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.status !== 'completed') {
      throw new BadRequestException(
        'Reviews can only be submitted for completed reservations',
      );
    }

    // Check for existing review (one per reservation)
    const { data: existing } = await this.supabase
      .from('reviews')
      .select('id')
      .eq('reservation_id', dto.reservation_id)
      .single();

    if (existing) {
      throw new BadRequestException(
        'You have already reviewed this reservation',
      );
    }

    const { data, error } = await this.supabase
      .from('reviews')
      .insert({
        reservation_id: dto.reservation_id,
        restaurant_id: reservation.restaurant_id,
        user_id: userId,
        rating: dto.rating,
        text: dto.text || null,
        is_public: true,
        moderation_status: 'approved', // Auto-approve, moderate later if flagged
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return data;
  }

  /**
   * Get reviews for a restaurant (public)
   */
  async getByRestaurant(
    restaurantId: string,
    page = 1,
    limit = 20,
  ) {
    const offset = (page - 1) * limit;

    const { data, count } = await this.supabase
      .from('reviews')
      .select(
        '*, profiles(first_name, last_name)',
        { count: 'exact' },
      )
      .eq('restaurant_id', restaurantId)
      .eq('is_public', true)
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Calculate aggregate stats
    const { data: allRatings } = await this.supabase
      .from('reviews')
      .select('rating')
      .eq('restaurant_id', restaurantId)
      .eq('is_public', true)
      .eq('moderation_status', 'approved');

    const ratings = allRatings || [];
    const avgRating =
      ratings.length > 0
        ? Math.round(
            (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10,
          ) / 10
        : 0;

    const distribution = [1, 2, 3, 4, 5].map((star) => ({
      stars: star,
      count: ratings.filter((r) => r.rating === star).length,
    }));

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      stats: {
        average_rating: avgRating,
        total_reviews: ratings.length,
        distribution,
      },
    };
  }

  /**
   * Admin: moderate a review
   */
  async moderate(
    reviewId: string,
    status: 'approved' | 'rejected' | 'flagged',
    moderatedBy: string,
  ) {
    const { data, error } = await this.supabase
      .from('reviews')
      .update({
        moderation_status: status,
        is_public: status === 'approved',
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Review not found');
    }

    return data;
  }

  /**
   * Admin: get reviews pending moderation
   */
  async getPendingModeration(page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const { data, count } = await this.supabase
      .from('reviews')
      .select(
        '*, profiles(first_name, last_name), restaurants(name)',
        { count: 'exact' },
      )
      .eq('moderation_status', 'flagged')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { data: data || [], total: count || 0, page, limit };
  }
}
