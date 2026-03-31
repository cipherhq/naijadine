import { IsUUID, IsString, IsOptional } from 'class-validator';

export class InitializePaymentDto {
  @IsUUID()
  reservation_id: string;

  @IsString()
  callback_url: string;

  @IsString()
  @IsOptional()
  email?: string;
}
