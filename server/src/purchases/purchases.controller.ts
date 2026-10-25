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
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseMetadataDto } from './dto/update-purchase-metadata.dto';
import { VoidTransactionDto } from './dto/void-transaction.dto';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { QueryPurchaseDto } from './dto/query-purchase.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  /**
   * GET /purchases
   * Required Role: ADMIN, SALES, AUDITOR (all authenticated — read-only for AUDITOR)
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.AUDITOR)
  async findAll(@Query() query: QueryPurchaseDto) {
    return this.purchasesService.findAll(query);
  }

  /**
   * POST /purchases
   * Creates a new purchase order atomically.
   * Required Role: ADMIN, SALES
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePurchaseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.purchasesService.createPurchase(dto, userId);
  }

  /**
   * PATCH /purchases/:id
   * Safely updates non-financial metadata (supplier_name, notes only).
   * Required Role: ADMIN, SALES
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SALES)
  async updateMetadata(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseMetadataDto,
  ) {
    return this.purchasesService.updateMetadata(id, dto);
  }

  /**
   * POST /purchases/:id/void
   * Voids a posted purchase, writes compensating PURCHASE_RETURN ledger entries.
   * Required Role: ADMIN, SALES
   */
  @Post(':id/void')
  @Roles(UserRole.ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.OK)
  async void(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidTransactionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.purchasesService.voidPurchase(id, dto, userId);
  }

  /**
   * POST /purchases/:id/returns
   * Processes a partial physical return of defective items back to the vendor.
   * Required Role: ADMIN, SALES
   */
  @Post(':id/returns')
  @Roles(UserRole.ADMIN, UserRole.SALES)
  @HttpCode(HttpStatus.OK)
  async return(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePurchaseReturnDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.purchasesService.returnPurchase(id, dto, userId);
  }
}
