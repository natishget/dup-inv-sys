# 🏭 Catalog & Inventory Screens

## 📌 Overview

This document covers the UI components for managing physical storage facilities and product catalog specifications:
1. **Products & Variants Screen (`resources/js/pages/products/index.tsx`)**
2. **Bulk Products Import Screen (`resources/js/pages/products/import.tsx`)**
3. **Warehouses & Live Stock Screen (`resources/js/pages/warehouses/index.tsx`)**

---

## 🏷️ 1. Products & Variants Catalog (`products/index.tsx`)

In industrial aluminum trading, products are structured hierarchically: a **Master Product Family** (e.g. "Series 20 Profile") branches into **Physical Variants** defined by Finish Color, Origin, Wall Thickness, and Profile Length.

### Interface Layout:
```
+-----------------------------------------------------------------------------------------+
| [Header] Product Catalog        [Origin: All ▼] [Color: All ▼] [+ Variant] [+ Product]  |
+-----------------------------------------------------------------------------------------+
| Search SKU or Product Name...                                                           |
+-----------------------------------------------------------------------------------------+
| Product Family         SKU              Finish    Origin     Thickness   Size     Unit  |
| Profile Series 20      ALU-20-BRZ-IMP   Bronze    IMPORTED   1.40 mm     6.0m     METER |
| Profile Series 20      ALU-20-SLV-LOC   Silver    LOCAL      1.20 mm     5.8m     METER |
| Square Tube 40x40      TUB-40-BLK-LOC   Black     LOCAL      2.00 mm     6.0m     PCS   |
|                                                       [Actions: Edit | Delete Product]  |
+-----------------------------------------------------------------------------------------+
```

### Interactive Modals:
1. **Create Master Product Modal:**
   - Input: Product Name (e.g. `"Curtain Wall 50"`) and Base Unit (e.g. `"METER"`).
   - Enforces unique product family names.
2. **Create Variant Modal:**
   - Master Product selection dropdown.
   - Finish Color text input (`Bronze`, `Silver`, `Black`, `White`, etc.).
   - Origin radio group: `LOCAL` or `IMPORTED`.
   - SKU barcode string input (must be unique).
   - Thickness decimal input (millimeter precision).
   - Profile dimension string (e.g. `"6.0m"`).
3. **Delete Safeguard:**  
   If an administrator clicks Delete on a master product that has active variants, the interface displays an error: *"Delete the related variants first before removing this product."*

---

## 📥 2. Bulk Product Import Screen (`products/import.tsx`)

Designed for catalog setup and mass price list onboarding.

### Functional Workflow:
1. **Textarea JSON Input:** Accepts an array of up to 250 product objects:
   ```json
   [
     { "name": "Curtain Wall Transom", "unit": "METER" },
     { "name": "Sliding Door Outer Frame", "unit": "PCS" }
   ]
   ```
2. **Client-Side Syntax Pre-check:** Validates valid JSON syntax before network transmission.
3. **Atomic Backend Ingestion:**
   - Pre-checks for duplicate names in the database.
   - Executes bulk insertion inside a database transaction with UUID generation.

---

## 🏪 3. Warehouses & Live Stock Screen (`warehouses/index.tsx`)

Provides real-time warehouse location management and on-demand inventory ledger lookups.

### Asynchronous REST Architecture:
Unlike typical Inertia page reloads, this screen operates as an asynchronous client using `fetch()` and `/api/warehouses` JSON endpoints:
- **CSRF Header Ingestion:** Extracts the token dynamically via `csrfToken() = meta[name="csrf-token"]`.
- **Automatic Background Synchronization:** Refreshes depot lists and stock tables without full page reloads.

### Interactive Components:

#### 1. Warehouse Grid / Cards:
Displays warehouse facilities with physical depot addresses.
- **Role Actions:** `ADMIN` users can Create, Edit, and Delete depots. `SALES` and `AUDITOR` users can view depots and check stock.

#### 2. Live Warehouse Stock Drawer (`WarehouseStockRecord`):
Clicking **"View Stock"** on any warehouse opens a slide-over modal that calls:
```http
GET /api/warehouses/{id}/stock
```
The server aggregates `inventory_transactions` in real time, displaying:
- Product Family Name
- Color & Origin badges
- **Available Physical Quantity:** Computed dynamically via SQL `SUM(quantity) HAVING total_stock != 0`.

#### 3. Deletion Barrier:
If an administrator attempts to delete a warehouse that has historical inventory transactions, the dialog catches the `422` error and alerts: *"This warehouse cannot be deleted because it has inventory transactions."*
