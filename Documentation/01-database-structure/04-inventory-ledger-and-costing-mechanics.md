# ⚙️ Inventory Ledger & Costing Mechanics

This document explains the mathematical and database mechanics of the **Ledger-Based Inventory System** and the **Three Costing Engines** (FIFO, LIFO, Weighted Average).

---

## 📚 1. The Ledger-Based Inventory Engine

### Signed Movement Convention

In `inventory_transactions`, the `quantity` column is a signed decimal (`DECIMAL(14, 4)`):

| `transaction_type` | Quantity Sign | Physical Direction | Description |
| :--- | :---: | :--- | :--- |
| **`PURCHASE`** | `+` (Positive) | Inbound into Warehouse | Receiving goods from an external supplier. |
| **`SALE`** | `-` (Negative) | Outbound to Customer | Goods delivered to a customer. |
| **`ADJUSTMENT`** | `+` or `-` | Audit Correction | Discrepancy reconciliation (e.g. damaged stock `-` or found stock `+`). |
| **`TRANSFER_OUT`** | `-` (Negative) | Outbound from Source Warehouse | Stock leaving Warehouse A for transfer. |
| **`TRANSFER_IN`** | `+` (Positive) | Inbound to Destination Warehouse | Stock arriving at Warehouse B from transfer. |
| **`SALE_RETURN`** | `+` (Positive) | Inbound from Customer | Customer returned sold items back to stock. |
| **`PURCHASE_RETURN`**| `-` (Negative) | Outbound to Supplier | Defective items returned back to vendor. |

---

### Calculating Live Stock via SQL

#### 1. Live Stock for a Variant across ALL Warehouses:
```sql
SELECT 
    p.name AS product_name,
    pv.id AS variant_id,
    pv.color,
    pv.origin,
    COALESCE(SUM(it.quantity), 0) AS global_stock
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
LEFT JOIN inventory_transactions it ON it.variant_id = pv.id
WHERE pv.id = 'VARIANT_UUID_HERE'
GROUP BY p.name, pv.id, pv.color, pv.origin;
```

#### 2. Live Stock for ALL Variants in a SPECIFIC Warehouse:
```sql
SELECT 
    pv.id AS variant_id,
    p.name AS product_name,
    pv.color,
    pv.origin,
    SUM(it.quantity) AS warehouse_stock
FROM inventory_transactions it
JOIN product_variants pv ON pv.id = it.variant_id
JOIN products p ON p.id = pv.product_id
WHERE it.warehouse_id = 'WAREHOUSE_UUID_HERE'
GROUP BY pv.id, p.name, pv.color, pv.origin
HAVING warehouse_stock != 0;
```

---

## 📦 2. Costing Engine 1: FIFO (First-In, First-Out)

FIFO assumes that the oldest inventory batches purchased are the first ones sold.

### Table Used: `inventory_cost_layers`

### Inbound Flow (Purchase of 100 units @ $50):
1. Insert `inventory_transactions` row with `quantity = +100`, `unit_cost = 50.0000`.
2. Insert `inventory_cost_layers` row:
   - `variant_id`: `VAR-1`
   - `warehouse_id`: `WH-1`
   - `remaining_qty`: `100.0000`
   - `unit_cost`: `50.0000`
   - `created_at`: `2026-04-01 09:00:00`

### Multi-Layer Depletion Scenario:

Suppose we have two batches in `inventory_cost_layers`:
- **Layer 1:** 10 units @ $100 (`created_at`: 2026-04-01)
- **Layer 2:** 20 units @ $120 (`created_at`: 2026-04-05)

A customer purchases **15 units**:

```
Step 1: Fetch active layers ORDER BY created_at ASC
        Layer 1 has 10 units remaining.
        Layer 1 is fully consumed (10 units @ $100 = $1,000).
        Update Layer 1: remaining_qty = 0.
        Insert into cogs_entries:
          - quantity: 10
          - unit_cost: 100.0000
          - total_cost: 1000.00
          - source_layer_id: Layer 1 UUID

Step 2: Still need 5 units (15 - 10 = 5).
        Fetch next layer: Layer 2.
        Layer 2 has 20 units. Consume 5 units.
        Update Layer 2: remaining_qty = 15 (20 - 5).
        Insert into cogs_entries:
          - quantity: 5
          - unit_cost: 120.0000
          - total_cost: 600.00
          - source_layer_id: Layer 2 UUID

Total COGS for this sale = $1,000 + $600 = $1,600.
```

