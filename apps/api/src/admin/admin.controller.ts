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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Platform Stats ──

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  // ── Restaurant Management ──

  @Get('restaurants/pending')
  async getPendingRestaurants(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getPendingRestaurants(page, limit);
  }

  @Post('restaurants/:id/approve')
  async approveRestaurant(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.adminService.approveRestaurant(id, userId);
  }

  @Post('restaurants/:id/suspend')
  async suspendRestaurant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.adminService.suspendRestaurant(id, reason, userId);
  }

  // ── User Management ──

  @Get('users')
  async getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('role') role?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers(page, limit, role, search);
  }

  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('role') role: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.adminService.updateUserRole(id, role, userId);
  }

  @Patch('users/:id/suspend')
  async suspendUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('suspend') suspend: boolean,
    @Body('reason') reason: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.adminService.suspendUser(id, suspend, reason, userId);
  }

  // ── Refund Management ──

  @Get('refunds/pending')
  async getPendingRefunds(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getPendingRefunds(page, limit);
  }

  @Post('refunds/:id/approve')
  async approveRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.adminService.approveRefund(id, userId);
  }

  @Post('refunds/:id/reject')
  async rejectRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.adminService.rejectRefund(id, reason, userId);
  }

  // ── System Config ──

  @Get('config')
  async getAllConfig() {
    return this.adminService.getAllConfig();
  }

  @Post('config/:key')
  async updateConfig(
    @Param('key') key: string,
    @Body('value') value: unknown,
    @CurrentUser('id') userId: string,
  ) {
    return this.adminService.updateConfig(key, value, userId);
  }
}
