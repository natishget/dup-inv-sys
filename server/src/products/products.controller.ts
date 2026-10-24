import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ProductsService, PaginatedVariantsResponse } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { QueryProductVariantDto } from './dto/query-product-variant.dto';
import { ImportProductsDto } from './dto/import-products.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Retrieves all master products for dropdown selection and management.
   */
  @Get()
  async findAllProducts() {
    return this.productsService.findAllProducts();
  }

  /**
   * Creates a master product. ADMIN only.
   */
  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createProduct(@Body() dto: CreateProductDto) {
    return this.productsService.createProduct(dto);
  }

  /**
   * Bulk imports products and nested variants from JSON. ADMIN only.
   */
  @Post('import')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async importProducts(@Body() dto: ImportProductsDto) {
    return this.productsService.importProducts(dto);
  }

  /**
   * Retrieves paginated variants with filter criteria (search, origin, color).
   */
  @Get('variants')
  async findAllVariants(
    @Query() query: QueryProductVariantDto,
  ): Promise<PaginatedVariantsResponse> {
    return this.productsService.findAllVariants(query);
  }

  /**
   * Retrieves list of distinct colors across all variants for filter dropdown.
   */
  @Get('variants/colors')
  async getDistinctColors(): Promise<string[]> {
    return this.productsService.getDistinctColors();
  }

  /**
   * Creates a product variant under a parent product. ADMIN only.
   */
  @Post('variants')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createVariant(@Body() dto: CreateProductVariantDto) {
    return this.productsService.createVariant(dto);
  }

  /**
   * Updates an existing product variant. ADMIN only.
   */
  @Patch('variants/:id')
  @Roles(UserRole.ADMIN)
  async updateVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.productsService.updateVariant(id, dto);
  }

  /**
   * Deletes a product variant. ADMIN only.
   */
  @Delete('variants/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteVariant(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.deleteVariant(id);
  }

  /**
   * Deletes a master product. ADMIN only.
   * Blocked if related child variants exist.
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.deleteProduct(id);
  }
}
