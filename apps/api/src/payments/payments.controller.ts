import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { VerifyBankDto } from './dto/verify-bank.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initialize')
  @HttpCode(HttpStatus.OK)
  async initialize(
    @Body() dto: InitializePaymentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.initialize(dto, userId);
  }

  @Public()
  @Post('webhook')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string,
  ) {
    const rawBody =
      typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);

    // Verify signature
    if (!this.paymentsService.verifyWebhookSignature(rawBody, signature || '')) {
      this.logger.error('Webhook signature verification failed');
      throw new BadRequestException('Invalid signature');
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const event = body.event as string;
    const data = body.data as Record<string, unknown>;

    await this.paymentsService.processWebhook(event, data);

    return { received: true };
  }

  @Get('verify/:reference')
  async verify(
    @Param('reference') reference: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.verifyPayment(reference, userId);
  }

  @Post('refund')
  @HttpCode(HttpStatus.OK)
  async refund(
    @Body() dto: RefundPaymentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.refund(dto, userId);
  }

  @Post('bank/verify')
  @HttpCode(HttpStatus.OK)
  async verifyBank(@Body() dto: VerifyBankDto) {
    return this.paymentsService.verifyBankAccount(dto);
  }

  @Public()
  @Get('banks')
  async listBanks() {
    return this.paymentsService.listBanks();
  }
}
