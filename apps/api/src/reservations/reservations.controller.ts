import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SupabaseService } from '../config/supabase.service';

@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateReservationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.reservationsService.create(dto, userId);
  }

  @Get()
  async listMine(
    @CurrentUser('id') userId: string,
    @Query('status') status?: string,
  ) {
    return this.reservationsService.listForUser(userId, status);
  }

  @Get('restaurant/:restaurantId')
  async listForRestaurant(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser('id') userId: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
  ) {
    await this.verifyRestaurantAccess(restaurantId, userId);
    return this.reservationsService.listForRestaurant(restaurantId, date, status);
  }

  @Get('ref/:ref')
  async findByRef(
    @Param('ref') ref: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.reservationsService.findByRef(ref, userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.reservationsService.update(id, dto, userId);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelReservationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.reservationsService.cancel(id, userId, dto.reason, 'diner');
  }

  // ── Staff-only actions (require restaurant ownership/staff check) ──
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Param('id') id: string,
    @Query('restaurant_id') restaurantId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.verifyRestaurantAccess(restaurantId, userId);
    return this.reservationsService.confirm(id, restaurantId);
  }

  @Post(':id/seat')
  @HttpCode(HttpStatus.OK)
  async seat(
    @Param('id') id: string,
    @Query('restaurant_id') restaurantId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.verifyRestaurantAccess(restaurantId, userId);
    return this.reservationsService.seat(id, restaurantId);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async complete(
    @Param('id') id: string,
    @Query('restaurant_id') restaurantId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.verifyRestaurantAccess(restaurantId, userId);
    return this.reservationsService.complete(id, restaurantId);
  }

  @Post(':id/no-show')
  @HttpCode(HttpStatus.OK)
  async markNoShow(
    @Param('id') id: string,
    @Query('restaurant_id') restaurantId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.verifyRestaurantAccess(restaurantId, userId);
    return this.reservationsService.markNoShow(id, restaurantId);
  }

  /**
   * Verify that the authenticated user is the restaurant owner or active staff.
   * Throws ForbiddenException if not authorized.
   */
  private async verifyRestaurantAccess(restaurantId: string, userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Check if user is restaurant owner
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .eq('owner_id', userId)
      .maybeSingle();

    if (restaurant) return;

    // Check if user is active staff
    const { data: staff } = await supabase
      .from('restaurant_staff')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (staff) return;

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile && ['admin', 'super_admin'].includes(profile.role)) return;

    throw new ForbiddenException('You do not have access to this restaurant');
  }
}
