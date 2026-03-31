import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchRestaurantsDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  neighborhood?: string;

  @IsString()
  @IsOptional()
  cuisine?: string;

  @IsEnum(['budget', 'moderate', 'upscale', 'fine_dining'])
  @IsOptional()
  price_range?: string;

  @IsEnum(['rating_avg', 'total_bookings', 'created_at', 'name'])
  @IsOptional()
  sort_by?: string;

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sort_order?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 20;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}
