import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StandaloneService } from './standalone.service';
import { SupabaseService } from '../config/supabase.service';

@Controller('standalone')
@UseGuards(AuthGuard)
export class StandaloneController {
  constructor(
    private readonly standaloneService: StandaloneService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * GET /api/v1/standalone/:restaurantId/tier
   * Check current tier usage and limits for a restaurant.
   */
  @Get(':restaurantId/tier')
  @HttpCode(HttpStatus.OK)
  async getTierInfo(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser('id') userId: string,
  ) {
    const supabase = this.supabaseService.getClient();

    // Verify user owns this restaurant
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .eq('owner_id', userId)
      .single();

    if (!restaurant) {
      return { error: 'Restaurant not found or unauthorized' };
    }

    const tierInfo = await this.standaloneService.checkTierLimits(restaurantId);
    return tierInfo;
  }

  /**
   * GET /api/v1/standalone/:restaurantId/templates
   * Get current bot message templates.
   */
  @Get(':restaurantId/templates')
  @HttpCode(HttpStatus.OK)
  async getTemplates(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser('id') userId: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .eq('owner_id', userId)
      .single();

    if (!restaurant) {
      return { error: 'Restaurant not found or unauthorized' };
    }

    const templates = await this.standaloneService.getBotTemplates(restaurantId);
    return templates;
  }
}
