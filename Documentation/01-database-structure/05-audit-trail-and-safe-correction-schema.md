# 🛡️ Audit Trail & Safe Correction Schema

This document details the database architecture for **non-destructive corrections, voiding, returns, reversing entries, and high-performance reporting indexes**.

---

## 🚫 The Prohibition of Hard Deletion

In traditional naive CRUD applications, a mistake on an order is resolved by executing:
```sql
-- STRICTLY FORBIDDEN IN THIS DATABASE
DELETE FROM sales WHERE id = '...';
DELETE FROM purchases WHERE id = '...';
```
Executing SQL `DELETE` on financial records causes:
1. **Dangling foreign keys or cascade anomalies** in downstream ledgers.
2. **Disappearance of physical audit evidence**, exposing the business to fraud.
3. **Desynchronization of inventory balances**, because physical items that were already deducted or received are not reversed in the ledger.

---

## 🏗️ Safe Correction Schema Design

To eliminate destructive operations while allowing operators to fix clerical errors or customer returns, the schema includes dedicated correction columns across `sales`, `purchases`, and `inventory_transactions`:

```
+-----------------------------------------------------------------------------------------+
|                                CORRECTION COLUMNS                                       |
+-----------------------------------------------------------------------------------------+
|  TABLE: sales & purchases                                                               |
|    - status         ENUM('POSTED', 'VOIDED') DEFAULT 'POSTED'                           |
|    - reference_type VARCHAR(20) NULL (e.g. 'VOID', 'RETURN')                            |
|    - reference_id   CHAR(36) NULL (UUID linking back to the original transaction)       |
|    - notes          TEXT NULL (Human audit justification for the action)                |
+-----------------------------------------------------------------------------------------+
|  TABLE: inventory_transactions                                                          |
|    - transaction_type  ENUM (includes 'SALE_RETURN', 'PURCHASE_RETURN', 'ADJUSTMENT')   |
|    - reference_type    VARCHAR(50)                                                      |
|    - reference_id      CHAR(36)                                                         |
+-----------------------------------------------------------------------------------------+
```

---

## 🔄 The 4 Safe Correction Workflows

### 1. Voiding a Sale (`voidSale`)

When a sale was entered in error or cancelled before fulfillment:

```
[Sale: POSTED] ──────► Operator Clicks Void ──────► [Sale: VOIDED]
                                                            │
                     ┌──────────────────────────────────────┴──────────────────────────────────────┐
                     ▼                                                                             ▼
    [inventory_transactions]                                                                [COGS Impact]
    Insert: type = 'SALE_RETURN'                                                            cogs_entries for this
    quantity = +POSITIVE (Stock returned to warehouse)                                      sale are bypassed during
    reference_type = 'SALE', reference_id = Sale UUID                                       financial reporting
```

#### Database State Changes:
1. **`sales` Table:**
   - `status` updated from `'POSTED'` to `'VOIDED'`.
   - `notes` appended with cancellation reason and operator timestamp.
2. **`inventory_transactions` Table:**
   - For every item on the sale, a new row is inserted with `transaction_type = 'SALE_RETURN'` and a **positive quantity** (`+qty`) to return items to the warehouse.
3. **Revenue Impact:**
   - Because `status = 'VOIDED'`, all reporting queries filtering on `status = 'POSTED'` immediately exclude this sale from gross revenue calculations.

---

### 2. Processing a Sales Return (`createSalesReturn`)

When a customer returns a portion of goods days or weeks after the sale:

1. The original `sales` record **remains untouched and `POSTED`**.
2. An inventory reversal is inserted into `inventory_transactions`:
   - `transaction_type`: `'SALE_RETURN'`
   - `quantity`: `+returned_qty`
   - `reference_type`: `'SALE'`
   - `reference_id`: Original Sale UUID
3. Cost restoration is applied according to the active costing method (e.g., adding a new batch layer in `inventory_cost_layers` or adjusting `inventory_valuation`).

---

### 3. Voiding a Purchase (`voidPurchase`)

When a supplier invoice was wrongly posted or rejected:

1. **`purchases` Table:**
   - `status` set to `'VOIDED'`.
