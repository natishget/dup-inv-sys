import { IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * Financial Immutability Rule:
 * Only supplier_name and notes can be updated after posting.
 * Quantities, costs, warehouse, and items are permanently immutable.
 */
export class UpdatePurchaseMetadataDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  supplierName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
