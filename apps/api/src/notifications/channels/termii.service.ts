import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsMessage {
  to: string;
  text: string;
}

@Injectable()
export class TermiiSmsService {
  private readonly logger = new Logger(TermiiSmsService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.ng.termii.com/api';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TERMII_API_KEY') || '';
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  async send(message: SmsMessage): Promise<{ success: boolean; messageId?: string }> {
    if (!this.isConfigured) {
      this.logger.warn(`[DEV] SMS to ${message.to}: ${message.text}`);
      return { success: true, messageId: `mock_sms_${Date.now()}` };
    }

    try {
      const response = await fetch(`${this.baseUrl}/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          to: message.to.replace('+', ''),
          from: 'DineRoot',
          sms: message.text,
          type: 'plain',
          channel: 'dnd', // DND bypass for Nigerian numbers
        }),
      });

      const data = await response.json();

      if (data.message_id) {
        return { success: true, messageId: data.message_id };
      }

      this.logger.error('Termii send failed', data);
      return { success: false };
    } catch (error) {
      this.logger.error('Termii API error', error);
      return { success: false };
    }
  }
}
