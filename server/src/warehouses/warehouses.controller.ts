import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  /**
   * Lists all warehouses.
   * Required Role: ADMIN, SALES, AUDITOR (all authenticated users).
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.AUDITOR)
  async findAll() {
    const warehouses = await this.warehousesService.findAll();
    return { data: warehouses };
  }

  /**
   * Creates a new warehouse facility.
   * Required Role: ADMIN only.
   */
  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(dto);
  }

  /**
   * Updates an existing warehouse.
   * Required Role: ADMIN only.
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehousesService.update(id, dto);
  }

  /**
   * Deletes a warehouse.
   * Required Role: ADMIN only.
   * Data Protection Barrier: Blocks deletion if inventory_transactions records exist.
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.warehousesService.delete(id);
  }

  /**
   * Retrieves live warehouse stock aggregated from the inventory_transactions ledger.
   * Required Role: ADMIN, SALES, AUDITOR (all authenticated users).
   */
  @Get(':id/stock')
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.AUDITOR)
  async getStock(@Param('id', ParseUUIDPipe) id: string) {
    return this.warehousesService.getWarehouseStock(id);
  }
}
