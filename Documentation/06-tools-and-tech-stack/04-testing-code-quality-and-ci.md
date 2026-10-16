# 🧪 Testing, Code Quality & CI Standards

## 📌 Overview

To safeguard financial precision and prevent regressions in inventory valuation, every operational workflow is programmatically tested using the **Pest PHP 3** testing framework.

Code quality, formatting, and static analysis are enforced by **Laravel Pint**, **ESLint 9**, and **Prettier**.

---

## 🔬 1. Automated Testing with Pest 3

The project utilizes **Pest PHP 3** (`pestphp/pest`) with the first-party Laravel plugin (`pestphp/pest-plugin-laravel`).

### Running the Test Suite:
```bash
# Run all tests with compact output
php artisan test --compact

# Run a specific feature test file
php artisan test tests/Feature/PurchaseAndSalesTest.php

# Filter by a specific test name
php artisan test --filter=test_sales_depletes_cost_layers_using_fifo
```

---

## 📑 Feature Test Suite Coverage

| Test File | Test Suite Focus | Key Assertions Covered |
| :--- | :--- | :--- |
| **`PurchaseAndSalesTest.php`** | Purchasing & Sales | Inbound PO creation, outbound sales, concurrency locks, voiding transactions, and partial returns. |
| **`CogsManagementTest.php`** | Costing Engines | Mathematical correctness of FIFO, LIFO, and Weighted Average layer consumption and dynamic report simulation. |
| **`CogsCsvExportTest.php`** | CSV Streaming | Verifies chunked HTTP stream headers (`text/csv`) and spreadsheet row contents. |
| **`WarehouseManagementTest.php`** | Warehouses & Stock | Warehouse CRUD, transaction-presence deletion barriers, and live ledger stock queries. |
| **`ProductManagementTest.php`** | Products & Variants | Variant SKU generation, variant-presence deletion barriers, and bulk JSON import validation. |
| **`RoleAccessControlTest.php`** | RBAC Security | Verifies HTTP `403 Forbidden` responses when unauthorized roles access protected routes. |
| **`UserManagementTest.php`** | User Administration | Credential provisioning, self-deletion prevention, and last-admin preservation. |
| **`DashboardTest.php`** | Financial Analytics | Fiscal year date bounds (July 1 to June 30) and 5-minute cache hit/miss behavior. |

---

## 🎨 2. Code Quality & Formatting Tooling

### A. PHP Code Formatter: Laravel Pint
The repository uses **Laravel Pint** (an opinionated PHP code style fixer built on PHP-CS-Fixer):
- **Command:**
  ```bash
  vendor/bin/pint --format agent
  ```
- **Rule:** Whenever any PHP file is created or modified, Pint must be executed to ensure clean PSR-12 and Laravel Boost formatting conventions (curly braces, strict types, constructor property promotion).

---

### B. Frontend Code Quality: ESLint 9 & Prettier
The frontend toolchain enforces clean React 19 / TypeScript formatting and automated Tailwind class sorting:

| Tool | Script | Command | Configuration |
| :--- | :--- | :--- | :--- |
| **ESLint 9** | `lint` | `npm run lint` | `eslint.config.js` with TypeScript & React hooks plugins. |
| **Prettier** | `format` | `npm run format` | `.prettierrc` with `prettier-plugin-tailwindcss` & `organize-imports`. |
| **Prettier Check** | `format:check` | `npm run format:check`| CI verification script checking for unformatted files. |

---

## 🔒 3. Engineering Guidelines for Future Development

1. **Test-First Verification:**  
   Every business logic change or bug fix must be covered by an automated Pest test. Run `php artisan test --compact` to verify zero regression.
2. **Never Hard Delete Records:**  
   Always implement safe corrections through status flags (`POSTED` vs `VOIDED`) and reversal movements (`SALE_RETURN`, `PURCHASE_RETURN`) in `inventory_transactions`.
3. **Database Integrity:**  
   Always execute multi-table mutations inside `DB::transaction()` blocks. Use `lockForUpdate()` when reading available cost layers or stock pools.
