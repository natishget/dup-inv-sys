import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { TransactionStatus } from '@prisma/client';

export class QueryPurchaseDto {
  @IsOptional()
  @IsString()
  q?: string; // supplier name search

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
