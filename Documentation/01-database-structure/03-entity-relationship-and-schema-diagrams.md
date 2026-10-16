# 🗺️ Entity Relationship & Schema Diagrams

This document visualizes the entire relational database schema using Mermaid diagrams and provides a complete Foreign Key Cardinality Matrix.

---

## 🌐 Complete Global Entity Relationship Diagram (ERD)

The following diagram maps all primary operational tables, their primary keys, foreign keys, and cardinalities:

```mermaid
erDiagram
    USERS ||--o{ PURCHASES : "creates (created_by)"
    USERS ||--o{ SALES : "creates (created_by)"
    USERS ||--o{ INVENTORY_TRANSACTIONS : "authors (created_by)"

    COSTING_METHODS ||--o| SYSTEM_SETTINGS : "active_costing_method"

    PRODUCTS ||--|{ PRODUCT_VARIANTS : "has variants"

    WAREHOUSES ||--o{ INVENTORY_TRANSACTIONS : "stores"
    WAREHOUSES ||--o{ INVENTORY_COST_LAYERS : "holds batches"
    WAREHOUSES ||--o{ INVENTORY_VALUATION : "moving avg state"

    PURCHASES ||--|{ PURCHASE_ITEMS : "contains items"
    PRODUCT_VARIANTS ||--o{ PURCHASE_ITEMS : "purchased as"

    SALES ||--|{ SALE_ITEMS : "contains items"
    PRODUCT_VARIANTS ||--o{ SALE_ITEMS : "sold as"

    PRODUCT_VARIANTS ||--o{ INVENTORY_TRANSACTIONS : "tracked in ledger"
    PRODUCT_VARIANTS ||--o{ INVENTORY_COST_LAYERS : "cost batches"
    PRODUCT_VARIANTS ||--o{ INVENTORY_VALUATION : "moving avg state"
    PRODUCT_VARIANTS ||--o{ COGS_ENTRIES : "recognized cost"

    SALE_ITEMS ||--o{ COGS_ENTRIES : "generates cost entries"

    USERS {
        char(36) id PK
        string name
        string phone UK
        string email UK
        enum role
        boolean is_active
    }

    PRODUCTS {
        char(36) id PK
        string name
        string base_unit
    }

    PRODUCT_VARIANTS {
        char(36) id PK
        char(36) product_id FK
        string color
        enum origin
        string sku UK
        decimal thickness
        string size
    }

    WAREHOUSES {
        char(36) id PK
        string name
        text location
    }

    PURCHASES {
        char(36) id PK
        string supplier_name
        string invoice_number
        decimal total_amount
        date purchase_date
        enum status
        char(36) created_by FK
    }

    PURCHASE_ITEMS {
        char(36) id PK
        char(36) purchase_id FK
        char(36) variant_id FK
        decimal quantity
        decimal unit_cost
        decimal total_cost
    }

    SALES {
        char(36) id PK
        string customer_name
        decimal total_amount
        date sale_date
        enum status
        char(36) created_by FK
    }

    SALE_ITEMS {
        char(36) id PK
        char(36) sale_id FK
        char(36) variant_id FK
        decimal quantity
        decimal selling_price
        decimal total_price
    }

    INVENTORY_TRANSACTIONS {
        char(36) id PK
        char(36) variant_id FK
        char(36) warehouse_id FK
        enum transaction_type
        decimal quantity
        decimal unit_cost
        string reference_type
        char(36) reference_id
        date transaction_date
        char(36) created_by FK
    }

    INVENTORY_COST_LAYERS {
        char(36) id PK
        char(36) variant_id FK
        char(36) warehouse_id FK
        decimal remaining_qty
        decimal unit_cost
        char(36) source_transaction_id
    }

    INVENTORY_VALUATION {
        char(36) variant_id PK,FK
        char(36) warehouse_id PK,FK
        decimal total_quantity
        decimal total_cost
        decimal avg_unit_cost
    }

    COGS_ENTRIES {
        char(36) id PK
        char(36) sale_item_id FK
        char(36) variant_id FK
        decimal quantity
        decimal unit_cost
        decimal total_cost
        enum costing_method
    }
```

---

## 🔍 Subsystem Focused Diagrams

### 1. Catalog & Variant Subsystem

The business sells aluminum profiles in specific physical finishes, origins, and sizes.

