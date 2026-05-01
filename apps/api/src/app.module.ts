import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigurationModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { ReservationsModule } from './reservations/reservations.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WhatsAppBotModule } from './whatsapp-bot/bot.module';
import { AdminModule } from './admin/admin.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { OrdersModule } from './orders/orders.module';
import { GuestsModule } from './guests/guests.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SearchModule } from './search/search.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { SupportModule } from './support/support.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AutomationsModule } from './automations/automations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    ConfigurationModule,
    AuthModule,
    RestaurantsModule,
    ReservationsModule,
    PaymentsModule,
    NotificationsModule,
    WhatsAppBotModule,
    AdminModule,
    WaitlistModule,
    OrdersModule,
    GuestsModule,
    ReviewsModule,
    AnalyticsModule,
    SearchModule,
    FeatureFlagsModule,
    CampaignsModule,
    SupportModule,
    SubscriptionsModule,
    AutomationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
