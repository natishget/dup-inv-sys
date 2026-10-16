# 📊 COGS, Valuation & User Administration API Reference

## 📌 Overview

This document specifies the reporting endpoints for **Cost of Goods Sold (COGS)** and **User Administration**.

---

## 📈 1. COGS & Valuation Endpoints

### A. Generate COGS Report
Calculates Revenue, COGS, Gross Profit, and Margins per variant across a date range. Supports switching between active and simulated costing methods.

- **HTTP Method:** `GET`
- **Routes:** 
  - `/cogs/report`
  - `/api/cogs`
- **Required Role:** `ADMIN`, `AUDITOR` (`middleware('role:ADMIN,AUDITOR')`)

#### Query Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `start_date` | `date` | **Yes** | — | Beginning of reporting window (`YYYY-MM-DD`). |
| `end_date` | `date` | **Yes** | — | End of reporting window (`after_or_equal:start_date`). |
| `costing_method`| `string` | No | Active Method | Calculation model: `FIFO`, `LIFO`, or `WEIGHTED_AVERAGE`. |
| `page` | `integer`| No | `1` | Pagination page number. |
| `per_page` | `integer`| No | `10` | Records per page (Max: `100`). |

#### Request Example
```http
GET /cogs/report?start_date=2026-01-01&end_date=2026-04-30&costing_method=FIFO&page=1&per_page=10 HTTP/1.1
Host: stock.company.com
Accept: application/json
```

#### Success Response (`200 OK` - Paginated Collection)
```json
{
  "current_page": 1,
  "data": [
    {
      "variant_id": "9bb68cf8-858d-4cb0-a540-349f7e8b6b21",
      "product_name": "Aluminum Profile Series 20",
      "color": "Bronze",
      "origin": "IMPORTED",
      "quantity_sold": 450.0000,
      "revenue": 38250.00,
      "cogs": 22500.00,
      "gross_profit": 15750.00,
      "profit_margin": 41.18
    },
    {
      "variant_id": "9bb68cf8-863a-4efb-91d1-419b1b827e19",
      "product_name": "Square Tubing 40x40",
      "color": "Silver",
      "origin": "LOCAL",
      "quantity_sold": 300.0000,
      "revenue": 27000.00,
      "cogs": 18000.00,
      "gross_profit": 9000.00,
      "profit_margin": 33.33
    }
  ],
  "first_page_url": "http://stock.company.com/cogs/report?page=1",
  "from": 1,
  "last_page": 1,
  "last_page_url": "http://stock.company.com/cogs/report?page=1",
  "next_page_url": null,
  "path": "http://stock.company.com/cogs/report",
  "per_page": 10,
  "prev_page_url": null,
  "to": 2,
  "total": 2
}
```

---

### B. Export COGS CSV Stream
Streams a high-capacity CSV spreadsheet download for the requested date window and costing algorithm.

- **HTTP Method:** `GET`
- **Route:** `/cogs/export-csv`
- **Required Role:** `ADMIN`, `AUDITOR`

#### Query Parameters: Same as report (`start_date`, `end_date`, `costing_method`).

#### Response Headers:
```http
HTTP/1.1 200 OK
Content-Type: text/csv; charset=UTF-8
Content-Disposition: attachment; filename="cogs-FIFO-2026-01-01-2026-04-30.csv"
Transfer-Encoding: chunked
```

#### CSV Output Format:
```csv
Product Name,Color,Origin,Quantity Sold,Revenue,COGS,Gross Profit,Profit Margin %
"Aluminum Profile Series 20","Bronze","IMPORTED",450,38250.00,22500.00,15750.00,41.18
"Square Tubing 40x40","Silver","LOCAL",300,27000.00,18000.00,9000.00,33.33
```

---

## 👤 2. User Administration Endpoints

All user management endpoints are restricted exclusively to `ADMIN` users (`middleware('admin')`).

### A. Create User
Provisions a new system user with an assigned role and default password (`System@Pass`).

- **HTTP Method:** `POST`
- **Route:** `/users`
- **Required Role:** `ADMIN`
- **Form Request:** `App\Http\Requests\User\StoreUserRequest`

#### Request Body
```json
{
  "name": "Sarah Connor",
  "email": "sarah@company.com",
  "phone": "+251911223344",
  "role": "SALES"
}
```

---

### B. Update User
Modifies user profile details or role assignments.

- **HTTP Method:** `PUT`
- **Route:** `/users/{user}`
- **Required Role:** `ADMIN`
- **Form Request:** `App\Http\Requests\User\UpdateUserRequest`

#### Request Body
```json
{
  "name": "Sarah Connor",
  "email": "sarah.connor@company.com",
  "phone": "+251911223344",
  "role": "AUDITOR"
}
```

---

### C. Delete User
- **HTTP Method:** `DELETE`
- **Route:** `/users/{user}`
- **Required Role:** `ADMIN`

#### Safety Rules Enforced:
1. **Self-Deletion Guard:** Throws HTTP `422` if an administrator attempts to delete their own active session:
   ```json
   {
     "message": "You cannot delete your own account from this page.",
     "errors": { "user": ["You cannot delete your own account from this page."] }
   }
   ```
2. **Last-Admin Guard:** Throws HTTP `422` if removing the user would leave zero administrators in the system:
   ```json
   {
     "message": "At least one admin user must remain in the system.",
     "errors": { "user": ["At least one admin user must remain in the system."] }
   }
   ```
