import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductOrigin } from '@prisma/client';

export class UpdateProductVariantDto {
  @IsUUID('all', { message: 'product_id must be a valid UUID' })
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  color?: string;

  @IsEnum(ProductOrigin, {
    message: 'origin must be either LOCAL or IMPORTED',
  })
  @IsOptional()
  origin?: ProductOrigin;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  sku?: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'thickness must be a valid decimal number with up to 2 decimal places' },
  )
  @Min(0, { message: 'thickness must be at least 0' })
  @Max(999.99, { message: 'thickness must not exceed 999.99' })
  @IsOptional()
  thickness?: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  size?: string;
}
