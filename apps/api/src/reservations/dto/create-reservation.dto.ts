import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsUUID,
  Min,
  Max,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateReservationDto {
  @IsUUID()
  restaurant_id: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD format' })
  date: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Time must be HH:MM format' })
  time: string;

  @IsNumber()
  @Min(1)
  @Max(20)
  party_size: number;

  @IsEnum(['app', 'web', 'whatsapp', 'phone', 'walk_in'])
  channel: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  special_requests?: string;

  @IsUUID()
  @IsOptional()
  deal_id?: string;
}
