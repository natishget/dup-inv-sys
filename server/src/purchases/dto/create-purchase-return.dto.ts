import {
  IsUUID,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsNumber,
  Min,
  IsString,
  IsOptional,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReturnItemDto {
  @IsUUID('4', { message: 'Each return item must reference a valid product variant UUID.' })
  @IsNotEmpty()
  variantId: string;

  @IsNumber({}, { message: 'Return quantity must be a number.' })
  @Min(0.0001, { message: 'Return quantity must be strictly greater than zero.' })
  quantity: number;
}

export class CreatePurchaseReturnDto {
  @IsUUID('4', { message: 'Warehouse ID must be a valid UUID.' })
  @IsNotEmpty({ message: 'A warehouse is required for the return.' })
  warehouseId: string;

  @IsDateString({}, { message: 'Return date must be a valid ISO date string.' })
  @IsOptional()
  returnDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one item must be specified for return.' })
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];
}
