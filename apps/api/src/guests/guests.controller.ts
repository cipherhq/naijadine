import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GuestsService } from './guests.service';

@Controller('guests')
@UseGuards(AuthGuard)
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get('restaurant/:restaurantId')
  async getGuests(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
  ) {
    return this.guestsService.getGuestsByRestaurant(
      restaurantId,
      page,
      limit,
      search,
      tag,
    );
  }

  @Get('restaurant/:restaurantId/user/:userId')
  async getGuestProfile(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.guestsService.getGuestProfile(restaurantId, userId);
  }

  @Get('restaurant/:restaurantId/vip')
  async getVipGuests(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
  ) {
    return this.guestsService.getVipGuests(restaurantId);
  }

  @Post('restaurant/:restaurantId/user/:userId/tags')
  async addTag(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body('tag') tag: string,
  ) {
    return this.guestsService.addTag(restaurantId, userId, tag);
  }

  @Delete('restaurant/:restaurantId/user/:userId/tags/:tag')
  async removeTag(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('tag') tag: string,
  ) {
    return this.guestsService.removeTag(restaurantId, userId, tag);
  }

  @Post('restaurant/:restaurantId/user/:userId/notes')
  async addNote(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body('note') note: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.guestsService.addNote(
      restaurantId,
      userId,
      note,
      currentUserId,
    );
  }

  @Post('restaurant/:restaurantId/auto-tag-vips')
  async autoTagVips(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
  ) {
    return this.guestsService.autoTagVips(restaurantId);
  }
}
