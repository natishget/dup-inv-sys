import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWarehouseDto {
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Warehouse name must not exceed 100 characters.' })
  name?: string;

  @IsString()
  @IsOptional()
  location?: string;
}
