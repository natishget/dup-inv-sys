import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsString,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaleReturnLineItemDto {
  @IsUUID('4')
  @IsNotEmpty()
  variantId: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @Type(() => Number)
  quantity: number;
}

export class CreateSaleReturnDto {
  @IsUUID('4')
  @IsNotEmpty()
  warehouseId: string;

  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleReturnLineItemDto)
  items: SaleReturnLineItemDto[];
}
