# 🗄️ Stock Management System — Database Architecture & Implementation Guide

## 1. Architecture Overview & Core Principles

This database layer powers a **financially auditable stock, inventory, and cost-of-goods-sold (COGS) tracking platform** implemented in **PostgreSQL** using **Prisma ORM** within a **NestJS** backend framework.

The schema implements the five core domain pillars defined in the system documentation:

1. **Ledger-Based Inventory (Zero-Stock Column Rule):** No mutable `stock` or `quantity_on_hand` column exists in `products` or `product_variants`. Current stock is computed dynamically from signed rows in `inventory_transactions` (`+qty` for inbound purchases/returns, `-qty` for outbound sales/deliveries).
2. **Multi-Valuation Costing Engines:** Dedicated schema support for three distinct inventory valuation methodologies:
   - **FIFO (First-In, First-Out):** Managed via `inventory_cost_layers`, depleting batches in ascending `created_at` order.
   - **LIFO (Last-In, First-Out):** Managed via `inventory_cost_layers`, depleting batches in descending `created_at` order.
   - **Weighted Average (AVCO):** Maintained perpetually via `inventory_valuation` tracking `(total_cost / total_quantity)` per variant and warehouse.
3. **Immutable COGS Snapshots:** Cost of goods sold is captured at the exact moment of sale fulfillment and stored permanently in `cogs_entries`. Historical COGS entries are never mutated.
4. **Non-Destructive Safe Corrections (Append-Only):** Business records are protected from destructive `DELETE` operations. Corrections use `status = 'VOIDED'` and compensatory ledger transactions (`SALE_RETURN`, `PURCHASE_RETURN`).
5. **Native UUID & High-Precision Standard:** Primary keys and foreign keys use PostgreSQL native `UUID` (`@db.Uuid`). Fractional quantities, unit costs, and sales prices use `DECIMAL(14, 4)`, while monetary totals use `DECIMAL(14, 2)`.

---

## 2. Database Technology Choices

| Component | Selection | Rationale |
| :--- | :--- | :--- |
| **RDBMS** | PostgreSQL 16+ | Native UUID support, strict ACID transactions, row-level concurrency locks (`FOR UPDATE`), and robust decimal arithmetic. |
| **ORM** | Prisma 6.4.1 | Type-safe schema definition, declarative migrations, connection lifecycle management, and seamless NestJS integration. |
| **Backend Framework** | NestJS 11.x | Modular architecture, dependency injection, and centralized `@Global()` Prisma database service. |
| **Package Manager** | pnpm 10.x | Fast, deterministic dependency resolution. |

---

## 3. Implemented Models & Tables

The database implements the 14 core business domain models:

### 3.1 Authentication & System Administration
- **`users` (`User`)**: System operators with role-based access control (`ADMIN`, `SALES`, `AUDITOR`), hashed passwords, phone/email uniqueness constraints, and account status flags.
- **`costing_methods` (`CostingMethod`)**: Lookup table storing the three supported accounting algorithms: `FIFO`, `LIFO`, `WEIGHTED_AVERAGE`.
- **`system_settings` (`SystemSetting`)**: Singleton configuration table referencing the currently active costing method.

### 3.2 Catalog & Multi-Warehouse Subsystem
- **`products` (`Product`)**: Master product definitions (e.g. Aluminum Profile Series).
- **`product_variants` (`ProductVariant`)**: Sellable SKUs with finish color, origin (`LOCAL`, `IMPORTED`), unique SKU, wall thickness (`DECIMAL(10,2)`), and profile dimensions.
- **`warehouses` (`Warehouse`)**: Physical depots and facilities segregating inventory and cost pools.

### 3.3 Trading Subsystems (Purchases & Sales)
- **`purchases` (`Purchase`)**: Inbound supplier order headers with supplier name, external invoice number, date, total amount, status (`POSTED`, `VOIDED`), reference tracking, and operator audit fields.
- **`purchase_items` (`PurchaseItem`)**: Purchase line items specifying variant, quantity received (`DECIMAL(14,4)`), unit acquisition cost (`DECIMAL(14,4)`), and subtotal (`DECIMAL(14,2)`).
- **`sales` (`Sale`)**: Outbound customer invoice headers recording customer name, invoice date, total revenue, status (`POSTED`, `VOIDED`), reference tracking, and salesperson audit attribution.
- **`sale_items` (`SaleItem`)**: Outbound line items with variant sold, quantity (`DECIMAL(14,4)`), selling price per unit (`DECIMAL(14,4)`), and line revenue (`DECIMAL(14,2)`).

### 3.4 Inventory Ledger & Costing Engines
- **`inventory_transactions` (`InventoryTransaction`)**: The central audit ledger. Every stock receipt, shipment, return, transfer, or adjustment inserts a signed row here.
- **`inventory_cost_layers` (`InventoryCostLayer`)**: Unconsumed cost batches segregated by variant and warehouse for FIFO/LIFO depletion.
- **`inventory_valuation` (`InventoryValuation`)**: Perpetual moving average cost state per `(variant_id, warehouse_id)` with composite primary key.
- **`cogs_entries` (`CogsEntry`)**: Permanent, auditable financial snapshots recording realized cost of goods sold per sale line item.

