# 📈 Dashboard & Analytics API Reference

## 📌 Overview

The Dashboard APIs provide aggregated business intelligence, monthly financial KPIs (Revenue, COGS, Gross Profit), and product sales volume rankings. Both endpoints are cached for **5 minutes** to ensure sub-5ms response times.

---

## 1. 💰 Get Monthly Financials

Returns annual corporate financial totals and a 12-month calendar breakdown for a specified corporate fiscal year (July 1 to June 30).

- **HTTP Method:** `GET`
- **Routes:** 
  - `/dashboard/financials`
  - `/api/dashboard/financials`
- **Required Role:** Any authenticated user (`ADMIN`, `SALES`, `AUDITOR`).
- **Cache Strategy:** Cached for 5 minutes (`dashboard.financials.{fiscal_year}`).

### Query Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `fiscal_year` | `integer` | No | Current Year | Target fiscal year (e.g. `2026`). Min: `2000`, Max: `2100`. |

### Request Example
```http
GET /dashboard/financials?fiscal_year=2026 HTTP/1.1
Host: stock.company.com
Accept: application/json
```

### Success Response (`200 OK`)
```json
{
  "fiscal_year": 2026,
  "start_date": "2026-07-01",
  "end_date": "2027-06-30",
  "months": [
    {
      "month": "2026-07",
      "label": "Jul 2026",
      "revenue": 145000.00,
      "cogs": 95000.00,
      "gross_profit": 50000.00
    },
    {
      "month": "2026-08",
      "label": "Aug 2026",
      "revenue": 162000.00,
      "cogs": 105000.00,
      "gross_profit": 57000.00
    },
    {
      "month": "2026-09",
      "label": "Sep 2026",
      "revenue": 128000.00,
      "cogs": 84000.00,
      "gross_profit": 44000.00
    }
  ],
  "totals": {
    "revenue": 435000.00,
    "cogs": 284000.00,
    "gross_profit": 151000.00
  }
}
```

---

## 2. 🏆 Get Top-Selling Products

Returns the highest-volume product variants sold during a fiscal year, ranked by total units dispatched.

- **HTTP Method:** `GET`
- **Routes:** 
  - `/dashboard/top-products`
  - `/api/dashboard/top-products`
- **Required Role:** Any authenticated user (`ADMIN`, `SALES`, `AUDITOR`).
- **Cache Strategy:** Cached for 5 minutes (`dashboard.top-products.{fiscal_year}.{limit}`).

### Query Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `fiscal_year` | `integer` | No | Current Year | Target fiscal year (e.g. `2026`). Min: `2000`, Max: `2100`. |
| `limit` | `integer` | No | `10` | Number of top variants to return. Min: `1`, Max: `15`. |

### Request Example
```http
GET /dashboard/top-products?fiscal_year=2026&limit=5 HTTP/1.1
Host: stock.company.com
Accept: application/json
```

### Success Response (`200 OK`)
```json
{
  "fiscal_year": 2026,
  "start_date": "2026-07-01",
  "end_date": "2027-06-30",
  "limit": 5,
  "data": [
    {
      "variant_id": "9bb68cf8-84cf-4d9d-83b4-5c91f9b31d42",
      "product_name": "Aluminum Profile Series 20",
      "color": "Bronze",
      "origin": "IMPORTED",
      "label": "Aluminum Profile Series 20 - Bronze - Imported",
      "total_quantity": 1240.0000,
      "revenue": 105400.00
    },
    {
      "variant_id": "9bb68cf8-858d-4cb0-a540-349f7e8b6b21",
      "product_name": "Aluminum Profile Series 20",
      "color": "Silver",
      "origin": "LOCAL",
      "label": "Aluminum Profile Series 20 - Silver - Local",
      "total_quantity": 980.5000,
      "revenue": 78440.00
    },
    {
      "variant_id": "9bb68cf8-863a-4efb-91d1-419b1b827e19",
      "product_name": "Square Tubing 40x40",
      "color": "Black",
      "origin": "LOCAL",
      "label": "Square Tubing 40x40 - Black - Local",
      "total_quantity": 620.0000,
      "revenue": 55800.00
    }
  ]
}
```
