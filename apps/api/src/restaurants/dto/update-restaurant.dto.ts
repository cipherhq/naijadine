import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class UpdateRestaurantDto {
  @IsString()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  cuisine_types?: string[];

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  neighborhood?: string;

  @IsEnum(['budget', 'moderate', 'upscale', 'fine_dining'])
  @IsOptional()
  price_range?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  avg_price_per_person?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  deposit_per_guest?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(72)
  cancellation_window_hours?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  walk_in_ratio?: number;

  @IsOptional()
  operating_hours?: Record<string, { open: string; close: string }>;

  @IsString()
  @IsOptional()
  instagram_handle?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;
}