---

## 4. Key Relationships & Referential Integrity (`onDelete`)

To protect financial truth and audit integrity, referential actions are strictly configured:

- **Parent-to-Child Ownership (Cascade):**
  - `Product` $\to$ `ProductVariant` (`ON DELETE CASCADE`)
  - `Purchase` $\to$ `PurchaseItem` (`ON DELETE CASCADE`)
  - `Sale` $\to$ `SaleItem` (`ON DELETE CASCADE`)
  - `SaleItem` $\to$ `CogsEntry` (`ON DELETE CASCADE`)
- **Historical Ledger Protection (Restrict):**
  - `ProductVariant` $\to$ `PurchaseItem`, `SaleItem`, `InventoryTransaction`, `InventoryCostLayer`, `InventoryValuation`, `CogsEntry` (`ON DELETE RESTRICT`)
  - `Warehouse` $\to$ `InventoryTransaction`, `InventoryCostLayer`, `InventoryValuation` (`ON DELETE RESTRICT`)
  - Prevents accidental deletion of catalog items or warehouses that possess existing historical stock movements.
- **Audit Attributions (SetNull):**
  - `User` $\to$ `Purchase.created_by`, `Sale.created_by`, `InventoryTransaction.created_by` (`ON DELETE SET NULL`)
  - `CostingMethod` $\to$ `SystemSetting.active_costing_method` (`ON DELETE SET NULL`)

---

## 5. Performance Indexes

Targeted B-tree indexes are implemented across query-heavy lookup and filter paths:

| Table | Index Columns | Purpose |
| :--- | :--- | :--- |
| `sales` | `sale_date` | Dashboard monthly/annual date filtering |
| `sales` | `status` | Rapid exclusion of `VOIDED` invoices |
| `sales` | `reference_id` | Quick lookup of linked returns / reversals |
| `sales` | `created_by` | User sales performance attribution |
| `purchases` | `status`, `reference_id`, `purchase_date`, `created_by` | Inbound filtering and auditing |
| `sale_items` | `sale_id`, `variant_id` | Invoice joins and per-SKU sales analytics |
| `purchase_items` | `purchase_id`, `variant_id` | Purchase detail joins and vendor history |
| `inventory_transactions` | `variant_id`, `warehouse_id` | Dynamic live stock calculations (`SUM(quantity)`) |
| `inventory_transactions` | `transaction_date`, `transaction_type` | Ledger timeline filtering |
| `inventory_transactions` | `[reference_type, reference_id]` | Composite lookup of movements for any invoice |
| `inventory_cost_layers` | `[variant_id, warehouse_id]`, `created_at` | Rapid FIFO (`ASC`) / LIFO (`DESC`) layer selection |
| `cogs_entries` | `sale_item_id`, `variant_id`, `created_at` | COGS reporting and margin calculations |

---

## 6. Prisma & NestJS Architecture

The database integration follows NestJS and Prisma best practices:

- **`PrismaService` (`src/prisma/prisma.service.ts`):** Extends `PrismaClient` and hooks into NestJS's lifecycle (`OnModuleInit` with `$connect()`, `OnModuleDestroy` with `$disconnect()`).
- **`PrismaModule` (`src/prisma/prisma.module.ts`):** Decorated with `@Global()` and exports `PrismaService`, enabling dependency injection across all future domain modules without redundant imports.
- **Initial Seed (`prisma/seed.ts`):** Automatically initializes the 3 costing methods (`FIFO`, `LIFO`, `WEIGHTED_AVERAGE`) and links the initial default `system_settings` record.

---

## 7. Migration & Verification Commands

### Apply Migrations
```bash
pnpm exec prisma migrate dev
```

### Run Seeder
```bash
pnpm exec prisma db seed
```

### Validate Schema
```bash
pnpm exec prisma validate
```

### Generate Prisma Client
```bash
pnpm exec prisma generate
```

### Build NestJS Application
```bash
pnpm run build
```

---

## 8. Differences from Documented Legacy Laravel Schema

1. **Database Engine:** Migrated from MySQL 8.0/InnoDB (`CHAR(36)` strings) to native PostgreSQL `UUID` (`@db.Uuid`), reducing key storage size by 55% and improving B-tree index performance.
2. **Framework Tables Omitted:** Laravel-specific internal infrastructure tables (`cache`, `cache_locks`, `sessions`, `jobs`, `job_batches`, `failed_jobs`, `password_reset_tokens`) were omitted in favor of modern NestJS conventions (Redis/BullMQ/JWT).
3. **Strict Precision Types:** Explicit PostgreSQL `@db.Decimal(14, 4)` precision applied across all quantities and rates to eliminate floating-point arithmetic errors.
