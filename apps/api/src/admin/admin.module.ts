import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AdminController, ClaimsController],
  providers: [AdminService, ClaimsService],
})
export class AdminModule {}
