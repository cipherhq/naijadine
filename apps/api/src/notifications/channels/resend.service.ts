import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

@Injectable()
export class ResendEmailService {
  private readonly logger = new Logger(ResendEmailService.name);
  private readonly apiKey: string;
  private readonly defaultFrom = 'DineRoot <hello@dineroot.com>';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RESEND_API_KEY') || '';
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  async send(message: EmailMessage): Promise<{ success: boolean; messageId?: string }> {
    if (!this.isConfigured) {
      this.logger.warn(`[DEV] Email to ${message.to}: "${message.subject}"`);
      return { success: true, messageId: `mock_email_${Date.now()}` };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from || this.defaultFrom,
          to: [message.to],
          subject: message.subject,
          html: message.html,
        }),
      });

      const data = await response.json();

      if (data.id) {
        return { success: true, messageId: data.id };
      }

      this.logger.error('Resend send failed', data);
      return { success: false };
    } catch (error) {
      this.logger.error('Resend API error', error);
      return { success: false };
    }
  }
}
