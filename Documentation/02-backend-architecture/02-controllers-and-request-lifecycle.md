# 🎮 Controllers & Request Lifecycle

## 📌 Architectural Role of Controllers

In this application, controllers function strictly as **HTTP Orchestrators**. They adhere to the single-responsibility principle:
1. **Authorize:** Verify user permissions and roles.
2. **Validate:** Enforce type safety and constraints using dedicated Form Requests.
3. **Delegate:** Hand off financial calculations and ledger operations to the Service Layer.
4. **Respond:** Return either an **Inertia SPA Page** or a **JSON/Streamed API Response**.

```
+-----------------------------------------------------------------------------------------+
|                               CONTROLLER LIFECYCLE FLOW                                 |
+-----------------------------------------------------------------------------------------+
|  HTTP Request                                                                           |
|       │                                                                                 |
|       ▼                                                                                 |
|  [Middleware] ────────► Auth Check, Role Guards (ADMIN / SALES / AUDITOR)               |
|       │                                                                                 |
|       ▼                                                                                 |
|  [Form Request] ──────► Parameter extraction, data types, and constraint validation     |
|       │                                                                                 |
|       ▼                                                                                 |
|  [Controller] ────────► Light coordinate logic, query filtering, pagination             |
|       │                                                                                 |
|       ▼                                                                                 |
|  [Service Layer] ─────► DB::transaction, stock validation, COGS, ledger entries         |
|       │                                                                                 |
|       ▼                                                                                 |
|  [HTTP Response] ─────► Inertia::render() / JsonResponse / StreamedResponse             |
+-----------------------------------------------------------------------------------------+
```

---

## 📑 Controller Catalog & Responsibilities

