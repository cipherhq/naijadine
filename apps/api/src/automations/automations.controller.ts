import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AutomationsService } from './automations.service';

@Controller('automations')
@UseGuards(AuthGuard)
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get('restaurant/:restaurantId')
  async getByRestaurant(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
  ) {
    // Seed defaults if first time
    await this.automationsService.seedDefaults(restaurantId);
    return this.automationsService.getByRestaurant(restaurantId);
  }

  @Patch(':id/toggle')
  async toggle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('is_active') isActive: boolean,
  ) {
    return this.automationsService.toggle(id, isActive);
  }
}
