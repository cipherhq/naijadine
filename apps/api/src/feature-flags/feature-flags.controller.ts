import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FeatureFlagsService } from './feature-flags.service';

@Controller('flags')
export class FeatureFlagsController {
  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  /**
   * Check a single flag (public — used by frontend)
   */
  @Public()
  @Get(':key')
  async checkFlag(
    @Param('key') key: string,
    @Query('userId') userId?: string,
  ) {
    const enabled = await this.featureFlagsService.isEnabled(key, userId);
    return { key, enabled };
  }

  /**
   * Get all flags for current user
   */
  @UseGuards(AuthGuard)
  @Get()
  async getAllFlags(@CurrentUser('id') userId: string) {
    const flags = await this.featureFlagsService.getAllFlags(userId);
    return { flags };
  }

  /**
   * Admin: list all flags with details
   */
  @UseGuards(AuthGuard, AdminGuard)
  @Get('admin/list')
  async listFlags() {
    return this.featureFlagsService.listFlags();
  }

  /**
   * Admin: update a flag
   */
  @UseGuards(AuthGuard, AdminGuard)
  @Put(':key')
  async updateFlag(
    @Param('key') key: string,
    @Body()
    body: {
      is_enabled?: boolean;
      rollout_percentage?: number;
      conditions?: Record<string, unknown>;
      description?: string;
    },
  ) {
    return this.featureFlagsService.updateFlag(key, body);
  }
}