| Controller | Primary Routes | Response Archetype | Key Responsibilities |
| :--- | :--- | :--- | :--- |
| [**`DashboardController`**](#1-dashboardcontroller) | `/dashboard`, `/dashboard/financials`, `/dashboard/top-products` | Inertia + JSON | Fiscal year financial summaries, monthly revenue/COGS metrics, and top-selling product widgets. |
| [**`PurchaseManagementController`**](#2-purchasemanagementcontroller) | `/purchases`, `/purchases/{id}/void`, `/purchases/{id}/returns` | Inertia + Redirect | Vendor purchase order management, supplier invoice intake, voiding, and return handling. |
| [**`SalesManagementController`**](#3-salesmanagementcontroller) | `/sales`, `/sales/{id}/void`, `/sales/{id}/returns` | Inertia + Redirect | Customer sale order billing, stock validation before checkout, voiding, and return processing. |
| [**`CogsController`**](#4-cogscontroller) | `/cogs`, `/cogs/report`, `/cogs/export-csv` | Inertia + JSON + Stream | Active costing vs dynamic timeline reporting, date range analysis, and chunked CSV streaming. |
| [**`WarehouseController`**](#5-warehousecontroller) | `/api/warehouses`, `/api/warehouses/{id}/stock` | Pure JSON API | Warehouse CRUD, stock-presence deletion barriers, and live warehouse inventory calculations. |
| [**`ProductManagementController`**](#6-productmanagementcontroller) | `/products`, `/products/import`, `/products/variants` | Inertia + Redirect | Product master catalog, variant SKU generation, bulk JSON importing, and cascade safeguards. |
| [**`UserManagementController`**](#7-usermanagementcontroller) | `/users` | Inertia + Redirect | Role assignment (`ADMIN`, `SALES`, `AUDITOR`), credential provisioning, and self-delete barriers. |

---

## 1. `DashboardController`

Handles the executive analytics and high-performance financial dashboards.

### Methods & Lifecycle:

#### `index(Request $request): Response`
- **Route:** `GET /dashboard`
- **Behavior:** Calculates the active corporate fiscal year (configured as July 1st to June 30th) and provides available year options for the frontend selector.
- **Inertia Page:** Renders `dashboard` with `defaultFiscalYear` and `fiscalYears`.

#### `financials(Request $request): JsonResponse`
- **Route:** `GET /dashboard/financials`
- **Query Params:** `fiscal_year` (integer, e.g., 2026).
- **5-Minute Cache Strategy:** Query results are cached under key `dashboard.financials.{fiscal_year}` using `Cache::remember(..., now()->addMinutes(5), ...)` to protect the database from heavy reporting aggregations.
- **Aggregation Pipeline:**
  1. Queries all `sales` where `status = 'POSTED'` within the fiscal year range.
  2. Joins `sale_items` for revenue and `cogs_entries` for cost of goods sold.
  3. Iterates over every calendar month in the fiscal range, computing:
     - `revenue`: Monthly gross sales
     - `cogs`: Monthly recognized costs
     - `gross_profit`: `revenue - cogs`
  4. Returns annual totals and monthly breakdowns.

#### `topProducts(Request $request): JsonResponse`
- **Route:** `GET /dashboard/top-products`
- **Query Params:** `fiscal_year`, `limit` (default: 10, max: 15).
- **Behavior:** Cached for 5 minutes under `dashboard.top-products.{year}.{limit}`. Returns the highest-selling product variants ranked by total quantity sold.

---

## 2. `PurchaseManagementController`

Coordinates supplier purchasing and inbound freight.

### Methods & Lifecycle:

#### `index(Request $request): Response`
- **Route:** `GET /purchases`
- **Filters Supported:** `search` (supplier name), `status` (`POSTED` / `VOIDED`), `date` (specific day), `date_order` (`asc` / `desc`).
- **Pagination:** 10 records per page, preserving query strings (`withQueryString()`).
- **Inertia Props:** Passes paginated purchases, active filters, available `variantOptions`, and `warehouses`.

#### `store(StorePurchaseRequest $request): RedirectResponse`
- **Route:** `POST /purchases`
- **Access Guard:** Restricts to `ADMIN` and `SALES` roles.
- **Action:** Calls `$purchaseService->createPurchase($request->validated(), $request->user())`.
- **Response:** `back()->with('success', 'Purchase created successfully.')`.

#### `update(UpdatePurchaseRequest $request, Purchase $purchase): RedirectResponse`
- **Route:** `PUT /purchases/{purchase}`
- **Action:** Calls `$purchaseService->updateMetadata($purchase, $request->validated())` to safely update supplier remarks without modifying financial totals.

#### `void(VoidTransactionRequest $request, Purchase $purchase): RedirectResponse`
- **Route:** `POST /purchases/{purchase}/void`
- **Action:** Calls `$correctionService->voidPurchase(...)` to invalidate the invoice, restore cost layers, and write compensating `PURCHASE_RETURN` inventory ledger movements.

#### `returnItems(CreatePurchaseReturnRequest $request, Purchase $purchase): RedirectResponse`
- **Route:** `POST /purchases/{purchase}/returns`
- **Action:** Calls `$correctionService->returnPurchase(...)` to record partial defect returns to the vendor.

---

## 3. `SalesManagementController`

Coordinates customer checkout, billing, and outbound shipping.

### Methods & Lifecycle:

#### `index(Request $request): Response`
- **Route:** `GET /sales`
- **Stock Pre-computation:** Computes live available quantities for every variant across all warehouses via:
  ```php
  InventoryCostLayer::selectRaw("CONCAT(warehouse_id, ':', variant_id) as warehouse_variant_key")
      ->selectRaw('COALESCE(SUM(remaining_qty), 0) as available_qty')
      ->groupBy('warehouse_id', 'variant_id');
  ```
  This map is passed directly to the React frontend to prevent sales operators from selecting out-of-stock items.

#### `store(StoreSaleRequest $request): RedirectResponse`
- **Route:** `POST /sales`
- **Action:** Calls `$salesService->createSale($request->validated(), $request->user())`.
- **Concurrency & Validation:** Throws validation exceptions if physical stock was depleted by a concurrent transaction.

#### `void(VoidTransactionRequest $request, Sale $sale): RedirectResponse`
- **Route:** `POST /sales/{sale}/void`
- **Action:** Calls `$correctionService->voidSale(...)` to mark the sale `VOIDED`, return stock to the warehouse, and reverse COGS entries.

#### `returnItems(CreateSaleReturnRequest $request, Sale $sale): RedirectResponse`
- **Route:** `POST /sales/{sale}/returns`
- **Action:** Calls `$correctionService->returnSale(...)` to record partial customer returns, adjust revenue, and restore stock.

---

## 4. `CogsController`

Controls the COGS reporting page, algorithm switching, and data export.

### Methods & Lifecycle:

#### `index(Request $request): Response`
- **Route:** `GET /cogs`
- **Inertia Page:** Renders `cogs/index` with the active system costing method (`FIFO`, `LIFO`, or `WEIGHTED_AVERAGE`) and default date ranges based on the most recent sale date in the database.

#### `report(Request $request): JsonResponse`
- **Route:** `GET /cogs/report` or `GET /api/cogs`
- **Query Params:** `start_date`, `end_date`, `costing_method`, `page`, `per_page`.
- **Action:** Calls `$costingService->report(...)`:
  - If requested method equals the active system method: uses stored `cogs_entries` table.
  - If requested method differs: executes the dynamic timeline simulation without modifying stored data.

#### `exportCsv(Request $request): StreamedResponse`
- **Route:** `GET /cogs/export-csv`
- **Mechanism:** Streams CSV lines directly to the HTTP output stream using `ResponseFactory::streamDownload()` with chunked buffer flushing (`fputcsv`). Memory consumption remains constant (`O(1)`), regardless of whether 100 or 100,000 rows are exported.

---

## 5. `WarehouseController`

Provides pure JSON API endpoints for physical warehouse depot management.

### Methods & Lifecyle:

#### `stock(Warehouse $warehouse): JsonResponse`
- **Route:** `GET /api/warehouses/{warehouse}/stock`
- **Ledger Calculation:** Aggregates live stock directly from the immutable transaction ledger:
  ```sql
  SELECT pv.id AS variant_id, p.name AS product_name, pv.color, pv.origin, SUM(it.quantity) AS total_stock
  FROM inventory_transactions it
  JOIN product_variants pv ON pv.id = it.variant_id
  JOIN products p ON p.id = pv.product_id
  WHERE it.warehouse_id = ?
  GROUP BY pv.id, p.name, pv.color, pv.origin
  HAVING total_stock != 0;
  ```

#### `destroy(Warehouse $warehouse): JsonResponse`
- **Deletion Barrier:** Validates if `$warehouse->inventoryTransactions()->exists()`. If any historical transaction references this warehouse, deletion is blocked with a 422 ValidationException to preserve ledger integrity.

---

## 6. `ProductManagementController`

Coordinates master products, variants, and bulk imports.

### Methods & Lifecycle:

#### `storeImport(StoreProductImportRequest $request): RedirectResponse`
- **Route:** `POST /products/import`
- **Bulk Payload Handling:** Validates a JSON array of products.
- **Duplicate Prevention:** Pre-checks if any product name already exists in the database. If any match is found, the entire batch is rejected before touching the database.
- **Atomic Insertion:** Executes within `DB::transaction()` using bulk `insert()`.

#### `destroy(Product $product): RedirectResponse`
- **Integrity Barrier:** Blocks deletion if `$product->variants()->exists()`. Users must delete or reassign variants first.

---

## 7. `UserManagementController`

Handles operator accounts and access credentials.

### Safety Guards:
1. **Self-Deletion Guard:** Throws validation error if an operator attempts to delete their own logged-in account (`$request->user()->is($user)`).
2. **Last-Admin Guard:** Blocks deletion if the target user is an `ADMIN` and fewer than 2 active admin accounts exist in the database.
3. **Password Provisioning:** New users are automatically initialized with a secure default password hashed via `Hash::make()`.
