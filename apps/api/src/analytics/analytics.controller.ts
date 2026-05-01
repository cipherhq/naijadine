import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AnalyticsService } from './analytics.service';
import { InsightsService } from './insights.service';

@Controller('analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly insightsService: InsightsService,
  ) {}

  @Get('restaurant/:restaurantId')
  async getRestaurantAnalytics(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.analyticsService.getRestaurantAnalytics(restaurantId, days);
  }

  @Get('restaurant/:restaurantId/insights')
  async getInsights(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
  ) {
    return this.insightsService.getInsights(restaurantId);
  }
}
