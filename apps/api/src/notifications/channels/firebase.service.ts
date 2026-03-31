import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FirebasePushService implements OnModuleInit {
  private readonly logger = new Logger(FirebasePushService.name);
  private readonly projectId: string;
  private readonly clientEmail: string;
  private readonly privateKey: string;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(private readonly configService: ConfigService) {
    this.projectId = this.configService.get<string>('FIREBASE_PROJECT_ID') || '';
    this.clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL') || '';
    this.privateKey = (this.configService.get<string>('FIREBASE_PRIVATE_KEY') || '').replace(/\\n/g, '\n');
  }

  get isConfigured(): boolean {
    return !!this.projectId && !!this.clientEmail && !!this.privateKey;
  }

  async onModuleInit() {
    if (this.isConfigured) {
      this.logger.log('Firebase Push configured');
    } else {
      this.logger.warn('Firebase Push not configured — push notifications will be mocked');
    }
  }

  async send(message: PushMessage): Promise<{ success: boolean; messageId?: string }> {
    if (!this.isConfigured) {
      this.logger.warn(`[DEV] Push to token ${message.token.substring(0, 20)}...: "${message.title}"`);
      return { success: true, messageId: `mock_push_${Date.now()}` };
    }

    try {
      const token = await this.getAccessToken();

      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: message.token,
              notification: {
                title: message.title,
                body: message.body,
              },
              data: message.data || {},
            },
          }),
        },
      );

      const data = await response.json();

      if (data.name) {
        return { success: true, messageId: data.name };
      }

      this.logger.error('FCM send failed', data);
      return { success: false };
    } catch (error) {
      this.logger.error('FCM API error', error);
      return { success: false };
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Create JWT for service account auth
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: this.clientEmail,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ).toString('base64url');

    const { createSign } = await import('crypto');
    const sign = createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(this.privateKey, 'base64url');

    const jwt = `${header}.${payload}.${signature}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    });

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken!;
  }
}
