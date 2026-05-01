import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';
import { CacheService } from './cache.service';

/**
 * Central platform config — all values admin-editable via system_configs table.
 * Cached for 5 minutes, falls back to sensible defaults.
 */
@Injectable()
export class PlatformConfigService implements OnModuleInit {
  private readonly logger = new Logger(PlatformConfigService.name);
  private config: Record<string, string> = {};
  private static readonly CACHE_KEY = 'platform_config';
  private static readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly cacheService: CacheService,
  ) {}

  async onModuleInit() {
    await this.reload();
  }

  async reload(): Promise<void> {
    // Try cache first
    const cached = await this.cacheService.get<Record<string, string>>(
      PlatformConfigService.CACHE_KEY,
    );
    if (cached) {
      this.config = cached;
      return;
    }

    // Load from DB
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase.from('system_configs').select('key, value');

    this.config = {};
    for (const row of data || []) {
      this.config[row.key] = String(row.value).replace(/^"|"$/g, '');
    }

    // Cache
    await this.cacheService.set(
      PlatformConfigService.CACHE_KEY,
      this.config,
      PlatformConfigService.CACHE_TTL,
    );

    this.logger.log(`Loaded ${Object.keys(this.config).length} config values`);
  }

  // ── Typed getters with defaults ──

  get commissionRate(): number {
    return parseFloat(this.config.commission_rate || '10') / 100;
  }

  get commissionPercent(): number {
    return parseFloat(this.config.commission_rate || '10');
  }

  get vatRate(): number {
    return parseFloat(this.config.vat_rate || '7.5') / 100;
  }

  get noShowStrikeLimit(): number {
    return parseInt(this.config.no_show_strike_limit || '4', 10);
  }

  get noShowRollingMonths(): number {
    return parseInt(this.config.no_show_rolling_months || '12', 10);
  }

  get maxPartySize(): number {
    return parseInt(this.config.max_party_size || '20', 10);
  }

  get freeBookingLimit(): number {
    return parseInt(this.config.free_tier_booking_limit || '50', 10);
  }

  get starterBookingLimit(): number {
    return parseInt(this.config.starter_tier_booking_limit || '100', 10);
  }

  get referralCreditAmount(): number {
    return parseInt(this.config.referral_credit_amount || '500', 10);
  }

  get welcomeCreditAmount(): number {
    return parseInt(this.config.welcome_credit_amount || '1000', 10);
  }

  get payoutCycleDays(): number {
    return parseInt(this.config.payout_cycle_days || '15', 10);
  }

  get bookingRefPrefix(): string {
    return this.config.booking_reference_prefix || 'DR';
  }

  /** Get any config value by key */
  get(key: string, defaultValue = ''): string {
    return this.config[key] || defaultValue;
  }
}
