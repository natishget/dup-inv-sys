# 📖 Complete Data Dictionary (All Tables & Fields)

This document provides an exhaustive, column-by-column reference for every database table in the system.

---

## 📑 Summary of Database Tables

| Table Name | Subsystem | Records Count Focus | Primary Purpose |
| :--- | :--- | :--- | :--- |
| [**`users`**](#1-users) | Authentication | Core Users | System operators, credentials, and role-based permissions. |
| [**`password_reset_tokens`**](#2-password_reset_tokens) | Authentication | Ephemeral | Standard Laravel password reset security tokens. |
| [**`sessions`**](#3-sessions) | Authentication | Active Sessions | Web session storage with user agent and IP audit data. |
| [**`products`**](#4-products) | Catalog | Master Catalog | Base product definitions (e.g., Aluminum Profile Series). |
| [**`product_variants`**](#5-product_variants) | Catalog | SKUs / Items | Specific sellable/purchasable variants (color, origin, size). |
| [**`warehouses`**](#6-warehouses) | Catalog / Inventory | Physical Locations | Physical storage locations and depots. |
| [**`costing_methods`**](#7-costing_methods) | System Config | 3 Fixed Records | Costing options (FIFO, LIFO, WEIGHTED_AVERAGE). |
| [**`system_settings`**](#8-system_settings) | System Config | 1 Singleton Record | Global active costing method setting. |
| [**`purchases`**](#9-purchases) | Inbound Trading | Header Records | Supplier invoices, total purchase costs, and status. |
| [**`purchase_items`**](#10-purchase_items) | Inbound Trading | Line Items | Specific variants, quantities, and unit purchase costs. |
| [**`sales`**](#11-sales) | Outbound Trading | Header Records | Customer orders, total revenue, dates, and status. |
| [**`sale_items`**](#12-sale_items) | Outbound Trading | Line Items | Specific variants sold, quantities, and selling prices. |
| [**`inventory_transactions`**](#13-inventory_transactions) | Inventory Ledger | High Volume Ledger | **Single source of truth** for all stock movement. |
| [**`inventory_cost_layers`**](#14-inventory_cost_layers) | Costing | Active Cost Layers | FIFO / LIFO available inventory batches and remaining quantities. |
| [**`inventory_valuation`**](#15-inventory_valuation) | Costing | State Snapshot | Weighted Average moving cost and total quantity per variant/warehouse. |
| [**`cogs_entries`**](#16-cogs_entries) | Financial Accounting | Auditable Snapshots | Permanent historical cost of goods sold per sale line item. |
| [**`cache` & `cache_locks`**](#17-cache--cache_locks) | Infrastructure | Framework Cache | Application key-value caching and atomic lock handling. |
| [**`jobs` & `failed_jobs`**](#18-jobs--failed_jobs) | Infrastructure | Asynchronous Queue | Background task processing, batches, and failure logs. |

---

## 1. `users`

Stores system users with role-based access control and contact details.

- **Primary Key:** `id` (`CHAR(36)` UUID)
- **Model:** `App\Models\User`

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `CHAR(36)` | NO | None | **PRIMARY KEY** | Universal Unique Identifier for the user. |
| `name` | `VARCHAR(255)` | NO | None | None | Full legal or display name of the operator. |
| `phone` | `VARCHAR(255)` | NO | None | **UNIQUE** | Direct contact telephone number. |
| `email` | `VARCHAR(255)` | NO | None | **UNIQUE** | Primary email address used for login authentication. |
| `email_verified_at` | `TIMESTAMP` | YES | `NULL` | None | Timestamp when email verification was completed. |
| `role` | `ENUM` | NO | `'SALES'` | Allowed: `ADMIN`, `SALES`, `AUDITOR` | System permission level controlling UI views and capabilities. |
| `is_active` | `BOOLEAN` | NO | `1` (true) | None | Account status flag. Deactivated users cannot log in. |
| `password` | `VARCHAR(255)` | NO | None | None | Bcrypt/Argon2 hashed password string. |
| `remember_token` | `VARCHAR(100)` | YES | `NULL` | None | Secure token for persistent "Remember Me" authentication. |
| `created_at` | `TIMESTAMP` | YES | `NULL` | None | Standard Laravel record creation timestamp. |
| `updated_at` | `TIMESTAMP` | YES | `NULL` | None | Standard Laravel last-modified timestamp. |

---

## 2. `password_reset_tokens`

Standard Laravel token table for secure account password recovery.

- **Primary Key:** `email` (`VARCHAR(255)`)

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `email` | `VARCHAR(255)` | NO | None | **PRIMARY KEY** | Target user email requesting password reset. |
| `token` | `VARCHAR(255)` | NO | None | None | Encrypted one-time reset token string. |
| `created_at` | `TIMESTAMP` | YES | `NULL` | None | Timestamp when reset request was initiated. |

---

## 3. `sessions`

Stores authenticated HTTP session payloads for the web interface.

- **Primary Key:** `id` (`VARCHAR(255)`)

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(255)` | NO | None | **PRIMARY KEY** | Unique session token ID. |
| `user_id` | `CHAR(36)` | YES | `NULL` | **INDEX** | UUID of the authenticated user (nullable for guests). |
| `ip_address` | `VARCHAR(45)` | YES | `NULL` | None | Client IPv4 or IPv6 network address. |
| `user_agent` | `TEXT` | YES | `NULL` | None | Browser / device client header string. |
| `payload` | `LONGTEXT` | NO | None | None | Serialized session data. |
| `last_activity` | `INT` | NO | None | **INDEX** | Unix timestamp of the last user interaction. |

---

## 4. `products`

Master catalog table representing high-level product definitions. In this business, actual physical items are variants of a product.

- **Primary Key:** `id` (`CHAR(36)` UUID)
- **Model:** `App\Models\Product`
- **Relationships:** `hasMany(ProductVariant)`

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `CHAR(36)` | NO | None | **PRIMARY KEY** | Universal Unique Identifier for the master product. |
| `name` | `VARCHAR(255)` | NO | None | None | Commercial name (e.g., "Aluminum Profile Series 20", "Square Tube"). |
| `base_unit` | `VARCHAR(50)` | YES | `NULL` | None | Standard measurement unit (e.g., "PCS", "KG", "METER"). |
| `created_at` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | None | Record creation timestamp (immutable; no updated_at). |

---

## 5. `product_variants`

The core trading entity. Aluminum stock is tracked by color, origin, thickness, and profile dimensions.

- **Primary Key:** `id` (`CHAR(36)` UUID)
- **Model:** `App\Models\ProductVariant`
- **Relationships:**
  - `belongsTo(Product)`
  - `hasMany(PurchaseItem)`
  - `hasMany(SaleItem)`
  - `hasMany(InventoryTransaction)`
  - `hasMany(InventoryCostLayer)`
  - `hasMany(InventoryValuation)`
  - `hasMany(CogsEntry)`

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `CHAR(36)` | NO | None | **PRIMARY KEY** | Universal Unique Identifier for the product variant. |
| `product_id` | `CHAR(36)` | YES | `NULL` | **FOREIGN KEY** -> `products.id` | Reference to the parent master product. |
| `color` | `VARCHAR(50)` | YES | `NULL` | None | Finish or anodized color (e.g., "Bronze", "Silver", "Black", "White"). |
| `origin` | `ENUM` | YES | `NULL` | Allowed: `LOCAL`, `IMPORTED` | Manufacturing origin of the item. |
| `sku` | `VARCHAR(100)` | YES | `NULL` | **UNIQUE** | Stock Keeping Unit code for barcode scanning and quick search. |
| `thickness` | `DECIMAL(10,2)` | YES | `NULL` | None | Wall thickness in millimeters (e.g., `1.20`, `2.00`). |
| `size` | `VARCHAR(100)` | YES | `NULL` | None | Length or profile dimension string (e.g., "6.0m", "5.8m"). |
| `created_at` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | None | Record creation timestamp. |

---

## 6. `warehouses`

Physical warehouse facilities, yards, or branch showrooms where stock is physically held.

- **Primary Key:** `id` (`CHAR(36)` UUID)
- **Model:** `App\Models\Warehouse`
- **Relationships:**
  - `hasMany(InventoryTransaction)`
  - `hasMany(InventoryCostLayer)`
  - `hasMany(InventoryValuation)`

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `CHAR(36)` | NO | None | **PRIMARY KEY** | Universal Unique Identifier for the warehouse. |
| `name` | `VARCHAR(100)` | YES | `NULL` | None | Descriptive name (e.g., "Main Depot", "Airport Road Showroom"). |
| `location` | `TEXT` | YES | `NULL` | None | Physical address or warehouse coordinates. |

---

## 7. `costing_methods`

Lookup table defining the mathematical algorithms supported by the costing engine.

- **Primary Key:** `id` (`CHAR(36)` UUID)
- **Model:** `App\Models\CostingMethod`

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `CHAR(36)` | NO | None | **PRIMARY KEY** | Universal Unique Identifier for the method record. |
| `name` | `ENUM` | NO | None | Allowed: `FIFO`, `LIFO`, `WEIGHTED_AVERAGE` | Standard accounting costing method name. |

---

## 8. `system_settings`

Single-record configuration table defining active application parameters.

- **Primary Key:** `id` (`CHAR(36)` UUID)
- **Model:** `App\Models\SystemSetting`

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `CHAR(36)` | NO | None | **PRIMARY KEY** | Universal Unique Identifier for the settings record. |
| `active_costing_method` | `CHAR(36)` | YES | `NULL` | **FOREIGN KEY** -> `costing_methods.id` | Specifies which costing method is currently active for sales. |

---

## 9. `purchases`

Header table for inbound supplier purchases.

- **Primary Key:** `id` (`CHAR(36)` UUID)
- **Model:** `App\Models\Purchase`
- **Relationships:**
  - `belongsTo(User, 'created_by')`
  - `hasMany(PurchaseItem)`

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `CHAR(36)` | NO | None | **PRIMARY KEY** | Universal Unique Identifier for the purchase order/invoice. |
| `supplier_name` | `VARCHAR(255)` | YES | `NULL` | None | Name of the supplying vendor or manufacturer. |
| `invoice_number` | `VARCHAR(100)` | YES | `NULL` | None | Supplier's external reference/bill number. |
| `total_amount` | `DECIMAL(14,2)` | YES | `NULL` | None | Aggregate total cost of all line items on the purchase. |
| `purchase_date` | `DATE` | YES | `NULL` | None | Official date goods were received/invoiced. |
| `status` | `ENUM` | NO | `'POSTED'` | Allowed: `POSTED`, `VOIDED`, **INDEX** | Current lifecycle status. VOIDED purchases are invalidated. |
| `reference_type` | `VARCHAR(20)` | YES | `NULL` | None | Reversal/return classification code (`'VOID'`, `'RETURN'`). |
| `reference_id` | `CHAR(36)` | YES | `NULL` | **INDEX** | Pointer UUID to parent purchase if this record is a return/void. |
| `notes` | `TEXT` | YES | `NULL` | None | Operator remarks, cancellation reasons, or notes. |
| `created_by` | `CHAR(36)` | YES | `NULL` | **FOREIGN KEY** -> `users.id` | User who entered the transaction into the system. |
| `created_at` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | None | Record creation timestamp. |

---

## 10. `purchase_items`

Line items for a purchase order, detailing specific variants and incoming unit costs.

- **Primary Key:** `id` (`CHAR(36)` UUID)
- **Model:** `App\Models\PurchaseItem`
- **Relationships:**
  - `belongsTo(Purchase)`
  - `belongsTo(ProductVariant)`

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `CHAR(36)` | NO | None | **PRIMARY KEY** | Universal Unique Identifier for the purchase line item. |
| `purchase_id` | `CHAR(36)` | YES | `NULL` | **FOREIGN KEY** -> `purchases.id` | Reference to the parent purchase invoice. |
| `variant_id` | `CHAR(36)` | YES | `NULL` | **FOREIGN KEY** -> `product_variants.id` | The specific variant purchased. |
| `quantity` | `DECIMAL(14,4)` | YES | `NULL` | None | Total quantity purchased (precision for fractional units). |
| `unit_cost` | `DECIMAL(14,4)` | YES | `NULL` | None | Exact acquisition cost per unit. |
| `total_cost` | `DECIMAL(14,2)` | YES | `NULL` | None | `quantity * unit_cost` line item total. |

---

## 11. `sales`

Header table for outbound customer sales.

- **Primary Key:** `id` (`CHAR(36)` UUID)
- **Model:** `App\Models\Sale`
- **Relationships:**
  - `belongsTo(User, 'created_by')`
  - `hasMany(SaleItem)`

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `CHAR(36)` | NO | None | **PRIMARY KEY** | Universal Unique Identifier for the customer sale invoice. |
| `customer_name` | `VARCHAR(255)` | YES | `NULL` | None | Customer or client company name. |
| `total_amount` | `DECIMAL(14,2)` | YES | `NULL` | None | Total sales revenue collected for this invoice. |
| `sale_date` | `DATE` | YES | `NULL` | **INDEX** | Date transaction took place (indexed for dashboard queries). |
| `status` | `ENUM` | NO | `'POSTED'` | Allowed: `POSTED`, `VOIDED`, **INDEX** | Status of the sale. VOIDED sales are excluded from revenue. |
| `reference_type` | `VARCHAR(20)` | YES | `NULL` | None | Correction category (`'VOID'`, `'RETURN'`). |
| `reference_id` | `CHAR(36)` | YES | `NULL` | **INDEX** | Linked parent sale UUID in return/void workflows. |
| `notes` | `TEXT` | YES | `NULL` | None | Audit notes, customer remarks, or void explanations. |
| `created_by` | `CHAR(36)` | YES | `NULL` | **FOREIGN KEY** -> `users.id` | User account who recorded the sale. |
| `created_at` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | None | Record creation timestamp. |

---

## 12. `sale_items`

Individual line items for a sale invoice. Source of gross revenue data.

- **Primary Key:** `id` (`CHAR(36)` UUID)
- **Model:** `App\Models\SaleItem`
- **Relationships:**
  - `belongsTo(Sale)`
  - `belongsTo(ProductVariant)`
  - `hasMany(CogsEntry)`

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `CHAR(36)` | NO | None | **PRIMARY KEY** | Universal Unique Identifier for the sale line item. |
| `sale_id` | `CHAR(36)` | YES | `NULL` | **FOREIGN KEY** -> `sales.id`, **INDEX** | Parent sale invoice reference. |
| `variant_id` | `CHAR(36)` | YES | `NULL` | **FOREIGN KEY** -> `product_variants.id`, **INDEX** | Specific variant sold. |
| `quantity` | `DECIMAL(14,4)` | YES | `NULL` | None | Number of units sold to customer. |
| `selling_price` | `DECIMAL(14,4)` | YES | `NULL` | None | Price charged per unit. |
| `total_price` | `DECIMAL(14,2)` | YES | `NULL` | None | Line item gross revenue (`quantity * selling_price`). |

---

## 13. `inventory_transactions`

**The central ledger table.** Every physical movement of stock across the entire business must create an entry here.

- **Primary Key:** `id` (`CHAR(36)` UUID)
- **Model:** `App\Models\InventoryTransaction`
- **Relationships:**
  - `belongsTo(ProductVariant)`
  - `belongsTo(Warehouse)`
  - `belongsTo(User, 'created_by')`

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `CHAR(36)` | NO | None | **PRIMARY KEY** | Universal Unique Identifier for the ledger movement. |
| `variant_id` | `CHAR(36)` | YES | `NULL` | **FOREIGN KEY** -> `product_variants.id`, **INDEX** | Product variant moved. |
| `warehouse_id` | `CHAR(36)` | YES | `NULL` | **FOREIGN KEY** -> `warehouses.id`, **INDEX** | Warehouse where movement occurred. |
| `transaction_type` | `ENUM` | YES | `NULL` | Allowed: `PURCHASE`, `SALE`, `ADJUSTMENT`, `TRANSFER_IN`, `TRANSFER_OUT`, `SALE_RETURN`, `PURCHASE_RETURN`, **INDEX** | Classification of stock movement. |
| `quantity` | `DECIMAL(14,4)` | YES | `NULL` | None | Signed quantity. Positive (`+`) adds stock; Negative (`-`) deducts stock. |
| `unit_cost` | `DECIMAL(14,4)` | YES | `NULL` | None | Cost per unit at time of transaction. |
| `reference_type` | `VARCHAR(50)` | YES | `NULL` | **COMPOSITE INDEX** with `reference_id` | Source entity model name (`'PURCHASE'`, `'SALE'`, `'TRANSFER'`). |
| `reference_id` | `CHAR(36)` | YES | `NULL` | **INDEX**, **COMPOSITE INDEX** | Primary key UUID of the source document. |
| `transaction_date` | `DATE` | YES | `NULL` | **INDEX** | Accounting date of the inventory movement. |
| `created_by` | `CHAR(36)` | YES | `NULL` | **FOREIGN KEY** -> `users.id` | User responsible for authorizing the movement. |
| `created_at` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | None | Exact system insertion timestamp. |

---

## 14. `inventory_cost_layers`

Manages cost layers used exclusively by **FIFO** and **LIFO** valuation engines.

- **Primary Key:** `id` (`CHAR(36)` UUID)
- **Model:** `App\Models\InventoryCostLayer`
- **Relationships:**
  - `belongsTo(ProductVariant)`
  - `belongsTo(Warehouse)`

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `CHAR(36)` | NO | None | **PRIMARY KEY** | Universal Unique Identifier for the cost layer. |
| `variant_id` | `CHAR(36)` | YES | `NULL` | **FOREIGN KEY** -> `product_variants.id`, **INDEX** | Variant linked to this cost layer. |
| `warehouse_id` | `CHAR(36)` | YES | `NULL` | **FOREIGN KEY** -> `warehouses.id`, **INDEX** | Warehouse holding this cost layer batch. |
| `remaining_qty` | `DECIMAL(14,4)` | YES | `NULL` | None | Available unconsumed units remaining in this specific layer. |
| `unit_cost` | `DECIMAL(14,4)` | YES | `NULL` | None | Original purchase acquisition cost per unit for this batch. |
| `source_transaction_id` | `CHAR(36)` | YES | `NULL` | None | UUID of originating `inventory_transactions` row. |
| `created_at` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | None | Layer inception timestamp (determines FIFO vs LIFO priority). |

---

## 15. `inventory_valuation`

Stores the perpetual moving average state used exclusively by the **Weighted Average** costing engine.

- **Primary Key:** Composite (`variant_id`, `warehouse_id`)
- **Model:** `App\Models\InventoryValuation`
- **Relationships:**
  - `belongsTo(ProductVariant)`
  - `belongsTo(Warehouse)`

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `variant_id` | `CHAR(36)` | NO | None | **PRIMARY KEY (1/2)**, **FOREIGN KEY** -> `product_variants.id` | Variant identifier. |
| `warehouse_id` | `CHAR(36)` | NO | None | **PRIMARY KEY (2/2)**, **FOREIGN KEY** -> `warehouses.id` | Warehouse identifier. |
| `total_quantity` | `DECIMAL(14,4)` | YES | `NULL` | None | Current total cumulative quantity held in this warehouse. |
| `total_cost` | `DECIMAL(14,4)` | YES | `NULL` | None | Current total cumulative monetary cost of the inventory held. |
| `avg_unit_cost` | `DECIMAL(14,4)` | YES | `NULL` | None | Perpetually updated moving unit cost (`total_cost / total_quantity`). |

---

## 16. `cogs_entries`

Permanent, auditable Cost of Goods Sold (COGS) snapshots created at the instant of a sale.

- **Primary Key:** `id` (`CHAR(36)` UUID)
- **Model:** `App\Models\CogsEntry`
- **Relationships:**
  - `belongsTo(SaleItem)`
  - `belongsTo(ProductVariant)`

| Column | Type | Nullable | Default | Constraints / Index | Description & Business Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `CHAR(36)` | NO | None | **PRIMARY KEY** | Universal Unique Identifier for the COGS snapshot. |
| `sale_item_id` | `CHAR(36)` | YES | `NULL` | **FOREIGN KEY** -> `sale_items.id`, **INDEX** | The sale line item that triggered this cost recognition. |
| `variant_id` | `CHAR(36)` | YES | `NULL` | **FOREIGN KEY** -> `product_variants.id`, **INDEX** | Product variant sold. |
| `quantity` | `DECIMAL(14,4)` | YES | `NULL` | None | Quantity consumed from the specific cost source. |
| `unit_cost` | `DECIMAL(14,4)` | YES | `NULL` | None | Actual cost applied to this portion of the sale. |
| `total_cost` | `DECIMAL(14,2)` | YES | `NULL` | None | Total financial cost recognized (`quantity * unit_cost`). |
| `costing_method` | `ENUM` | YES | `NULL` | Allowed: `FIFO`, `LIFO`, `WEIGHTED_AVERAGE` | The costing engine in effect when the sale occurred. |
| `source_layer_id` | `CHAR(36)` | YES | `NULL` | None | UUID of `inventory_cost_layers` row consumed (`NULL` for Weighted Avg). |
| `created_at` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | None | Moment of COGS entry creation. |

---

## 17. `cache` & `cache_locks`

Laravel application caching tables for high-traffic query results and distributed mutex locks.

### `cache`
- **Primary Key:** `key` (`VARCHAR(255)`)
- Columns:
  - `key` (`VARCHAR(255)` PK)
  - `value` (`MEDIUMTEXT`)
  - `expiration` (`INT`)

### `cache_locks`
- **Primary Key:** `key` (`VARCHAR(255)`)
- Columns:
  - `key` (`VARCHAR(255)` PK)
  - `owner` (`VARCHAR(255)`)
  - `expiration` (`INT`)

---

## 18. `jobs`, `job_batches`, `failed_jobs`

Standard Laravel queue management subsystem for background tasks (e.g., export generation, heavy report computations).

### `jobs`
- **Primary Key:** `id` (`BIGINT UNSIGNED AUTO_INCREMENT`)
- Columns: `id`, `queue` (indexed), `payload` (LONGTEXT), `attempts` (TINYINT), `reserved_at` (INT, nullable), `available_at` (INT, indexed), `created_at` (INT).

### `job_batches`
- **Primary Key:** `id` (`VARCHAR(255)`)
- Columns: `id`, `name`, `total_jobs`, `pending_jobs`, `failed_jobs`, `failed_job_ids`, `options`, `cancelled_at`, `created_at`, `finished_at`.

### `failed_jobs`
- **Primary Key:** `id` (`BIGINT UNSIGNED AUTO_INCREMENT`)
- Columns: `id`, `uuid` (unique), `connection`, `queue`, `payload`, `exception`, `failed_at`.
