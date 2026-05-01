import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { CacheService } from '../common/services/cache.service';
import { createHash } from 'crypto';

interface FeatureFlag {
  key: string;
  is_enabled: boolean;
  rollout_percentage: number | null;
  conditions: Record<string, unknown> | null;
  description: string | null;
}

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private static readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly cacheService: CacheService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Check if a feature flag is enabled for a given user
   */
  async isEnabled(
    flagKey: string,
    userId?: string,
    context?: Record<string, unknown>,
  ): Promise<boolean> {
    const flag = await this.getFlag(flagKey);
    if (!flag) return false;
    if (!flag.is_enabled) return false;

    // Check rollout percentage (deterministic per user)
    if (flag.rollout_percentage !== null && flag.rollout_percentage < 100) {
      if (!userId) return false;

      const hash = createHash('md5')
        .update(`${flagKey}:${userId}`)
        .digest('hex');
      const bucket = parseInt(hash.substring(0, 8), 16) % 100;

      if (bucket >= flag.rollout_percentage) return false;
    }

    // Evaluate conditions
    if (flag.conditions && context) {
      for (const [key, value] of Object.entries(flag.conditions)) {
        if (context[key] !== value) return false;
      }
    }

    return true;
  }

  /**
   * Get a single flag (cached)
   */
  private async getFlag(key: string): Promise<FeatureFlag | null> {
    const cacheKey = `flag:${key}`;
    const cached = await this.cacheService.get<FeatureFlag>(cacheKey);
    if (cached) return cached;

    const { data } = await this.supabase
      .from('feature_flags')
      .select('key, is_enabled, rollout_percentage, conditions, description')
      .eq('key', key)
      .single();

    if (data) {
      await this.cacheService.set(
        cacheKey,
        data,
        FeatureFlagsService.CACHE_TTL,
      );
    }

    return data as FeatureFlag | null;
  }

  /**
   * Get all flags for a user (used by frontend SDK)
   */
  async getAllFlags(
    userId?: string,
    context?: Record<string, unknown>,
  ): Promise<Record<string, boolean>> {
    const { data: flags } = await this.supabase
      .from('feature_flags')
      .select('key, is_enabled, rollout_percentage, conditions');

    const result: Record<string, boolean> = {};

    for (const flag of flags || []) {
      result[flag.key] = await this.isEnabled(
        flag.key,
        userId,
        context,
      );
    }

    return result;
  }

  /**
   * Admin: update a flag
   */
  async updateFlag(
    key: string,
    updates: Partial<{
      is_enabled: boolean;
      rollout_percentage: number;
      conditions: Record<string, unknown>;
      description: string;
    }>,
  ) {
    const { data, error } = await this.supabase
      .from('feature_flags')
      .update(updates)
      .eq('key', key)
      .select()
      .single();

    if (error) {
      // Try insert if doesn't exist
      const { data: created } = await this.supabase
        .from('feature_flags')
        .insert({ key, ...updates })
        .select()
        .single();

      // Invalidate cache
      await this.cacheService.del(`flag:${key}`);
      return created;
    }

    await this.cacheService.del(`flag:${key}`);
    return data;
  }

  /**
   * Admin: list all flags
   */
  async listFlags() {
    const { data } = await this.supabase
      .from('feature_flags')
      .select('*')
      .order('key');

    return data || [];
  }
}
