import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateSaleMetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
