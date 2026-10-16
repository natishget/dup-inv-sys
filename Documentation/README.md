# 📚 Stock & Inventory Management System — Master Documentation

Welcome to the comprehensive documentation suite for the **Stock & Financial Management System** (Aluminum Trading Inventory & COGS Platform).

---

## 🗂️ Documentation Structure

This documentation is organized into modular sections covering every layer of the system:

| Folder / Section | Status | Description |
| :--- | :--- | :--- |
| [**`01-database-structure/`**](./01-database-structure/) | **Complete** | Full schema design, table definitions, data dictionary, ERDs, ledger mechanics, and indexing. |
| [**`02-backend-architecture/`**](./02-backend-architecture/) | **Complete** | Service layer engines, controllers, request lifecycle, RBAC middleware, and form requests. |
| [**`03-business-features-and-logic/`**](./03-business-features-and-logic/) | **Complete** | Inbound purchasing, outbound billing, costing engines, audit/returns, and financial analytics. |
| [**`04-api-reference/`**](./04-api-reference/) | **Complete** | REST specifications, request payloads, response schemas, status codes, and permissions. |
| [**`05-pages-and-ui-components/`**](./05-pages-and-ui-components/) | **Complete** | React/Inertia pages, components, layout hierarchy, state management, and user interactions. |
| [**`06-tools-and-tech-stack/`**](./06-tools-and-tech-stack/) | **Complete** | Frameworks, database tools, build systems, styling tokens, and dev tooling. |

---

## 🌟 Essential Master Guides

For immediate high-level functional scoping and deep financial valuation mechanics, refer to these two dedicated master guides:

* 📋 [**System Functional Requirements Specification (FRS)**](./00-functional-requirements-specification.md)  
  *Exhaustive blueprint detailing business profiles, three-tier RBAC permissions, functional requirements across all 7 subsystems, ACID transaction rules, and non-functional requirements.*

* 📐 [**Comprehensive Guide to Inventory Valuation (FIFO, LIFO & Weighted Average)**](./INVENTORY-VALUATION-FIFO-LIFO-WEIGHTED-AVERAGE.md)  
  *In-depth accounting theory, mathematical equations, layer depletion mechanics, a 5-step head-to-head trading scenario, SQL queries, and PHP implementation code.*

---

## 🧭 Section 01 — Database Structure

The complete database layer documentation is available under [**`Documentation/01-database-structure/`**](./01-database-structure/):

1. [**01. Database Overview & Core Design Principles**](./01-database-structure/01-database-overview-and-design-principles.md)  
   *Ledger-based architecture, zero-stock-column rule, UUID strategy, precision standards, and immutable COGS snapshots.*

2. [**02. Complete Data Dictionary (All Tables & Fields)**](./01-database-structure/02-complete-data-dictionary.md)  
   *Exhaustive column-by-column breakdown of all 18 tables: datatypes, nullability, defaults, keys, and business meaning.*

3. [**03. Entity Relationship & Schema Diagrams**](./01-database-structure/03-entity-relationship-and-schema-diagrams.md)  
   *Mermaid visual diagrams mapping the entire relational schema and domain-specific subgraphs.*

4. [**04. Inventory Ledger & Costing Mechanics**](./01-database-structure/04-inventory-ledger-and-costing-mechanics.md)  
   *How stock quantities, cost layers (FIFO/LIFO), weighted average valuation, and COGS entries operate in SQL.*

5. [**05. Audit Trail & Safe Correction Schema**](./01-database-structure/05-audit-trail-and-safe-correction-schema.md)  
   *Safe non-destructive corrections, voiding, returns, parent-child references, and query performance indexes.*

---

## 🧭 Section 02 — Backend Architecture

The complete backend architecture documentation is available under [**`Documentation/02-backend-architecture/`**](./02-backend-architecture/):

1. [**01. Service Layer & Business Engines**](./02-backend-architecture/01-service-layer-and-business-engines.md)  
   *Deep implementation traces for PurchaseService, SalesService, CostingService (FIFO/LIFO/Weighted Average), and CorrectionService.*

2. [**02. Controllers & Request Lifecycle**](./02-backend-architecture/02-controllers-and-request-lifecycle.md)  
   *Controller orchestration, 5-minute caching on financial dashboards, stock lookups, CSV streaming, and Inertia response contracts.*

3. [**03. Middleware, Authentication & RBAC**](./02-backend-architecture/03-middleware-authentication-and-rbac.md)  
   *Three-tier RBAC (`ADMIN`, `SALES`, `AUDITOR`), route guards (`admin`, `role:...`), and Inertia shared user state.*

4. [**04. Form Requests & Validation Rules**](./02-backend-architecture/04-form-requests-and-validation-rules.md)  
   *Typed Data Transfer Objects (DTOs), nested array validation (`items.*.quantity`), deep JSON import parsing, and numeric guards.*

---

## 🧭 Section 03 — Business Features & Logic

The complete business logic documentation is available under [**`Documentation/03-business-features-and-logic/`**](./03-business-features-and-logic/):

1. [**01. Purchasing & Inbound Stock Workflow**](./03-business-features-and-logic/01-purchasing-and-inbound-workflow.md)  
   *Inbound PO lifecycle, inventory transactions (`+qty`), layer creation, moving average pool increment, and numerical walkthroughs.*

