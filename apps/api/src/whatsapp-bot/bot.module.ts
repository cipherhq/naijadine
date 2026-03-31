import { Module } from '@nestjs/common';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { BotIntelligenceService } from './bot-intelligence.service';
import { StandaloneController } from './standalone.controller';
import { StandaloneService } from './standalone.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BotController, StandaloneController],
  providers: [BotService, BotIntelligenceService, StandaloneService],
  exports: [StandaloneService],
})
export class WhatsAppBotModule {}
