import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseItemDto {
  @IsUUID('4', { message: 'Each item must reference a valid product variant UUID.' })
  @IsNotEmpty()
  variantId: string;

  @IsNumber({}, { message: 'Quantity must be a number.' })
  @Min(0.0001, { message: 'Quantity must be strictly greater than zero.' })
  quantity: number;

  @IsNumber({}, { message: 'Unit cost must be a number.' })
  @Min(0, { message: 'Unit cost must be zero or positive.' })
  unitCost: number;
}

export class CreatePurchaseDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  supplierName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  invoiceNumber?: string;

  @IsDateString({}, { message: 'Purchase date must be a valid ISO date string.' })
  @IsOptional()
  purchaseDate?: string;

  @IsUUID('4', { message: 'Warehouse ID must be a valid UUID.' })
  @IsNotEmpty({ message: 'A destination warehouse is required.' })
  warehouseId: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one line item is required.' })
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];
}
