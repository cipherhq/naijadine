import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service';
import { CacheService } from '../common/services/cache.service';
import { PlatformConfigService } from '../common/services/platform-config.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SupabaseService, CacheService, PlatformConfigService],
  exports: [SupabaseService, CacheService, PlatformConfigService],
})
export class ConfigurationModule {}
