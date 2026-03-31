import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CancelReservationDto {
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}
