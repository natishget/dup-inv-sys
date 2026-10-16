# 🏭 Products & Warehouses API Reference

## 📌 Overview

This document specifies the catalog management endpoints for **Master Products**, **Sellable Variants**, and **Physical Warehouses**, including the live warehouse stock calculation endpoint.

---

## 🏷️ 1. Products & Variants Endpoints

### A. Create Master Product
Creates a high-level product family category.

- **HTTP Method:** `POST`
- **Route:** `/products`
- **Required Role:** `ADMIN` (`middleware('admin')`)
- **Form Request:** `App\Http\Requests\Product\StoreProductRequest`

#### Request Body
```json
{
  "name": "Aluminum Profile Series 20",
  "base_unit": "METER"
}
```
#### Response: `302 Found` (Redirect back with `session('success')`).

---

### B. Create Product Variant
Creates a specific sellable SKU under a parent product.

- **HTTP Method:** `POST`
- **Route:** `/products/variants`
- **Required Role:** `ADMIN`
- **Form Request:** `App\Http\Requests\Product\StoreProductVariantRequest`

#### Request Body
```json
{
  "product_id": "9bb68cf8-84cf-4d9d-83b4-5c91f9b31d42",
  "color": "Bronze",
  "origin": "IMPORTED",
  "sku": "ALU-20-BRZ-IMP",
  "thickness": 1.40,
  "size": "6.0m"
}
```

---

### C. Bulk Import Products via JSON
Imports up to 250 products atomically within a single database transaction.

- **HTTP Method:** `POST`
- **Route:** `/products/import`
- **Required Role:** `ADMIN`
- **Form Request:** `App\Http\Requests\Product\StoreProductImportRequest`

#### Request Body
```json
{
  "products_json": "[{\"name\":\"Curtain Wall Profile 50\",\"unit\":\"METER\"},{\"name\":\"Sliding Window Track\",\"unit\":\"PCS\"}]"
}
```

#### Error Response (`422 Unprocessable Entity` - Existing Duplicates):
```json
{
  "message": "The JSON payload contains product names that already exist: Curtain Wall Profile 50.",
  "errors": {
    "products_json": [
      "The JSON payload contains product names that already exist: Curtain Wall Profile 50."
    ]
  }
}
```

---

### D. Delete Product
- **HTTP Method:** `DELETE`
- **Route:** `/products/{product}`
- **Required Role:** `ADMIN`
- **Safety Rule:** Cannot delete a product if child variants exist. Throws HTTP `422`:
  ```json
  {
    "message": "Delete the related variants first before removing this product.",
    "errors": { "product": ["Delete the related variants first before removing this product."] }
  }
  ```

---

## 🏪 2. Warehouses API (JSON Endpoints)

### A. List All Warehouses
- **HTTP Method:** `GET`
- **Route:** `/api/warehouses`
- **Required Role:** `ADMIN`, `SALES`, `AUDITOR`

#### Success Response (`200 OK`)
```json
{
  "data": [
    {
      "id": "9bb68cf8-84cf-4d9d-83b4-5c91f9b31d42",
      "name": "Main Depot Warehouse",
      "location": "Plot 42, Industrial Area 3"
    },
    {
      "id": "9bb68cf8-858d-4cb0-a540-349f7e8b6b21",
      "name": "Airport Road Showroom",
      "location": "Airport Road, Building B"
    }
  ]
}
```

---

### B. Create Warehouse
- **HTTP Method:** `POST`
- **Route:** `/api/warehouses`
- **Required Role:** `ADMIN`
- **Form Request:** `App\Http\Requests\Warehouse\StoreWarehouseRequest`

#### Request Body
```json
{
  "name": "Port Logistics Yard",
  "location": "Customs Free Zone Gate 2"
}
```

#### Success Response (`201 Created`)
```json
{
  "data": {
    "id": "9bb68cf8-863a-4efb-91d1-419b1b827e19",
    "name": "Port Logistics Yard",
    "location": "Customs Free Zone Gate 2"
  },
  "message": "Warehouse created successfully."
}
```

---

### C. Get Warehouse Live Stock
Aggregates live stock directly from the immutable transaction ledger (`inventory_transactions`).

- **HTTP Method:** `GET`
- **Route:** `/api/warehouses/{warehouse}/stock`
- **Required Role:** `ADMIN`, `SALES`, `AUDITOR`

#### Request Example
```http
GET /api/warehouses/9bb68cf8-84cf-4d9d-83b4-5c91f9b31d42/stock HTTP/1.1
Host: stock.company.com
Accept: application/json
```

#### Success Response (`200 OK`)
```json
{
  "data": [
    {
      "variant_id": "9bb68cf8-858d-4cb0-a540-349f7e8b6b21",
      "product_name": "Aluminum Profile Series 20",
      "color": "Bronze",
      "origin": "IMPORTED",
      "total_stock": 60.0000
    },
    {
      "variant_id": "9bb68cf8-863a-4efb-91d1-419b1b827e19",
      "product_name": "Square Tubing 40x40",
      "color": "Silver",
      "origin": "LOCAL",
      "total_stock": 145.5000
    }
  ]
}
```

---

### D. Delete Warehouse
- **HTTP Method:** `DELETE`
- **Route:** `/api/warehouses/{warehouse}`
- **Required Role:** `ADMIN`
- **Data Protection Barrier:** Blocks deletion if the warehouse has ever had an entry in `inventory_transactions`. Throws HTTP `422`:
  ```json
  {
    "message": "This warehouse cannot be deleted because it has inventory transactions.",
    "errors": {
      "warehouse": [
        "This warehouse cannot be deleted because it has inventory transactions."
      ]
    }
  }
  ```
