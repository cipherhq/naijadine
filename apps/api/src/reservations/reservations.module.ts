import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { ReservationCronService } from './reservation-cron.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [NotificationsModule, LoyaltyModule],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationCronService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
