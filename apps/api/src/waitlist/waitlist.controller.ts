import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WaitlistService } from './waitlist.service';
import { CreateWaitlistEntryDto } from './dto/create-waitlist-entry.dto';

@Controller('waitlist')
@UseGuards(AuthGuard)
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  async create(
    @Body() dto: CreateWaitlistEntryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.waitlistService.create(dto, userId);
  }

  @Get('restaurant/:restaurantId')
  async getByRestaurant(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
  ) {
    return this.waitlistService.getByRestaurant(restaurantId);
  }

  @Patch(':id/notify')
  async notifyGuest(@Param('id', ParseUUIDPipe) id: string) {
    return this.waitlistService.notifyGuest(id);
  }

  @Patch(':id/seat')
  async seatGuest(@Param('id', ParseUUIDPipe) id: string) {
    return this.waitlistService.seatGuest(id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.waitlistService.remove(id);
  }
}
