# 🛒 Trading Screens: Purchases & Sales

## 📌 Overview

The trading screens represent the operational frontline of the system:
1. **Purchases Screen (`resources/js/pages/purchases/index.tsx`):** Inbound supplier invoices, receipts, and returns.
2. **Sales Screen (`resources/js/pages/sales/index.tsx`):** Outbound customer orders, live warehouse stock reservation, PDF invoice generation, and returns.

Both screens feature dynamic multi-line item builders, live running totals, status indicators (`POSTED` vs `VOIDED`), expandable line item drawers, and role-based action controls.

---

## 🏛️ Purchases Screen Architecture (`purchases/index.tsx`)

### Layout & Filter Bar
```
+-----------------------------------------------------------------------------------------+
| [Header] Purchases             [Filter: Status ▼] [Date Picker] [Sort ▼]  [+ Record PO] |
+-----------------------------------------------------------------------------------------+
| Search Supplier / Bill #...                                                             |
+-----------------------------------------------------------------------------------------+
| Supplier Name       Invoice #      Date        Warehouse   Items    Total       Status  |
| Gulf Extrusions     INV-2026-9041  2026-04-28  Main Depot    2      $5,000.00   POSTED  |
|   └─ [Expand Items] 100x Profile Series 20 ($50/ea) | 50x Tube 40x40 ($75/ea)          |
|                                                     [Actions: Edit | Void | Return]     |
+-----------------------------------------------------------------------------------------+
```

### Key Interactive Modals & Drawers:
1. **Create Purchase Dialog (`isCreateDialogOpen`):**
   - Supplier name and invoice bill number fields.
   - Warehouse selector.
   - Dynamic item list: Add row (`+ Add Item`), Variant select, Quantity, Unit Cost. Automatically computes line totals and running invoice grand total.
2. **Edit Metadata Dialog (`editingPurchase`):**
   - Enforces financial immutability by restricting edits strictly to `supplier_name` and `notes`.
3. **Void Purchase Dialog:**
   - Warns the operator that voiding will reverse inventory ledger movements and remove unconsumed cost layers. Requires an audit reason.
4. **Purchase Return Dialog (`returningPurchase`):**
   - Allows selecting specific variants and entering quantities being returned to the vendor.

---

## 🛒 Sales Screen Architecture (`sales/index.tsx`)

### Live Stock Verification & Variant Badges
Unlike purchases, sales checkout requires **physical stock verification**:
- Receives `availableQuantities: Record<string, string>` computed from `inventory_cost_layers`.
- As the sales operator selects a warehouse and variant, the modal displays a real-time availability badge:
  - If available: `"In Stock: 60.00 pcs"` (emerald badge).
  - If empty: `"Out of Stock"` (red destructive badge), disabling checkout.

### Client-Side PDF Invoice Generation (`downloadSalesDocumentPdf`)
Sales records feature direct client-side PDF export powered by `@/lib/sales-pdf`:
- Generates a branded corporate commercial invoice.
- Includes customer details, invoice date, line item breakdown (product name, finish color, origin, cut length, quantity, unit price, line subtotal), and grand total.

---

## 👥 Role-Based Action Visibility

The action buttons are conditionally rendered based on the operator's role:

```typescript
const { auth } = usePage<SharedData>().props;
const canManageSales = auth.user.role !== 'AUDITOR';
```

| User Role | View Invoices | Create Order | Edit Metadata | Void Order | Return Items | PDF Download |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`ADMIN`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`SALES`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`AUDITOR`**| ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |

Auditors have complete transparency into historical transactions and line items but are visually and functionally restricted from initiating mutations.
