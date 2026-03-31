import {
  Controller,
  Post,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { BotService } from './bot.service';

@Controller('webhook/whatsapp')
export class BotController {
  private readonly logger = new Logger(BotController.name);

  constructor(private readonly botService: BotService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: Request) {
    try {
      const body = req.body as Record<string, unknown>;

      // Log raw payload for debugging
      this.logger.log(`RAW WEBHOOK: ${JSON.stringify(body).slice(0, 1000)}`);

      // Gupshup webhook payload structure
      const type = body.type as string;
      const payload = body.payload as Record<string, unknown> | undefined;

      if (!payload) {
        this.logger.warn('No payload in webhook body');
        return { status: 'ok' };
      }

      // Only handle incoming messages
      if (type !== 'message' && type !== 'message-event') {
        this.logger.log(`Ignoring webhook type: ${type}`);
        return { status: 'ok' };
      }

      // For message-events (delivery/read receipts), just acknowledge
      if (type === 'message-event') {
        return { status: 'ok' };
      }

      const msgPayload = payload.payload as Record<string, unknown> | undefined;
      const source = payload.source as string; // sender's phone number
      const destination = payload.destination as string | undefined; // our phone number
      // In Gupshup v2, message type is at payload.type, not payload.payload.type
      const msgType = (payload.type as string) || '';

      if (!source || !msgPayload) {
        this.logger.warn(`Missing source (${source}) or msgPayload in webhook`);
        return { status: 'ok' };
      }

      // Extract message text based on message type
      let messageText = '';

      switch (msgType) {
        case 'text':
          messageText = (msgPayload.text as string) || '';
          break;
        case 'button_reply':
          messageText = (msgPayload.postbackText as string) || (msgPayload.title as string) || '';
          break;
        case 'list_reply':
          messageText = (msgPayload.postbackText as string) || (msgPayload.title as string) || '';
          break;
        case 'interactive':
          messageText = (msgPayload.postbackText as string) || (msgPayload.title as string) || '';
          break;
        default:
          messageText = (msgPayload.text as string) || (msgPayload.postbackText as string) || '';
      }

      if (!messageText) {
        return { status: 'ok' };
      }

      this.logger.log(`WhatsApp from ${source}: "${messageText}" (type: ${msgType})`);

      try {
        await this.botService.handleMessage(source, messageText, msgType, destination);
        this.logger.log(`Bot handled message from ${source} successfully`);
      } catch (botError) {
        this.logger.error(`Bot handleMessage error for ${source}:`, (botError as Error)?.message || botError);
        this.logger.error('Stack:', (botError as Error)?.stack);
      }

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Webhook processing error', (error as Error)?.message || error);
      return { status: 'ok' };
    }
  }
}
