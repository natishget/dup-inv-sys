# 🏛️ Database Overview & Core Design Principles

## 📌 Executive Summary

The database in this system powers a **financially auditable stock, inventory, and cost-of-goods-sold (COGS) tracking platform** tailored specifically for an aluminum and metals trading enterprise. 

In a trading business, inventory values fluctuate constantly based on international purchase prices, shipping batches, and local supplier costs. Minor rounding errors or destructive updates can cause catastrophic financial reporting distortions.

To guarantee financial truth, audit compliance, and multi-warehouse operational visibility, the database is architected around **five foundational database design pillars**.

---

## 💎 The 5 Core Database Design Pillars

```
+-----------------------------------------------------------------------------------+
|                           5 CORE DATABASE PILLARS                                 |
+-----------------------------------------------------------------------------------+
|  1. LEDGER-BASED INVENTORY       --> Never store a mutable 'stock' integer        |
|  2. MULTI-VALUATION COSTING     --> Dedicated tables for FIFO, LIFO & Weighted Avg|
|  3. IMMUTABLE COGS SNAPSHOTS    --> Capture exact costs at moment of sale         |
|  4. NON-DESTRUCTIVE AUDIT TRAIL --> Status changes (POSTED/VOIDED) & reversals    |
|  5. STRICT UUID & PRECISION     --> CHAR(36) UUIDs & DECIMAL(14,4) precision      |
+-----------------------------------------------------------------------------------+
```

---

### Pillar 1: Ledger-Based Inventory (The "Zero Stock Column" Rule)

#### The Problem with Traditional Stock Columns:
Traditional inventory systems add a `current_stock` column to a `products` table and mutate it via:
```sql
-- DANGEROUS PATTERN (NOT USED HERE)
UPDATE products SET current_stock = current_stock - 5 WHERE id = 1;
```
If two concurrent requests execute, or a server crashes halfway through, or a record is silently adjusted, the stock number becomes disconnected from reality. You cannot prove *why* the stock is 12 instead of 17.

#### The Ledger Solution:
In this database:
- **There is NO `stock` or `quantity_on_hand` column in `products` or `product_variants`.**
- Stock is treated like a bank account ledger. All movements are recorded as discrete, signed rows in `inventory_transactions`.
- Inbound transactions (Purchases, Sale Returns, Transfer In) insert a **positive quantity** (`+qty`).
- Outbound transactions (Sales, Purchase Returns, Transfer Out) insert a **negative quantity** (`-qty`).

#### Calculating Live Stock in SQL:
To discover the current physical stock of a product variant in a warehouse:
```sql
SELECT 
    warehouse_id,
    variant_id,
    SUM(quantity) AS current_stock
FROM inventory_transactions
WHERE variant_id = 'YOUR_VARIANT_UUID'
  AND warehouse_id = 'YOUR_WAREHOUSE_UUID'
GROUP BY warehouse_id, variant_id;
```
This guarantees an unbroken, legally auditable chain of custody for every single physical unit.

---

### Pillar 2: Multi-Valuation Costing Engines

Trading businesses require flexible accounting treatments for taxation, internal performance, or compliance. The database accommodates **three distinct costing methodologies** simultaneously:

| Method | Database Representation | Mechanics |
| :--- | :--- | :--- |
| **FIFO** (First-In, First-Out) | `inventory_cost_layers` | Depletes layers with the oldest `created_at` timestamp first. |
| **LIFO** (Last-In, First-Out) | `inventory_cost_layers` | Depletes layers with the newest `created_at` timestamp first. |
| **Weighted Average** | `inventory_valuation` | Maintains a perpetual moving average `(total_cost / total_quantity)` per variant and warehouse. |

The active methodology for the business is controlled centrally through the `system_settings` table, which references `costing_methods`.

---

### Pillar 3: Immutable COGS Financial Snapshots

