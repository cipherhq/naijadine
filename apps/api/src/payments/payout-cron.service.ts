import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../config/supabase.service';
import { PaymentsService } from './payments.service';

@Injectable()
export class PayoutCronService {
  private readonly logger = new Logger(PayoutCronService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Weekly payout calculation — runs every Monday at 2 AM
   * Creates payout records for the previous week (Mon-Sun)
   */
  @Cron('0 2 * * 1') // Monday at 02:00
  async calculateWeeklyPayouts() {
    this.logger.log('Starting weekly payout calculation...');
    const supabase = this.supabaseService.getClient();

    // Calculate period: last Monday to last Sunday
    const now = new Date();
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - now.getDay());
    lastSunday.setHours(23, 59, 59, 999);

    const lastMonday = new Date(lastSunday);
    lastMonday.setDate(lastSunday.getDate() - 6);
    lastMonday.setHours(0, 0, 0, 0);

    const periodStart = lastMonday.toISOString();
    const periodEnd = lastSunday.toISOString();

    // Get all active restaurants with verified bank accounts
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id, name, bank_accounts!inner(id)')
      .eq('status', 'active')
      .eq('bank_accounts.is_verified', true);

    if (!restaurants?.length) {
      this.logger.log('No restaurants with verified bank accounts');
      return;
    }

    let created = 0;
    for (const restaurant of restaurants) {
      try {
        const calculation = await this.paymentsService.calculatePayout(
          restaurant.id,
          periodStart,
          periodEnd,
        );

        // Skip if no revenue
        if (calculation.net_amount <= 0) continue;

        // Check if payout already exists for this period
        const { data: existing } = await supabase
          .from('payouts')
          .select('id')
          .eq('restaurant_id', restaurant.id)
          .eq('period_start', periodStart.split('T')[0])
          .single();

        if (existing) continue;

        await supabase.from('payouts').insert({
          restaurant_id: restaurant.id,
          bank_account_id: restaurant.bank_accounts[0].id,
          period_start: periodStart.split('T')[0],
          period_end: periodEnd.split('T')[0],
          gross_amount: calculation.gross_amount,
          commission_amount: calculation.commission_amount,
          net_amount: calculation.net_amount,
          status: 'pending',
        });

        created++;
      } catch (err) {
        this.logger.error(
          `Failed to calculate payout for ${restaurant.name}: ${err}`,
        );
      }
    }

    this.logger.log(`Created ${created} payout records for ${periodStart.split('T')[0]} to ${periodEnd.split('T')[0]}`);
  }
}
