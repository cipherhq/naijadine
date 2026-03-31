import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateNotificationPreferencesDto } from './dto/update-preferences.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationsService.getUserNotifications(
      userId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser('id') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Get('preferences')
  async getPreferences(@CurrentUser('id') userId: string) {
    const supabase = this.notificationsService['supabaseService'].getClient();
    const { data } = await supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', userId)
      .single();
    return data?.notification_prefs || { whatsapp: true, sms: true, email: true, push: true };
  }

  @Patch('preferences')
  @HttpCode(HttpStatus.OK)
  async updatePreferences(
    @Body() dto: UpdateNotificationPreferencesDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.updatePreferences(userId, dto);
  }
}
