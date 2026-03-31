import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsNumber,
  Min,
  Max,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRestaurantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  cuisine_types: string[];

  @IsString()
  address: string;

  @IsString()
  @IsEnum(['lagos', 'abuja', 'port_harcourt'])
  city: string;

  @IsString()
  neighborhood: string;

  @IsString()
  @Matches(/^\+234[0-9]{10}$/, {
    message: 'Phone must be a valid Nigerian number: +234XXXXXXXXXX',
  })
  phone: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsEnum(['marketplace', 'whatsapp_standalone'])
  product_type: string;

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