2. [**02. Sales & Outbound Billing Workflow**](./03-business-features-and-logic/02-sales-and-outbound-billing-workflow.md)  
   *Outbound sales lifecycle, pre-checkout stock guards, concurrency row locks, ledger transactions (`-qty`), and COGS realization.*

3. [**03. Costing Engine & Valuation Methods**](./03-business-features-and-logic/03-costing-engine-and-valuation-methods.md)  
   *Step-by-step comparative mathematical simulation comparing FIFO, LIFO, and Weighted Average on the exact same orders.*

4. [**04. Audit, Voiding & Returns Workflow**](./03-business-features-and-logic/04-audit-voiding-and-returns-workflow.md)  
   *Safe correction architecture: voiding sales/purchases, partial customer/vendor returns, and non-destructive reversal ledger signage.*

5. [**05. Executive Analytics & Financial Reporting**](./03-business-features-and-logic/05-executive-analytics-and-financial-reporting.md)  
   *Corporate fiscal year (July 1 to June 30), 5-minute cached aggregations, monthly revenue/COGS slicing, and top products ranking.*

---

## 🧭 Section 04 — API Reference

The complete REST API specification is available under [**`Documentation/04-api-reference/`**](./04-api-reference/):

1. [**01. API Overview & Authentication**](./04-api-reference/01-api-overview-and-authentication.md)  
   *Session authentication, CSRF handling (`X-XSRF-TOKEN`), HTTP status codes, and standard validation error payloads.*

2. [**02. Dashboard & Analytics API**](./04-api-reference/02-dashboard-and-analytics-api.md)  
   *Specifications for `/dashboard/financials` and `/dashboard/top-products` with 5-minute cache headers and JSON schemas.*

3. [**03. Purchases & Sales API**](./04-api-reference/03-purchases-and-sales-api.md)  
   *Trading endpoint specs: creating orders, metadata patches, voiding, and returns with exact JSON payload contracts.*

4. [**04. Products & Warehouses API**](./04-api-reference/04-products-and-warehouses-api.md)  
   *Catalog specs: master products, variants, bulk JSON import schemas, warehouse CRUD, and live stock calculation endpoints.*

5. [**05. COGS & Valuation API**](./04-api-reference/05-cogs-and-valuation-api.md)  
   *COGS paginated report queries, chunked CSV streaming downloads, and User Administration provisioning endpoints.*

---

## 🧭 Section 05 — Pages & UI Components

The complete frontend UI documentation is available under [**`Documentation/05-pages-and-ui-components/`**](./05-pages-and-ui-components/):

1. [**01. Layout, Navigation & Theme**](./05-pages-and-ui-components/01-layout-navigation-and-theme.md)  
   *AppLayout tree, dynamic role-tailored sidebar links, breadcrumbs, responsive drawer behavior, and Dark Mode.*

2. [**02. Dashboard Screen**](./05-pages-and-ui-components/02-dashboard-screen.md)  
   *Financial overview cockpit, annual totals cards, dual-engine SVG line/bar charts, top products table, and memory caching.*

3. [**03. Trading Screens: Purchases & Sales**](./05-pages-and-ui-components/03-trading-screens-purchases-and-sales.md)  
   *Inbound & outbound invoice tables, real-time stock badges, dynamic item line builders, PDF exports, and void/return dialogs.*

4. [**04. Catalog & Inventory Screens**](./05-pages-and-ui-components/04-catalog-and-inventory-screens.md)  
   *Product variant tables, bulk JSON importing, physical warehouse management, and asynchronous live stock drawer.*

5. [**05. Compliance & Settings Screens**](./05-pages-and-ui-components/05-compliance-and-settings-screens.md)  
   *COGS audit with simulated costing switcher, user admin safeguards (self-deletion & last-admin), and operator settings.*

---

## 🧭 Section 06 — Tools & Tech Stack

The complete engineering and tooling stack documentation is available under [**`Documentation/06-tools-and-tech-stack/`**](./06-tools-and-tech-stack/):

1. [**01. Backend Stack & Framework**](./06-tools-and-tech-stack/01-backend-stack-and-framework.md)  
   *PHP 8.4 engine, Laravel 12 architecture, MySQL 8 / InnoDB transactional configuration, and direct composer dependencies.*

2. [**02. Frontend & UI Stack**](./06-tools-and-tech-stack/02-frontend-and-ui-stack.md)  
   *React 19, TypeScript 5.7, Inertia.js v2 client-side routing, Tailwind CSS v4 design tokens, Radix UI primitives, Lucide icons, and jsPDF.*

3. [**03. Build, Bundling & Development Pipeline**](./06-tools-and-tech-stack/03-build-bundling-and-dev-pipeline.md)  
   *Vite 6 bundling, Rollup code splitting, `composer run dev` multi-process orchestration (artisan serve, queue, vite), and production builds.*

4. [**04. Testing, Code Quality & CI**](./06-tools-and-tech-stack/04-testing-code-quality-and-ci.md)  
   *Pest 3 testing framework, SQLite in-memory suites, Laravel Pint style formatter, ESLint 9 flat config, Prettier, and CI verification workflows.*
