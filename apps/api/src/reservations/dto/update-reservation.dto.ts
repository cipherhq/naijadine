import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateReservationDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD format' })
  @IsOptional()
  date?: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Time must be HH:MM format' })
  @IsOptional()
  time?: string;

  @IsNumber()
  @Min(1)
  @Max(20)
  @IsOptional()
  party_size?: number;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  special_requests?: string;
}