#### The Problem:
If you sell 10 aluminum profiles today at $50 cost each, and next month you buy more aluminum at $80, a system that computes past COGS dynamically on the fly will erroneously recalculate last month's financial statements, corrupting past tax returns and executive P&L statements.

#### The Database Rule:
- COGS is calculated **at the exact second the sale is committed**.
- The resulting cost breakdown is permanently written into `cogs_entries`.
- Once written, a `cogs_entries` record is **NEVER updated or recalculated**.
- Historical gross profit for any past month remains 100% frozen and accurate forever.

---

### Pillar 4: Non-Destructive Safe Corrections (No Hard Deletes)

Financial transactions must never be deleted from the database (`DELETE FROM sales` is strictly forbidden in application logic).

Instead, the database supports an append-only safe correction architecture:
1. **Posting Status (`status` ENUM):**  
   Both `sales` and `purchases` tables carry a `status` column: `POSTED` (active/committed) or `VOIDED` (cancelled/invalidated).
2. **Reversal Transactions:**  
   Voiding a sale creates an inverse `inventory_transactions` record of type `SALE_RETURN` (+quantity) to restore warehouse stock.
3. **Reference Linking:**  
   The correcting transaction stores `reference_type` (`'VOID'` or `'RETURN'`) and `reference_id` pointing directly to the parent transaction UUID.

---

### Pillar 5: Strict UUIDs & High-Precision Decimal Standards

#### 1. Universal Unique Identifiers (UUID v4)
All tables use `CHAR(36)` UUID primary keys (`id`) generated by the application layer:
- **No ID collision risk** across distributed nodes or offline mobile clients.
- **Security:** Prevents sequential enumeration attacks (attackers guessing `/sales/1`, `/sales/2`).
- **Data migration friendly:** Seamless merging of multiple database nodes or backup restorations without auto-increment collisions.

#### 2. High-Precision Decimals
Aluminum and industrial commodities are often measured in fractional units (e.g., kilograms, metric tons, fractional meters, or running meters).

| Column Category | SQL Data Type | Purpose & Precision |
| :--- | :--- | :--- |
| **Quantities** | `DECIMAL(14, 4)` | Supports up to 9,999,999,999.9999 units (4 decimal places for millimeter/gram accuracy). |
| **Unit Costs / Rates** | `DECIMAL(14, 4)` | Eliminates micro-rounding errors when computing fractional unit costs. |
| **Monetary Totals** | `DECIMAL(14, 2)` | Standard currency rounding (2 decimal places for cents/fils/cents). |

---

## 🧩 Architectural Subsystems Overview

The database tables are organized into 5 functional subsystems:

```
+-----------------------------------------------------------------------------------------+
|                                DATABASE SUBSYSTEMS                                      |
+-----------------------------------------------------------------------------------------+
| 1. AUTH & SYSTEM        | users, sessions, password_reset_tokens, costing_methods,       |
|                         | system_settings                                               |
+-------------------------+---------------------------------------------------------------+
| 2. PRODUCT CATALOG      | products, product_variants, warehouses                         |
+-------------------------+---------------------------------------------------------------+
| 3. INVENTORY LEDGER     | inventory_transactions                                        |
+-------------------------+---------------------------------------------------------------+
| 4. PURCHASES & SALES    | purchases, purchase_items, sales, sale_items                   |
+-------------------------+---------------------------------------------------------------+
| 5. COSTING & VALUATION  | inventory_cost_layers, inventory_valuation, cogs_entries       |
+-----------------------------------------------------------------------------------------+
```

---

## 🔒 Database Technology Specifications

- **Database Engine:** MySQL 8.0+ / MariaDB 10.5+
- **Table Storage Engine:** InnoDB (Strict ACID transaction support, foreign key constraint enforcement, and row-level locking)
- **Character Set:** `utf8mb4`
- **Collation:** `utf8mb4_unicode_ci` (Full Unicode support including multilingual supplier/customer names)
- **Timezone Standard:** UTC for all database timestamps (`created_at`).
