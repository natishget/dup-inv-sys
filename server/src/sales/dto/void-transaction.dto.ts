import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class VoidTransactionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsDateString()
  voidDate?: string;
}
