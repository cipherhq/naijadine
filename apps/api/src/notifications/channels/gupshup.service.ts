import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WhatsAppMessage {
  to: string;
  templateId?: string;
  templateParams?: string[];
  text?: string;
}

export interface WhatsAppListItem {
  title: string;
  description?: string;
  postbackText: string;
}

export interface WhatsAppListMessage {
  to: string;
  title: string;
  body: string;
  buttonLabel: string;
  items: WhatsAppListItem[];
}

export interface WhatsAppButtonMessage {
  to: string;
  body: string;
  buttons: Array<{ id: string; title: string }>;
}

export interface WhatsAppImageMessage {
  to: string;
  imageUrl: string;
  caption?: string;
}

export interface WhatsAppDocumentMessage {
  to: string;
  documentUrl: string;
  filename: string;
  caption?: string;
}

@Injectable()
export class GupshupService {
  private readonly logger = new Logger(GupshupService.name);
  private readonly apiKey: string;
  private readonly phoneNumber: string;
  private readonly baseUrl = 'https://api.gupshup.io/wa/api/v1';

  /**
   * Per-recipient source phone overrides.
   * When a business has a dedicated WhatsApp number, replies to their
   * customers are sent FROM that number instead of the global one.
   * Key: recipient phone (digits only), Value: source phone number.
   */
  private readonly sourceOverrides = new Map<string, string>();

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GUPSHUP_API_KEY') || '';
    this.phoneNumber = this.configService.get<string>('GUPSHUP_PHONE_NUMBER') || '';
  }

  get isConfigured(): boolean {
    return !!this.apiKey && !!this.phoneNumber;
  }

  /** Set a dedicated source phone for replies to a specific recipient. */
  setSourceForRecipient(recipient: string, sourcePhone: string): void {
    this.sourceOverrides.set(recipient.replace('+', ''), sourcePhone.replace('+', ''));
  }

  /** Clear source override for a recipient (falls back to global phone). */
  clearSourceForRecipient(recipient: string): void {
    this.sourceOverrides.delete(recipient.replace('+', ''));
  }

  /** Get the source phone number for a given recipient. */
  private getSource(recipient: string): string {
    return this.sourceOverrides.get(recipient.replace('+', '')) || this.phoneNumber;
  }

  async sendTemplate(message: WhatsAppMessage): Promise<{ success: boolean; messageId?: string }> {
    if (!this.isConfigured) {
      this.logger.warn(`[DEV] WhatsApp template to ${message.to}: ${message.templateId} params=${JSON.stringify(message.templateParams)}`);
      return { success: true, messageId: `mock_wa_${Date.now()}` };
    }

    try {
      const source = this.getSource(message.to);
      const body = new URLSearchParams({
        channel: 'whatsapp',
        source,
        destination: message.to.replace('+', ''),
        'src.name': source,
        template: JSON.stringify({
          id: message.templateId,
          params: message.templateParams || [],
        }),
      });

      const response = await fetch(`${this.baseUrl}/template/msg`, {
        method: 'POST',
        headers: {
          apikey: this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json();

      if (data.status === 'submitted') {
        return { success: true, messageId: data.messageId };
      }

      this.logger.error('Gupshup template send failed', data);
      return { success: false };
    } catch (error) {
      this.logger.error('Gupshup API error', error);
      return { success: false };
    }
  }

  async sendText(message: WhatsAppMessage): Promise<{ success: boolean; messageId?: string }> {
    if (!this.isConfigured) {
      this.logger.warn(`[DEV] WhatsApp text to ${message.to}: ${message.text}`);
      return { success: true, messageId: `mock_wa_${Date.now()}` };
    }

    try {
      const source = this.getSource(message.to);
      const body = new URLSearchParams({
        channel: 'whatsapp',
        source,
        destination: message.to.replace('+', ''),
        'src.name': source,
        message: JSON.stringify({ type: 'text', text: message.text }),
      });

      const response = await fetch(`${this.baseUrl}/msg`, {
        method: 'POST',
        headers: {
          apikey: this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json();
      this.logger.log(`Gupshup sendText response: ${JSON.stringify(data)}`);

      if (data.status === 'submitted') {
        return { success: true, messageId: data.messageId };
      }

      this.logger.error('Gupshup text send failed', data);
      return { success: false };
    } catch (error) {
      this.logger.error('Gupshup API error', error);
      return { success: false };
    }
  }

  async sendList(message: WhatsAppListMessage): Promise<{ success: boolean; messageId?: string }> {
    if (!this.isConfigured) {
      this.logger.warn(`[DEV] WhatsApp list to ${message.to}: "${message.title}" (${message.items.length} items)`);
      return { success: true, messageId: `mock_wa_${Date.now()}` };
    }

    try {
      const interactive = {
        type: 'list',
        title: message.title,
        body: message.body,
        msgid: `list_${Date.now()}`,
        globalButtons: [{ type: 'text', title: message.buttonLabel }],
        items: [
          {
            title: message.title,
            subtitle: '',
            options: message.items.map((item) => ({
              type: 'text',
              title: item.title,
              description: item.description || '',
              postbackText: item.postbackText,
            })),
          },
        ],
      };

      const source = this.getSource(message.to);
      const body = new URLSearchParams({
        channel: 'whatsapp',
        source,
        destination: message.to.replace('+', ''),
        'src.name': source,
        message: JSON.stringify(interactive),
      });

      const response = await fetch(`${this.baseUrl}/msg`, {
        method: 'POST',
        headers: {
          apikey: this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json();
      this.logger.log(`Gupshup sendList response: ${JSON.stringify(data)}`);
      if (data.status === 'submitted') {
        return { success: true, messageId: data.messageId };
      }
      this.logger.error('Gupshup list send failed', data);
      return { success: false };
    } catch (error) {
      this.logger.error('Gupshup API error', error);
      return { success: false };
    }
  }

  async sendButtons(message: WhatsAppButtonMessage): Promise<{ success: boolean; messageId?: string }> {
    if (!this.isConfigured) {
      this.logger.warn(`[DEV] WhatsApp buttons to ${message.to}: "${message.body}" (${message.buttons.map((b) => b.title).join(', ')})`);
      return { success: true, messageId: `mock_wa_${Date.now()}` };
    }

    try {
      const interactive = {
        type: 'quick_reply',
        msgid: `btn_${Date.now()}`,
        content: { type: 'text', text: message.body },
        options: message.buttons.map((btn) => ({
          type: 'text',
          title: btn.title,
          postbackText: btn.id,
        })),
      };

      const source = this.getSource(message.to);
      const body = new URLSearchParams({
        channel: 'whatsapp',
        source,
        destination: message.to.replace('+', ''),
        'src.name': source,
        message: JSON.stringify(interactive),
      });

      const response = await fetch(`${this.baseUrl}/msg`, {
        method: 'POST',
        headers: {
          apikey: this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json();
      if (data.status === 'submitted') {
        return { success: true, messageId: data.messageId };
      }
      this.logger.error('Gupshup buttons send failed', data);
      return { success: false };
    } catch (error) {
      this.logger.error('Gupshup API error', error);
      return { success: false };
    }
  }

  async sendImage(message: WhatsAppImageMessage): Promise<{ success: boolean; messageId?: string }> {
    if (!this.isConfigured) {
      this.logger.warn(`[DEV] WhatsApp image to ${message.to}: ${message.imageUrl} caption="${message.caption || ''}"`);
      return { success: true, messageId: `mock_wa_${Date.now()}` };
    }

    try {
      const source = this.getSource(message.to);
      const body = new URLSearchParams({
        channel: 'whatsapp',
        source,
        destination: message.to.replace('+', ''),
        'src.name': source,
        message: JSON.stringify({
          type: 'image',
          originalUrl: message.imageUrl,
          previewUrl: message.imageUrl,
          caption: message.caption || '',
        }),
      });

      const response = await fetch(`${this.baseUrl}/msg`, {
        method: 'POST',
        headers: {
          apikey: this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json();
      this.logger.log(`Gupshup sendImage response: ${JSON.stringify(data)}`);
      if (data.status === 'submitted') {
        return { success: true, messageId: data.messageId };
      }
      this.logger.error('Gupshup image send failed', data);
      return { success: false };
    } catch (error) {
      this.logger.error('Gupshup API error', error);
      return { success: false };
    }
  }

  async sendDocument(message: WhatsAppDocumentMessage): Promise<{ success: boolean; messageId?: string }> {
    if (!this.isConfigured) {
      this.logger.warn(`[DEV] WhatsApp document to ${message.to}: ${message.documentUrl} filename="${message.filename}"`);
      return { success: true, messageId: `mock_wa_${Date.now()}` };
    }

    try {
      const source = this.getSource(message.to);
      const body = new URLSearchParams({
        channel: 'whatsapp',
        source,
        destination: message.to.replace('+', ''),
        'src.name': source,
        message: JSON.stringify({
          type: 'file',
          url: message.documentUrl,
          filename: message.filename,
          caption: message.caption || '',
        }),
      });

      const response = await fetch(`${this.baseUrl}/msg`, {
        method: 'POST',
        headers: {
          apikey: this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json();
      this.logger.log(`Gupshup sendDocument response: ${JSON.stringify(data)}`);
      if (data.status === 'submitted') {
        return { success: true, messageId: data.messageId };
      }
      this.logger.error('Gupshup document send failed', data);
      return { success: false };
    } catch (error) {
      this.logger.error('Gupshup API error', error);
      return { success: false };
    }
  }
}
