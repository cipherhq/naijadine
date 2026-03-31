import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly apiKey: string;
  private readonly senderId = 'NaijaDine';

  // In-memory rate limiting (replace with Redis in production)
  private sendAttempts = new Map<string, { count: number; windowStart: number }>();
  private verifyAttempts = new Map<string, { count: number; windowStart: number }>();
  private lockouts = new Map<string, number>();

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TERMII_API_KEY') || '';
  }

  async sendOtp(phone: string): Promise<{ pin_id: string }> {
    // Check lockout
    const lockoutUntil = this.lockouts.get(phone);
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const minutesLeft = Math.ceil((lockoutUntil - Date.now()) / 60000);
      throw new HttpException(
        `Account locked. Try again in ${minutesLeft} minutes.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Rate limit: 3 OTPs per phone per 10 minutes
    this.checkRateLimit(this.sendAttempts, phone, 3, 10 * 60 * 1000);

    if (!this.apiKey) {
      // Development mode: return mock pin_id
      this.logger.warn('TERMII_API_KEY not set — using mock OTP');
      return { pin_id: `mock_${Date.now()}` };
    }

    try {
      const response = await fetch('https://v3.api.termii.com/api/sms/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          message_type: 'NUMERIC',
          to: phone,
          from: this.senderId,
          channel: 'dnd',
          pin_attempts: 5,
          pin_time_limit: 5,
          pin_length: 6,
          pin_placeholder: '< 1234 >',
          message_text:
            'Your NaijaDine verification code is < 1234 >. Expires in 5 minutes.',
          pin_type: 'NUMERIC',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        this.logger.error(`Termii send OTP failed: ${JSON.stringify(data)}`);
        throw new BadRequestException('Failed to send OTP. Please try again.');
      }

      return { pin_id: data.pinId };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Termii API error', error);
      throw new BadRequestException('Failed to send OTP. Please try again.');
    }
  }

  async verifyOtp(
    phone: string,
    otp: string,
    pinId: string,
  ): Promise<{ verified: boolean }> {
    // Rate limit: 5 verify attempts per phone per OTP session
    this.checkRateLimit(this.verifyAttempts, phone, 5, 10 * 60 * 1000);

    // Check if this was the 5th failed attempt → lockout
    const attempts = this.verifyAttempts.get(phone);
    if (attempts && attempts.count >= 5) {
      // 30-minute lockout
      this.lockouts.set(phone, Date.now() + 30 * 60 * 1000);
      throw new HttpException(
        'Too many failed attempts. Account locked for 30 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!this.apiKey) {
      // Development mode: accept any 6-digit OTP
      this.logger.warn('TERMII_API_KEY not set — accepting any OTP in dev mode');
      return { verified: true };
    }

    try {
      const response = await fetch('https://v3.api.termii.com/api/sms/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          pin_id: pinId,
          pin: otp,
        }),
      });

      const data = await response.json();

      if (data.verified === true || data.verified === 'True') {
        // Clear attempts on success
        this.verifyAttempts.delete(phone);
        return { verified: true };
      }

      return { verified: false };
    } catch (error) {
      this.logger.error('Termii verify error', error);
      throw new BadRequestException('OTP verification failed. Please try again.');
    }
  }

  private checkRateLimit(
    store: Map<string, { count: number; windowStart: number }>,
    key: string,
    maxAttempts: number,
    windowMs: number,
  ): void {
    const now = Date.now();
    const record = store.get(key);

    if (!record || now - record.windowStart > windowMs) {
      store.set(key, { count: 1, windowStart: now });
      return;
    }

    if (record.count >= maxAttempts) {
      throw new HttpException(
        'Too many attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.count++;
  }
}
