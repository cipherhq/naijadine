import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CampaignsService } from './campaigns.service';

@Controller('campaigns')
@UseGuards(AuthGuard, AdminGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    return this.campaignsService.list(page, limit, status);
  }

  @Post()
  async create(
    @Body() body: {
      name: string;
      type: string;
      target_audience: Record<string, unknown>;
      content: Record<string, unknown>;
      scheduled_at?: string;
    },
    @CurrentUser('id') userId: string,
  ) {
    return this.campaignsService.create({ ...body, created_by: userId });
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.campaignsService.update(id, body);
  }

  @Post(':id/execute')
  async execute(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignsService.execute(id);
  }

  @Public()
  @Get('featured')
  async getFeatured() {
    return this.campaignsService.getFeaturedListings();
  }

  @Post('featured')
  async createFeatured(
    @Body() body: {
      restaurant_id: string;
      position: number;
      start_date: string;
      end_date: string;
    },
    @CurrentUser('id') userId: string,
  ) {
    return this.campaignsService.createFeaturedListing({
      ...body,
      created_by: userId,
    });
  }
}
