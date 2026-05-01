import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../config/supabase.service';

@Injectable()
export class BotCleanupCronService {
  private readonly logger = new Logger(BotCleanupCronService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Deactivate expired bot sessions every hour
   */
  @Cron('0 0 * * * *') // Top of every hour
  async cleanupExpiredSessions() {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('bot_sessions')
      .update({ is_active: false })
      .eq('is_active', true)
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      this.logger.error(`Session cleanup failed: ${error.message}`);
      return;
    }

    if (data?.length) {
      this.logger.log(`Deactivated ${data.length} expired bot sessions`);
    }
  }
}
