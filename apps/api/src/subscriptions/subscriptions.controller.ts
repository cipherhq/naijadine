import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@UseGuards(AuthGuard)
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get('restaurant/:restaurantId')
  async getSubscription(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
  ) {
    return this.subscriptionsService.getSubscription(restaurantId);
  }

  @Post('restaurant/:restaurantId')
  async createSubscription(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Body() body: { plan: string; email: string },
  ) {
    return this.subscriptionsService.createSubscription(
      restaurantId,
      body.plan,
      body.email,
    );
  }

  @Post('restaurant/:restaurantId/cancel')
  async cancelSubscription(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
  ) {
    return this.subscriptionsService.cancelSubscription(restaurantId);
  }

  @Get('restaurant/:restaurantId/limits')
  async checkLimits(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
  ) {
    return this.subscriptionsService.checkBookingLimit(restaurantId);
  }

  @Post('activate')
  async activate(@Body('reference') reference: string) {
    return this.subscriptionsService.activateSubscription(reference);
  }
}
