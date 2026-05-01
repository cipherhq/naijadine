import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AutomationsService } from './automations.service';

@Injectable()
export class AutomationsCronService {
  private readonly logger = new Logger(AutomationsCronService.name);

  constructor(private readonly automationsService: AutomationsService) {}

  /**
   * Execute automations every 30 minutes
   */
  @Cron('0 */30 * * * *')
  async run() {
    this.logger.log('Running automation sweep...');
    await this.automationsService.executePending();
  }
}
