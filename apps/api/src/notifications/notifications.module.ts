import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { GupshupService } from './channels/gupshup.service';
import { ResendEmailService } from './channels/resend.service';
import { TermiiSmsService } from './channels/termii.service';
import { FirebasePushService } from './channels/firebase.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    GupshupService,
    ResendEmailService,
    TermiiSmsService,
    FirebasePushService,
  ],
  exports: [NotificationsService, GupshupService, ResendEmailService],
})
export class NotificationsModule {}
