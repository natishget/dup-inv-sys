import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export interface NestedVariantImportItem {
  sku?: string;
  color?: string;
  origin?: 'LOCAL' | 'IMPORTED';
  thickness?: number;
  size?: string;
}

export interface ProductImportItem {
  name: string;
  unit?: string;
  base_unit?: string;
  baseUnit?: string;
  variants?: NestedVariantImportItem[];
}

export class ImportProductsDto {
  /**
   * JSON string representation of products array:
   * e.g. '[{"name":"Curtain Wall 50","unit":"METER"}]'
   */
  @IsString()
  @IsOptional()
  products_json?: string;

  /**
   * Direct JSON array payload
   */
  @IsArray()
  @IsOptional()
  products?: ProductImportItem[];
}