```mermaid
erDiagram
    PRODUCTS ||--|{ PRODUCT_VARIANTS : "defines variations of"

    PRODUCTS {
        char(36) id PK "Master Product ID"
        string name "Product Family Name (e.g. Series 20 Profile)"
        string base_unit "Measurement Unit (e.g. PCS, METER)"
    }

    PRODUCT_VARIANTS {
        char(36) id PK "Variant Specific UUID"
        char(36) product_id FK "Parent Product Reference"
        string color "Finish (Bronze, Silver, Black, White)"
        enum origin "LOCAL or IMPORTED"
        string sku UK "Unique Barcode/SKU"
        decimal thickness "Wall Thickness (mm)"
        string size "Length/Cut Spec (e.g. 6.0m)"
    }
```

---

### 2. Purchases & Inbound Invoicing Subsystem

Captures vendor shipments and lines.

```mermaid
erDiagram
    USERS ||--o{ PURCHASES : "created_by"
    PURCHASES ||--|{ PURCHASE_ITEMS : "has lines"
    PRODUCT_VARIANTS ||--o{ PURCHASE_ITEMS : "ordered item"

    PURCHASES {
        char(36) id PK "Purchase Invoice UUID"
        string supplier_name "Vendor Identity"
        string invoice_number "Vendor Bill #"
        decimal total_amount "Total Cost of Order"
        date purchase_date "Invoice Date"
        enum status "POSTED or VOIDED"
        char(36) created_by FK "Auditor/Admin User ID"
    }

    PURCHASE_ITEMS {
        char(36) id PK "Line Item UUID"
        char(36) purchase_id FK "Parent Purchase"
        char(36) variant_id FK "Variant Received"
        decimal quantity "Quantity Received"
        decimal unit_cost "Direct Acquisition Cost per Unit"
        decimal total_cost "Line Subtotal (qty * unit_cost)"
    }
```

---

### 3. Sales & Outbound Revenue Subsystem

Captures client orders and line items (the single source of Revenue).

```mermaid
erDiagram
    USERS ||--o{ SALES : "created_by"
    SALES ||--|{ SALE_ITEMS : "has lines"
    PRODUCT_VARIANTS ||--o{ SALE_ITEMS : "sold item"

    SALES {
        char(36) id PK "Sale Order UUID"
        string customer_name "Client Identity"
        decimal total_amount "Total Revenue Billed"
        date sale_date "Sale Transaction Date"
        enum status "POSTED or VOIDED"
        char(36) created_by FK "Sales Agent User ID"
    }

    SALE_ITEMS {
        char(36) id PK "Line Item UUID"
        char(36) sale_id FK "Parent Sale"
        char(36) variant_id FK "Variant Sold"
        decimal quantity "Quantity Sold"
        decimal selling_price "Price Charged per Unit"
        decimal total_price "Line Subtotal (qty * selling_price)"
    }
```

---

### 4. Inventory Ledger & Multi-Warehouse Subsystem

The immutable movement ledger that derives stock quantities.

```mermaid
erDiagram
    WAREHOUSES ||--o{ INVENTORY_TRANSACTIONS : "storage location"
    PRODUCT_VARIANTS ||--o{ INVENTORY_TRANSACTIONS : "moved item"
    USERS ||--o{ INVENTORY_TRANSACTIONS : "authorized by"

    INVENTORY_TRANSACTIONS {
        char(36) id PK "Movement UUID"
        char(36) variant_id FK "Variant Moved"
        char(36) warehouse_id FK "Physical Warehouse Location"
        enum transaction_type "PURCHASE | SALE | ADJUSTMENT | TRANSFER_IN | TRANSFER_OUT | SALE_RETURN | PURCHASE_RETURN"
        decimal quantity "Signed Quantity (+Inbound, -Outbound)"
        decimal unit_cost "Cost Basis for Movement"
        string reference_type "Source Model ('PURCHASE', 'SALE', etc.)"
        char(36) reference_id "Source Record UUID"
        date transaction_date "Accounting Date"
        char(36) created_by FK "Operator UUID"
    }
```

---

### 5. Costing Engines & COGS Subsystem

Handles the three financial costing methods (FIFO, LIFO, and Weighted Average).

