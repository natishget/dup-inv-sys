import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SettingsService } from './settings.service';
import { UpdateCostingMethodDto } from './dto/update-costing-method.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('settings')
@UseGuards(RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * GET /settings/costing-method
   * Retrieves the current enterprise active costing method along with
   * explanatory details and accounting characteristics for all supported methods.
   *
   * Permission: Accessible to all authenticated users (ADMIN, SALES, AUDITOR).
   */
  @Get('costing-method')
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.AUDITOR)
  async getActiveCostingMethod() {
    return this.settingsService.getActiveCostingMethod();
  }

  /**
   * PATCH /settings/costing-method
   * Updates the global active inventory valuation and COGS realization method.
   *
   * Permission: Restricted strictly to ADMIN users.
   * Safety: Past transactions remain immutable; only future sales adopt the new method.
   */
  @Patch('costing-method')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateActiveCostingMethod(
    @Body() dto: UpdateCostingMethodDto,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.settingsService.updateActiveCostingMethod(dto, adminUserId);
  }
}

