import {
  Controller,
  Get,
  Post,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ClaimsService } from './claims.service';

@Controller('claims')
@UseGuards(AuthGuard)
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  /**
   * Search restaurants to claim (authenticated users)
   */
  @Get('restaurants/search')
  async searchRestaurants(@Query('q') query: string) {
    return this.claimsService.searchRestaurants(query || '');
  }

  /**
   * Submit a claim
   */
  @Post()
  async submitClaim(
    @Body()
    body: {
      restaurant_id: string;
      claimant_name: string;
      claimant_email: string;
      claimant_phone: string;
      role_at_restaurant: string;
      proof_description?: string;
      proof_document_url?: string;
      verification_method?: string;
      address_on_proof?: string;
      cac_registration_number?: string;
    },
    @CurrentUser('id') userId: string,
  ) {
    return this.claimsService.submitClaim({
      ...body,
      claimant_id: userId,
    });
  }

  /**
   * Get my claims
   */
  @Get('mine')
  async getMyClaims(@CurrentUser('id') userId: string) {
    return this.claimsService.getUserClaims(userId);
  }

  /**
   * Admin: Get pending claims
   */
  @Get('pending')
  @UseGuards(AdminGuard)
  async getPendingClaims(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.claimsService.getPendingClaims(page, limit);
  }

  /**
   * Admin: Approve a claim
   */
  @Post(':id/approve')
  @UseGuards(AdminGuard)
  async approveClaim(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.claimsService.approveClaim(id, adminId);
  }

  /**
   * Admin: Reject a claim
   */
  @Post(':id/reject')
  @UseGuards(AdminGuard)
  async rejectClaim(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.claimsService.rejectClaim(id, adminId, reason);
  }
}
