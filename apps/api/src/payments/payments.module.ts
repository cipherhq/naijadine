import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PayoutCronService } from './payout-cron.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PayoutCronService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
