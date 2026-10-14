-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SALES', 'AUDITOR');

-- CreateEnum
CREATE TYPE "ProductOrigin" AS ENUM ('LOCAL', 'IMPORTED');

-- CreateEnum
CREATE TYPE "CostingMethodName" AS ENUM ('FIFO', 'LIFO', 'WEIGHTED_AVERAGE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'SALE_RETURN', 'PURCHASE_RETURN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "email_verified_at" TIMESTAMP(6),
    "role" "UserRole" NOT NULL DEFAULT 'SALES',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "password" VARCHAR(255) NOT NULL,
    "remember_token" VARCHAR(100),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "base_unit" VARCHAR(50),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID,
    "color" VARCHAR(50),
    "origin" "ProductOrigin",
    "sku" VARCHAR(100),
    "thickness" DECIMAL(10,2),
    "size" VARCHAR(100),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100),
    "location" TEXT,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "costing_methods" (
    "id" UUID NOT NULL,
    "name" "CostingMethodName" NOT NULL,

    CONSTRAINT "costing_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL,
    "active_costing_method" UUID,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL,
    "supplier_name" VARCHAR(255),
    "invoice_number" VARCHAR(100),
    "total_amount" DECIMAL(14,2),
    "purchase_date" DATE,
    "status" "TransactionStatus" NOT NULL DEFAULT 'POSTED',
    "reference_type" VARCHAR(20),
    "reference_id" UUID,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" UUID NOT NULL,
    "purchase_id" UUID,
    "variant_id" UUID,
    "quantity" DECIMAL(14,4),
    "unit_cost" DECIMAL(14,4),
    "total_cost" DECIMAL(14,2),

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "customer_name" VARCHAR(255),
    "total_amount" DECIMAL(14,2),
    "sale_date" DATE,
    "status" "TransactionStatus" NOT NULL DEFAULT 'POSTED',
    "reference_type" VARCHAR(20),
    "reference_id" UUID,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL,
    "sale_id" UUID,
    "variant_id" UUID,
    "quantity" DECIMAL(14,4),
    "selling_price" DECIMAL(14,4),
    "total_price" DECIMAL(14,2),

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" UUID NOT NULL,
    "variant_id" UUID,
    "warehouse_id" UUID,
    "transaction_type" "TransactionType",
    "quantity" DECIMAL(14,4),
    "unit_cost" DECIMAL(14,4),
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
    "transaction_date" DATE,
    "created_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_cost_layers" (
    "id" UUID NOT NULL,
    "variant_id" UUID,
    "warehouse_id" UUID,
    "remaining_qty" DECIMAL(14,4),
    "unit_cost" DECIMAL(14,4),
    "source_transaction_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_cost_layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_valuation" (
    "variant_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "total_quantity" DECIMAL(14,4),
    "total_cost" DECIMAL(14,4),
    "avg_unit_cost" DECIMAL(14,4),

    CONSTRAINT "inventory_valuation_pkey" PRIMARY KEY ("variant_id","warehouse_id")
);

-- CreateTable
CREATE TABLE "cogs_entries" (
    "id" UUID NOT NULL,
    "sale_item_id" UUID,
    "variant_id" UUID,
    "quantity" DECIMAL(14,4),
    "unit_cost" DECIMAL(14,4),
    "total_cost" DECIMAL(14,2),
    "costing_method" "CostingMethodName",
    "source_layer_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cogs_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "costing_methods_name_key" ON "costing_methods"("name");

-- CreateIndex
CREATE INDEX "purchases_status_idx" ON "purchases"("status");

-- CreateIndex
CREATE INDEX "purchases_reference_id_idx" ON "purchases"("reference_id");

-- CreateIndex
CREATE INDEX "purchases_created_by_idx" ON "purchases"("created_by");

-- CreateIndex
CREATE INDEX "purchases_purchase_date_idx" ON "purchases"("purchase_date");

-- CreateIndex
CREATE INDEX "purchase_items_purchase_id_idx" ON "purchase_items"("purchase_id");

-- CreateIndex
CREATE INDEX "purchase_items_variant_id_idx" ON "purchase_items"("variant_id");

-- CreateIndex
CREATE INDEX "sales_sale_date_idx" ON "sales"("sale_date");

-- CreateIndex
CREATE INDEX "sales_status_idx" ON "sales"("status");

-- CreateIndex
CREATE INDEX "sales_reference_id_idx" ON "sales"("reference_id");

-- CreateIndex
CREATE INDEX "sales_created_by_idx" ON "sales"("created_by");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "sale_items_variant_id_idx" ON "sale_items"("variant_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_variant_id_idx" ON "inventory_transactions"("variant_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_warehouse_id_idx" ON "inventory_transactions"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_transaction_date_idx" ON "inventory_transactions"("transaction_date");

-- CreateIndex
CREATE INDEX "inventory_transactions_transaction_type_idx" ON "inventory_transactions"("transaction_type");

-- CreateIndex
CREATE INDEX "inventory_transactions_reference_type_reference_id_idx" ON "inventory_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_reference_id_idx" ON "inventory_transactions"("reference_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_created_by_idx" ON "inventory_transactions"("created_by");

-- CreateIndex
CREATE INDEX "inventory_cost_layers_variant_id_warehouse_id_idx" ON "inventory_cost_layers"("variant_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_cost_layers_warehouse_id_idx" ON "inventory_cost_layers"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_cost_layers_created_at_idx" ON "inventory_cost_layers"("created_at");

-- CreateIndex
CREATE INDEX "inventory_valuation_warehouse_id_idx" ON "inventory_valuation"("warehouse_id");

-- CreateIndex
CREATE INDEX "cogs_entries_sale_item_id_idx" ON "cogs_entries"("sale_item_id");

-- CreateIndex
CREATE INDEX "cogs_entries_variant_id_idx" ON "cogs_entries"("variant_id");

-- CreateIndex
CREATE INDEX "cogs_entries_created_at_idx" ON "cogs_entries"("created_at");

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_active_costing_method_fkey" FOREIGN KEY ("active_costing_method") REFERENCES "costing_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_valuation" ADD CONSTRAINT "inventory_valuation_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_valuation" ADD CONSTRAINT "inventory_valuation_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cogs_entries" ADD CONSTRAINT "cogs_entries_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cogs_entries" ADD CONSTRAINT "cogs_entries_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
