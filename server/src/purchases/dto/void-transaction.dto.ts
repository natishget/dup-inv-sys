import { IsString, IsOptional, MaxLength, IsDateString } from 'class-validator';

/**
 * Captures audit justification when voiding a purchase or sale.
 * Both fields are optional per the documentation spec.
 */
export class VoidTransactionDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;

  @IsDateString({}, { message: 'Void date must be a valid ISO date string.' })
  @IsOptional()
  voidDate?: string;
}
