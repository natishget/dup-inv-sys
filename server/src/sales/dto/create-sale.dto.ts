import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsNumber,
  IsPositive,
  Min,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSaleLineItemDto {
  @IsUUID('4')
  @IsNotEmpty()
  variantId: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @Type(() => Number)
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  sellingPrice: number;
}

export class CreateSaleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  customerName: string;

  @IsOptional()
  @IsDateString()
  saleDate?: string;

  @IsUUID('4')
  @IsNotEmpty()
  warehouseId: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleLineItemDto)
  items: CreateSaleLineItemDto[];
}
