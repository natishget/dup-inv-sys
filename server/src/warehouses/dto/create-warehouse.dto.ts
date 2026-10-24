import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty({ message: 'Warehouse name is required.' })
  @MaxLength(100, { message: 'Warehouse name must not exceed 100 characters.' })
  name: string;

  @IsString()
  @IsOptional()
  location?: string;
}
