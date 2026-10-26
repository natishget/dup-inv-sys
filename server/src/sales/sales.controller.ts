import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleMetadataDto } from './dto/update-sale-metadata.dto';
import { VoidTransactionDto } from './dto/void-transaction.dto';
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import { QuerySaleDto } from './dto/query-sale.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  /**
   * GET /sales
   * List paginated sales orders with filters.
   * Required Role: ADMIN, SALES, AUDITOR (all authenticated users - read-only for AUDITOR).
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.AUDITOR)
  async findAll(@Query() query: QuerySaleDto) {
    return this.salesService.findAll(query);
  }

  /**
   * GET /sales/:id
   * Get single sale by UUID.
   * Required Role: ADMIN, SALES, AUDITOR.
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.AUDITOR)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.findOne(id);
  }

  /**
   * POST /sales
   * Atomically records a sale, validates warehouse stock, depletes FIFO cost layers,
   * freezes COGS entries, and writes outbound inventory transactions.
   * Required Role: ADMIN, SALES.
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateSaleDto, @CurrentUser('id') userId: string) {
    return this.salesService.createSale(dto, userId);
  }

  /**
   * PATCH /sales/:id
   * Safely updates non-financial metadata (customerName and notes only).
   * Enforces financial immutability.
   * Required Role: ADMIN, SALES.
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SALES)
  async updateMetadata(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSaleMetadataDto,
  ) {
    return this.salesService.updateMetadata(id, dto);
  }

  /**
   * POST /sales/:id/void
   * Fully voids a sale, restocks all inventory to the warehouse (+qty SALE_RETURN),
   * restores consumed FIFO cost layers, and marks status as VOIDED.
   * Required Role: ADMIN, SALES.
   */
  @Post(':id/void')
  @Roles(UserRole.ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.OK)
  async void(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidTransactionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.salesService.voidSale(id, dto, userId);
  }

  /**
   * POST /sales/:id/returns
   * Processes a partial or full customer return: restocks returned items (+qty SALE_RETURN),
   * restores cost layers, and reduces sales revenue.
   * Required Role: ADMIN, SALES.
   */
  @Post(':id/returns')
  @Roles(UserRole.ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.OK)
  async return(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSaleReturnDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.salesService.returnSale(id, dto, userId);
  }
}
