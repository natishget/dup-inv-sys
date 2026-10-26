import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { CogsService } from './cogs.service';
import { QueryCogsDto } from './dto/query-cogs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('cogs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CogsController {
  constructor(private readonly cogsService: CogsService) {}

  /**
   * GET /cogs/report & GET /cogs
   * Generates P&L valuation report with revenue, COGS, gross profit, and margins.
   * Supports active stored mode as well as dynamic simulation (FIFO, LIFO, Weighted Average).
   * Required Role: ADMIN, SALES, AUDITOR.
   */
  @Get('report')
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.AUDITOR)
  async getReport(@Query() query: QueryCogsDto) {
    return this.cogsService.generateReport(query);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.AUDITOR)
  async getReportAlias(@Query() query: QueryCogsDto) {
    return this.cogsService.generateReport(query);
  }

  /**
   * GET /cogs/export-csv
   * Streams a downloadable CSV spreadsheet matching the report filters.
   * Required Role: ADMIN, SALES, AUDITOR.
   */
  @Get('export-csv')
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.AUDITOR)
  @HttpCode(HttpStatus.OK)
  async exportCsv(@Query() query: QueryCogsDto, @Res() res: Response) {
    const { filename, csv } = await this.cogsService.exportCsv(query);

    res.setHeader('Content-Type', 'text/csv; charset=UTF-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.status(HttpStatus.OK).send(csv);
  }
}
