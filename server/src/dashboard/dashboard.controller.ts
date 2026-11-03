import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { QueryDashboardDto } from './dto/query-dashboard.dto';
import { QueryFinancialsDto } from './dto/query-financials.dto';
import { QueryTopProductsDto } from './dto/query-top-products.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /dashboard/financials
   * Returns annual corporate financial totals and a 12-month calendar breakdown
   * for a specified corporate fiscal year (July 1 to June 30).
   * Cached for 5 minutes.
   * Required Role: ADMIN, SALES, AUDITOR.
   */
  @Get('financials')
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.AUDITOR)
  async getFinancials(@Query() query: QueryFinancialsDto) {
    return this.dashboardService.getFinancials(query);
  }

  /**
   * GET /dashboard/top-products
   * Returns highest-volume product variants sold during a corporate fiscal year,
   * ranked by total units dispatched (supports limit up to 15).
   * Cached for 5 minutes.
   * Required Role: ADMIN, SALES, AUDITOR.
   */
  @Get('top-products')
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.AUDITOR)
  async getTopProducts(@Query() query: QueryTopProductsDto) {
    return this.dashboardService.getTopProducts(query);
  }

  /**
   * POST /dashboard/clear-cache
   * Busts in-memory 5-minute cache for dashboard aggregations.
   * Required Role: ADMIN, SALES, AUDITOR.
   */
  @Post('clear-cache')
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.AUDITOR)
  async clearCache() {
    this.dashboardService.clearCache();
    return { success: true, message: 'Dashboard cache cleared successfully.' };
  }

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
