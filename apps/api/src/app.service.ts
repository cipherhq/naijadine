import { Injectable } from '@nestjs/common';
import { SupabaseService } from './config/supabase.service';

@Injectable()
export class AppService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getHealth() {
    let dbStatus = 'unknown';
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('bot_sessions')
        .select('id')
        .limit(1);
      dbStatus = error ? `error: ${error.message}` : 'connected';
    } catch (e) {
      dbStatus = `exception: ${e.message}`;
    }

    return {
      status: 'ok',
      service: 'naijadine-api',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    };
  }
}