---

## 📦 3. Costing Engine 2: LIFO (Last-In, First-Out)

LIFO assumes that the newest inventory batches purchased are the first ones sold.

### Mechanics:
The mechanism is identical to FIFO, with exactly one difference in the selection query:
```sql
-- FIFO uses ASC:
SELECT * FROM inventory_cost_layers 
WHERE variant_id = ? AND warehouse_id = ? AND remaining_qty > 0 
ORDER BY created_at ASC;

-- LIFO uses DESC:
SELECT * FROM inventory_cost_layers 
WHERE variant_id = ? AND warehouse_id = ? AND remaining_qty > 0 
ORDER BY created_at DESC;
```

### Multi-Layer Depletion Scenario (LIFO on same 15 units):
- **Layer 1:** 10 units @ $100 (`created_at`: 2026-04-01)
- **Layer 2:** 20 units @ $120 (`created_at`: 2026-04-05)

```
Step 1: Fetch active layers ORDER BY created_at DESC
        Layer 2 is newest (20 units @ $120).
        Consume all 15 units from Layer 2.
        Update Layer 2: remaining_qty = 5 (20 - 15).
        Insert into cogs_entries:
          - quantity: 15
          - unit_cost: 120.0000
          - total_cost: 1800.00
          - source_layer_id: Layer 2 UUID

Total COGS for this sale = $1,800.
```

---

## ⚖️ 4. Costing Engine 3: Weighted Average

Weighted average recalculates a single moving average unit cost every time new stock is purchased.

### Table Used: `inventory_valuation`

This table holds a single aggregated state row per `(variant_id, warehouse_id)`:
- `total_quantity`
- `total_cost`
- `avg_unit_cost`

### Inbound Flow (Purchasing Stock):
When purchasing `new_qty` at `new_unit_cost`:
```
current_total_quantity = COALESCE(existing.total_quantity, 0)
current_total_cost     = COALESCE(existing.total_cost, 0)

updated_total_quantity = current_total_quantity + new_qty
updated_total_cost     = current_total_cost + (new_qty * new_unit_cost)

updated_avg_unit_cost  = updated_total_cost / updated_total_quantity
```

#### Numerical Example:
1. Currently holding: **10 units @ $100** (`total_cost` = $1,000, `avg_unit_cost` = $100).
2. Purchase arrives: **10 units @ $120** (batch cost = $1,200).
3. New State:
   - `total_quantity` = 10 + 10 = **20 units**
   - `total_cost` = $1,000 + $1,200 = **$2,200**
   - `avg_unit_cost` = $2,200 / 20 = **$110.0000**

### Outbound Flow (Selling Stock):
When selling `sale_qty`:
1. Use the current `avg_unit_cost` ($110.00).
2. Calculate COGS:
   ```
   cogs_total = sale_qty * avg_unit_cost
   ```
   For 15 units: 15 × $110 = **$1,650**.
3. Create row in `cogs_entries`:
   - `quantity`: 15
   - `unit_cost`: 110.0000
   - `total_cost`: 1650.00
   - `costing_method`: `'WEIGHTED_AVERAGE'`
   - `source_layer_id`: `NULL`
4. Update `inventory_valuation`:
   ```
   updated_total_quantity = current_total_quantity - sale_qty (20 - 15 = 5)
   updated_total_cost     = updated_total_quantity * avg_unit_cost (5 * 110 = $550)
   avg_unit_cost remains $110.0000
   ```

---

## 📊 Summary Comparison of Costing Outcomes

Using the exact same purchase history (10 @ $100, then 10 @ $120) and selling 15 units at $150 selling price ($2,250 Revenue):

| Metric | FIFO | LIFO | Weighted Average |
| :--- | :---: | :---: | :---: |
| **Revenue** | $2,250.00 | $2,250.00 | $2,250.00 |
| **COGS Recognized** | **$1,600.00** | **$1,800.00** | **$1,650.00** |
| **Gross Profit** | **$650.00** | **$450.00** | **$600.00** |
| **Ending Inventory Value (5 units)** | **$600.00** (5 @ $120) | **$500.00** (5 @ $100) | **$550.00** (5 @ $110) |

The database supports this financial flexibility while maintaining data integrity through separate tables and frozen `cogs_entries` records.
