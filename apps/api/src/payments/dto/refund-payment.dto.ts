import { IsUUID, IsString, IsOptional, IsNumber, Min, IsEnum } from 'class-validator';

export class RefundPaymentDto {
  @IsUUID()
  payment_id: string;

  @IsNumber()
  @Min(100)
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsEnum(['auto_approved', 'restaurant_fault', 'system_error', 'dispute', 'policy_exception'])
  @IsOptional()
  type?: string;
}