2. **`inventory_transactions` Table:**
   - Insert rows with `transaction_type = 'PURCHASE_RETURN'` and a **negative quantity** (`-qty`) to remove the mistakenly received goods.
3. **Cost Layer Invalidation:**
   - The associated unconsumed batch in `inventory_cost_layers` is cancelled or reduced.
   - For Weighted Average, `inventory_valuation` is adjusted to reverse the cost basis contribution.

---

### 4. Processing a Purchase Return (`createPurchaseReturn`)

When defective goods are shipped back to a supplier for a credit note:

1. A new `purchases` record is created with:
   - `reference_type`: `'RETURN'`
   - `reference_id`: Original Purchase UUID
   - Negative financial value or return notation.
2. Insert into `inventory_transactions`:
   - `transaction_type`: `'PURCHASE_RETURN'`
   - `quantity`: `-returned_qty`

---

## ⚡ Query Performance & Reporting Indexes

As transactions accumulate over years of trading, queries calculating live stock, monthly revenue, and COGS must remain sub-second.

The database includes explicit composite and single-column indexes:

### Performance Indexes Summary:

| Table | Index Columns | Migration Source | Targeted Query Pattern |
| :--- | :--- | :--- | :--- |
| **`sales`** | `sale_date` | `2026_04_27_110628` | Dashboard monthly/daily date range filters (`WHERE sale_date BETWEEN ? AND ?`). |
| **`sales`** | `status` | `2026_04_27_075002` | Excluding cancelled orders (`WHERE status = 'POSTED'`). |
| **`sales`** | `reference_id` | `2026_04_27_075002` | Rapid lookup of linked returns and parent sales. |
| **`sale_items`** | `sale_id` | `2026_04_27_110628` | Eager-loading line items for invoice detail views. |
| **`sale_items`** | `variant_id` | `2026_04_27_110628` | Per-variant revenue aggregation and product sales reporting. |
| **`cogs_entries`** | `sale_item_id` | `2026_04_27_110628` | Joining COGS entries directly onto sale line items. |
| **`cogs_entries`** | `variant_id` | `2026_04_27_110628` | Per-variant COGS reporting and gross profit margin queries. |
| **`inventory_transactions`** | `variant_id` | Initial Migration | Calculating live stock balance for a variant. |
| **`inventory_transactions`** | `warehouse_id` | Initial Migration | Calculating warehouse physical inventory. |
| **`inventory_transactions`** | `transaction_date`| Initial Migration | Historical ledger and auditing timeline filtering. |
| **`inventory_transactions`** | `transaction_type`| `2026_04_27_075002` | Filtering by purchase vs sale vs adjustment. |
| **`inventory_transactions`** | `['reference_type', 'reference_id']` | `2026_04_27_075002` | Composite index for finding all ledger movements originating from a document. |
| **`inventory_cost_layers`** | `['variant_id', 'warehouse_id']` | Initial Migration | Fast fetch of unconsumed layers during FIFO/LIFO depletion. |

---

## 📊 Core Reporting Query Standard

Whenever building financial and executive queries, always adhere to this SQL template:

```sql
SELECT 
    pv.id AS variant_id,
    p.name AS product_name,
    pv.color,
    pv.origin,
    SUM(si.quantity) AS total_units_sold,
    SUM(si.total_price) AS total_revenue,
    SUM(ce.total_cost) AS total_cogs,
    (SUM(si.total_price) - SUM(ce.total_cost)) AS gross_profit,
    ROUND(((SUM(si.total_price) - SUM(ce.total_cost)) / NULLIF(SUM(si.total_price), 0)) * 100, 2) AS profit_margin_pct
FROM sale_items si
JOIN sales s ON s.id = si.sale_id
JOIN product_variants pv ON pv.id = si.variant_id
JOIN products p ON p.id = pv.product_id
LEFT JOIN cogs_entries ce ON ce.sale_item_id = si.id
WHERE s.status = 'POSTED'
  AND s.sale_date BETWEEN '2026-01-01' AND '2026-12-31'
GROUP BY pv.id, p.name, pv.color, pv.origin
ORDER BY gross_profit DESC;
```
