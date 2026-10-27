import { IsOptional, IsString } from 'class-validator';

export class QueryDashboardDto {
  @IsOptional()
  @IsString()
  fiscalYear?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
