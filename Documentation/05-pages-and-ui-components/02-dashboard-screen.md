# 📊 Dashboard Screen (`dashboard.tsx`)

## 📌 Page Overview

The **Dashboard Screen** (`resources/js/pages/dashboard.tsx`) serves as the executive cockpit for the trading platform. It delivers real-time visibility into annual corporate performance, monthly revenue/COGS trends, and product sales volume.

- **Route:** `GET /dashboard`
- **Controller:** `App\Http\Controllers\DashboardController::index`
- **Inertia Props:**
  - `defaultFiscalYear` (`number`): The active fiscal year (e.g., `2026`).
  - `fiscalYears` (`number[]`): Array of available fiscal years for the selector.

---

## 🏛️ Visual Wireframe & Layout

```
+-----------------------------------------------------------------------------------------+
| [Header] Dashboard               [Fiscal Year: 2026 ▼]  [↻ Refresh]                     |
+-----------------------------------------------------------------------------------------+
| [KPI Cards]                                                                             |
| +-------------------+ +-------------------+ +-------------------+ +-------------------+ |
| | TOTAL REVENUE     | | TOTAL COGS        | | GROSS PROFIT      | | PROFIT MARGIN     | |
| | $1,450,000.00     | | $980,000.00       | | $470,000.00       | | 32.41%            | |
| +-------------------+ +-------------------+ +-------------------+ +-------------------+ |
+-----------------------------------------------------------------------------------------+
| [Monthly Financial Trends]                               [Toggle: Line Chart | Bars]    |
|   150k|      *---*                                                                      |
|   100k|    *       *---*                                                                |
|    50k|  *               *---*   ─── Revenue  - - - COGS  ···· Gross Profit             |
|       +-------------------------------------------------------------------------        |
|          Jul   Aug   Sep   Oct   Nov   Dec   Jan   Feb   Mar   Apr   May   Jun          |
+-----------------------------------------------------------------------------------------+
| [Top-Selling Products Widget] (Top 12 by units sold)                                    |
| Product Name                   Finish    Origin    Units Dispatched     Gross Revenue   |
| 1. Profile Series 20           Bronze    Imported  1,240.00 pcs         $105,400.00     |
| 2. Profile Series 20           Silver    Local       980.50 pcs         $ 78,440.00     |
| 3. Square Tube 40x40           Black     Local       620.00 pcs         $ 55,800.00     |
+-----------------------------------------------------------------------------------------+
```

---

## ⚙️ Interactive State Management

The dashboard uses a custom hook `useDashboardData(fiscalYear)` that manages concurrent asynchronous data fetching, error boundaries, and client-side memory caching:

### 1. Dual Asynchronous Fetching (`Promise.all`):
When a user switches the fiscal year dropdown, the component concurrently calls:
```typescript
const [financialsResponse, topProductsResponse] = await Promise.all([
    fetch(`/dashboard/financials?fiscal_year=${encodeURIComponent(String(fiscalYear))}`),
    fetch(`/dashboard/top-products?fiscal_year=${encodeURIComponent(String(fiscalYear))}&limit=12`),
]);
```

### 2. Client-Side Memory Caching (`Map`):
Fetched responses are stored in a client-side `requestCache = new Map<string, unknown>()`. Switching back to a previously loaded fiscal year renders **instantly (0ms)** without hitting the network.

### 3. Force Cache Invalidation:
Clicking the `Refresh` button executes:
```typescript
requestCache.clear();
setRefreshTick((current) => current + 1);
```
This clears client cache and triggers fresh fetches from the server.

---

## 📈 Data Visualizations

### 1. SVG Line Chart (`FinancialLineChart`):
- Native mathematical SVG rendering (`createLinePath()`) without bulky third-party chart dependencies.
- Renders three distinct continuous curves:
  - **Revenue Curve (Emerald/Green):** Total billed customer revenue per month.
  - **COGS Curve (Amber/Yellow):** Total acquisition cost of dispatched goods.
  - **Gross Profit Curve (Cyan/Blue):** Net trading profit.

### 2. Stacked Bar Chart (`FinancialBarChart`):
- Side-by-side monthly comparisons showing exact revenue versus recognized cost bars.

---

## 🏆 Top Products Table Component

Renders the top 12 variants sorted by total physical units sold:
- Displays commercial badge finishes: `Bronze`, `Silver`, `Black`, `White`.
- Origin badge: `LOCAL` (emerald pill) vs `IMPORTED` (indigo pill).
- Displays total fractional units sold with high decimal precision.
