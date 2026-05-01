import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('UPSTASH_REDIS_REST_URL') || '';
    this.token =
      this.configService.get<string>('UPSTASH_REDIS_REST_TOKEN') || '';
    this.enabled = !!(this.baseUrl && this.token);

    if (!this.enabled) {
      this.logger.warn('Cache disabled: Upstash Redis not configured');
    }
  }

  private async exec(command: string[]): Promise<unknown> {
    if (!this.enabled) return null;

    try {
      const response = await fetch(`${this.baseUrl}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });

      const data = (await response.json()) as { result: unknown };
      return data.result;
    } catch (err) {
      this.logger.error(`Cache error: ${err}`);
      return null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const result = await this.exec(['GET', key]);
    if (!result) return null;

    try {
      return JSON.parse(result as string) as T;
    } catch {
      return result as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);
    await this.exec(['SET', key, serialized, 'EX', String(ttlSeconds)]);
  }

  async del(key: string): Promise<void> {
    await this.exec(['DEL', key]);
  }

  async invalidatePattern(prefix: string): Promise<void> {
    if (!this.enabled) return;

    // Upstash SCAN-based pattern delete
    try {
      const scanResult = await this.exec([
        'SCAN',
        '0',
        'MATCH',
        `${prefix}*`,
        'COUNT',
        '100',
      ]);

      if (Array.isArray(scanResult) && Array.isArray(scanResult[1])) {
        for (const key of scanResult[1]) {
          await this.exec(['DEL', key as string]);
        }
      }
    } catch (err) {
      this.logger.error(`Cache invalidation error: ${err}`);
    }
  }
}
