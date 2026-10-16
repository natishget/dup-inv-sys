# ⚙️ Backend Stack & Framework Architecture

## 📌 Technology Overview

The backend infrastructure is built on the modern **PHP 8.4** runtime and the **Laravel 12** web application framework. It is configured for strict type enforcement, high-concurrency database transactions, and an asynchronous queue pipeline.

```
+-----------------------------------------------------------------------------------+
|                               BACKEND TECHNOLOGY STACK                            |
+-----------------------------------------------------------------------------------+
|  PHP Runtime        --> PHP 8.4 (Constructor promotion, strict types, match exp) |
|  Web Framework      --> Laravel 12.x (Streamlined single-file configuration)      |
|  Database Engine    --> MySQL 8.0+ / InnoDB (Row-level locks, UUID CHAR(36) keys) |
|  SPA Adapter        --> Inertia.js v2 Laravel Core (^2.0)                         |
|  Client Routing API --> Tighten Ziggy (^2.4)                                      |
|  PDF Generation     --> Barryvdh Laravel DomPDF                                   |
+-----------------------------------------------------------------------------------+
```

---

## 🐘 1. PHP 8.4 Runtime Standards

The codebase adheres to modern PHP 8.4 design patterns:
1. **Constructor Property Promotion:**  
   Dependencies are injected and declared directly within constructor signatures:
   ```php
   public function __construct(
       private readonly CostingService $costingService,
       private readonly CorrectionService $correctionService,
   ) {}
   ```
2. **Strict Return & Parameter Type Declarations:**  
   All controller, service, and model methods enforce native PHP types and nullable types:
   ```php
   public function voidSale(string $saleId, ?string $userId, ?string $reason = null): Sale
   ```
3. **PHPDoc Array Shape Annotations:**  
   Complex array arguments and payloads are documented using typed array shapes:
   ```php
   /**
    * @param array<int, array{variant_id: string, quantity: float}> $items
    */
   ```
4. **Match Expressions:**  
   Costing and reversal strategies utilize clean, exhaustive PHP `match` structures:
   ```php
   return match ($costingMethod) {
       self::LIFO => $this->consumeLayersAndCreateEntries($saleItem, $warehouseId, $costingMethod, 'desc'),
       self::WEIGHTED_AVERAGE => $this->consumeWeightedAverage($saleItem, $warehouseId),
       default => $this->consumeLayersAndCreateEntries($saleItem, $warehouseId, $costingMethod, 'asc'),
   };
   ```

---

## 🧱 2. Laravel 12 Framework Innovations

This application uses the streamlined architecture introduced in Laravel 11 and enhanced in Laravel 12:

### A. Centralized Application Bootstrap (`bootstrap/app.php`):
- **No `app/Http/Kernel.php`:** HTTP middleware, aliases, and route files are configured declaratively in a single fluent chain:
  ```php
  return Application::configure(basePath: dirname(__DIR__))
      ->withRouting(
          web: __DIR__.'/../routes/web.php',
          api: __DIR__.'/../routes/api.php',
          commands: __DIR__.'/../routes/console.php',
          health: '/up',
      )
      ->withMiddleware(function (Middleware $middleware) {
          $middleware->alias([
              'admin' => EnsureUserIsAdmin::class,
              'role' => EnsureUserHasRoleAccess::class,
          ]);
          $middleware->web(append: [
              HandleInertiaRequests::class,
              AddLinkHeadersForPreloadedAssets::class,
          ]);
      })
      ->create();
  ```
- **Automatic Command Discovery:** Console commands in `app/Console/Commands/` and schedules in `routes/console.php` are registered automatically without a console kernel.

---

## 📦 3. Primary Composer Dependencies

| Package | Version | Architectural Role |
| :--- | :---: | :--- |
| **`laravel/framework`** | `^12.0` | Core routing, Eloquent ORM, validation, and container. |
| **`inertiajs/inertia-laravel`**| `^2.0` | Server-side adapter bridging Laravel responses to React components. |
| **`tightenco/ziggy`** | `^2.4` | Exposes named Laravel routes (`route('sales.store')`) to TypeScript. |
| **`barryvdh/laravel-dompdf`**| `*` | Server-side PDF generation engine. |
| **`laravel/tinker`** | `^2.10.1` | REPL debugging environment for command-line inspection. |

---

## 🗄️ 4. Database Engine Specifications

- **Engine:** MySQL 8.0+ or MariaDB 10.5+
- **Table Engine:** `InnoDB`
- **ACID Transactions:** Every financial mutation (`createSale`, `createPurchase`, `voidSale`, `returnSale`) is isolated in a `DB::transaction()` block.
- **Row-Level Concurrency Locking:** High-contention costing layers and valuation pools are selected using `->lockForUpdate()`, serializing competing checkout requests on identical stock variants.
- **Key Strategy:** Universal Unique Identifiers (`CHAR(36)` UUIDs) generated via Laravel's `HasUuids` trait.
