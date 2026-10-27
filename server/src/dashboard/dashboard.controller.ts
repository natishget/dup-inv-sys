import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { QueryDashboardDto } from './dto/query-dashboard.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /dashboard/metrics & GET /dashboard
   * Returns aggregated real-time dashboard KPIs (Total Sales, Total Purchases, COGS, Gross Profit),
   * 12-month financial trend, and top product variants.
   * Required Role: ADMIN, SALES, AUDITOR.
   */
  @Get('metrics')
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.AUDITOR)
  async getMetrics(@Query() query: QueryDashboardDto) {
    return this.dashboardService.getMetrics(query);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.AUDITOR)
  async getMetricsAlias(@Query() query: QueryDashboardDto) {
    return this.dashboardService.getMetrics(query);
  }
}
