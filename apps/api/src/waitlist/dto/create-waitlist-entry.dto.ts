import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class CreateWaitlistEntryDto {
  @IsUUID()
  restaurant_id: string;

  @IsNumber()
  @Min(1)
  @Max(20)
  party_size: number;

  @IsString()
  guest_name: string;

  @IsString()
  @Matches(/^\+234[0-9]{10}$/, {
    message: 'Phone must be a valid Nigerian number: +234XXXXXXXXXX',
  })
  guest_phone: string;

  @IsString()
  @IsOptional()
  guest_email?: string;

  @IsString()
  @IsOptional()
  special_requests?: string;
}