```mermaid
erDiagram
    SALE_ITEMS ||--o{ COGS_ENTRIES : "recognized COGS per line"
    PRODUCT_VARIANTS ||--o{ COGS_ENTRIES : "cost recognized for"
    PRODUCT_VARIANTS ||--o{ INVENTORY_COST_LAYERS : "FIFO/LIFO layers"
    WAREHOUSES ||--o{ INVENTORY_COST_LAYERS : "warehouse layers"
    PRODUCT_VARIANTS ||--o{ INVENTORY_VALUATION : "Weighted Avg state"
    WAREHOUSES ||--o{ INVENTORY_VALUATION : "warehouse state"
    COSTING_METHODS ||--o| SYSTEM_SETTINGS : "active setting"

    INVENTORY_COST_LAYERS {
        char(36) id PK "Cost Layer UUID"
        char(36) variant_id FK "Variant"
        char(36) warehouse_id FK "Warehouse"
        decimal remaining_qty "Unconsumed Units in Batch"
        decimal unit_cost "Original Batch Unit Cost"
        char(36) source_transaction_id "Originating Purchase Movement"
        timestamp created_at "Inception Time (determines FIFO/LIFO)"
    }

    INVENTORY_VALUATION {
        char(36) variant_id PK,FK "Variant"
        char(36) warehouse_id PK,FK "Warehouse"
        decimal total_quantity "Live Aggregate Quantity"
        decimal total_cost "Live Aggregate Cost Pool"
        decimal avg_unit_cost "Moving Unit Cost (total_cost / total_qty)"
    }

    COGS_ENTRIES {
        char(36) id PK "COGS Record UUID"
        char(36) sale_item_id FK "Parent Sale Item"
        char(36) variant_id FK "Variant"
        decimal quantity "Portion of sale line fulfilled"
        decimal unit_cost "Cost per unit applied"
        decimal total_cost "Total Cost (quantity * unit_cost)"
        enum costing_method "Method Used (FIFO | LIFO | WEIGHTED_AVERAGE)"
        char(36) source_layer_id "Consumed Layer ID (NULL for Weighted Avg)"
    }
```

---

## 📊 Foreign Key Cardinality & Integrity Matrix

| Parent Table | Parent Key | Child Table | Foreign Key | Cardinality | Business Meaning & Rules |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `products` | `id` | `product_variants` | `product_id` | `1 : N` | A product can have multiple variants (colors, thicknesses). |
| `users` | `id` | `purchases` | `created_by` | `1 : N` | Every purchase records the operator who created it. |
| `purchases` | `id` | `purchase_items` | `purchase_id` | `1 : N` | A purchase order contains one or more line items. |
| `product_variants` | `id` | `purchase_items` | `variant_id` | `1 : N` | A purchase item specifies exactly one variant. |
| `users` | `id` | `sales` | `created_by` | `1 : N` | Every sale records the salesperson who generated it. |
| `sales` | `id` | `sale_items` | `sale_id` | `1 : N` | A sales invoice contains one or more line items. |
| `product_variants` | `id` | `sale_items` | `variant_id` | `1 : N` | A sale item specifies exactly one variant. |
| `product_variants` | `id` | `inventory_transactions` | `variant_id` | `1 : N` | Ledger tracks stock delta per variant. |
| `warehouses` | `id` | `inventory_transactions` | `warehouse_id` | `1 : N` | Ledger tracks stock delta per warehouse. |
| `users` | `id` | `inventory_transactions` | `created_by` | `1 : N` | Ledger records who authorized each stock move. |
| `product_variants` | `id` | `inventory_cost_layers` | `variant_id` | `1 : N` | FIFO/LIFO batches per variant. |
| `warehouses` | `id` | `inventory_cost_layers` | `warehouse_id` | `1 : N` | FIFO/LIFO batches are segregated by warehouse. |
| `product_variants` | `id` | `inventory_valuation` | `variant_id` | `1 : N` | Weighted Average composite primary key component. |
| `warehouses` | `id` | `inventory_valuation` | `warehouse_id` | `1 : N` | Weighted Average composite primary key component. |
| `sale_items` | `id` | `cogs_entries` | `sale_item_id` | `1 : N` | A sale item can consume multiple cost layers (e.g. 5 from layer A, 5 from layer B). |
| `product_variants` | `id` | `cogs_entries` | `variant_id` | `1 : N` | Cost snapshot records the affected variant. |
| `costing_methods` | `id` | `system_settings` | `active_costing_method` | `1 : 1` | System setting references the active costing engine. |
