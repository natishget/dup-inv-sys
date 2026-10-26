import { IsOptional, IsString, IsEnum, IsIn } from 'class-validator';
import { TransactionStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class QuerySaleDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
