# 📦 Purchases & Sales API Reference

## 📌 Overview

This document specifies the operational trading endpoints for **Purchasing (Inbound)** and **Sales (Outbound)**, including creation, safe metadata updates, voiding, and partial returns.

All endpoints require authentication and are restricted to users with `ADMIN` or `SALES` roles.

---

## 📥 1. Purchases Endpoints

### A. Create Purchase Order
- **HTTP Method:** `POST`
- **Route:** `/purchases`
- **Required Role:** `ADMIN`, `SALES`
- **Form Request:** `App\Http\Requests\Order\StorePurchaseRequest`

#### Request Body
```json
{
  "supplier_name": "Gulf Extrusions LLC",
  "invoice_number": "INV-2026-9041",
  "purchase_date": "2026-04-28",
  "warehouse_id": "9bb68cf8-84cf-4d9d-83b4-5c91f9b31d42",
  "notes": "Urgent container shipment for facade contract",
  "items": [
    {
      "variant_id": "9bb68cf8-858d-4cb0-a540-349f7e8b6b21",
      "quantity": 100.0,
      "unit_cost": 50.0
    },
    {
      "variant_id": "9bb68cf8-863a-4efb-91d1-419b1b827e19",
      "quantity": 50.0,
      "unit_cost": 75.0
    }
  ]
}
```

#### Responses:
- **`302 Found` (Redirect Back):**  
  `session('success') = 'Purchase created successfully.'`
- **`422 Unprocessable Entity`:** Validation failure on missing fields or non-positive quantities.

---

### B. Update Purchase Metadata
Safely updates non-financial supplier metadata without altering inventory quantities or costs.

- **HTTP Method:** `PUT`
- **Route:** `/purchases/{purchase}`
- **Required Role:** `ADMIN`, `SALES`
- **Form Request:** `App\Http\Requests\Order\UpdatePurchaseRequest`

#### Request Body
```json
{
  "supplier_name": "Gulf Extrusions International LLC",
  "notes": "Updated contact person: John Doe (+971-50-000-0000)"
}
```

---

### C. Void Purchase Order
Invalidates a purchase order, reduces or removes unconsumed cost layers, and writes compensating negative inventory ledger movements (`PURCHASE_RETURN`).

- **HTTP Method:** `POST`
- **Route:** `/purchases/{purchase}/void`
- **Required Role:** `ADMIN`, `SALES`
- **Form Request:** `App\Http\Requests\Order\VoidTransactionRequest`

#### Request Body
```json
{
  "reason": "Shipment rejected at customs dock due to incorrect certification",
  "void_date": "2026-04-29"
}
```

---

### D. Return Defective Purchase Items
Processes a partial physical return of defective inventory back to the vendor.

- **HTTP Method:** `POST`
- **Route:** `/purchases/{purchase}/returns`
- **Required Role:** `ADMIN`, `SALES`
- **Form Request:** `App\Http\Requests\Order\CreatePurchaseReturnRequest`

#### Request Body
```json
{
  "warehouse_id": "9bb68cf8-84cf-4d9d-83b4-5c91f9b31d42",
  "return_date": "2026-04-30",
  "notes": "10 profiles damaged in transit, returning for vendor credit memo",
  "items": [
    {
      "variant_id": "9bb68cf8-858d-4cb0-a540-349f7e8b6b21",
      "quantity": 10.0
    }
  ]
}
```

---

## 📤 2. Sales Endpoints

### A. Create Sales Order
Checks warehouse stock availability, creates the customer invoice, permanently calculates COGS snapshots, and logs outbound negative ledger movements.

- **HTTP Method:** `POST`
- **Route:** `/sales`
- **Required Role:** `ADMIN`, `SALES`
- **Form Request:** `App\Http\Requests\Order\StoreSaleRequest`

#### Request Body
```json
{
  "customer_name": "Modern Facades Contracting",
  "sale_date": "2026-04-28",
  "warehouse_id": "9bb68cf8-84cf-4d9d-83b4-5c91f9b31d42",
  "notes": "Deliver to Site B - North Gate",
  "items": [
    {
      "variant_id": "9bb68cf8-858d-4cb0-a540-349f7e8b6b21",
      "quantity": 40.0,
      "selling_price": 85.0
    }
  ]
}
```

#### Responses:
- **`302 Found` (Redirect Back):**  
  `session('success') = 'Sale created successfully.'`
- **`422 Unprocessable Entity` (Insufficient Stock):**
  ```json
  {
    "message": "Not enough available stock in the selected warehouse for one of the selected variants.",
    "errors": {
      "items": [
        "Not enough available stock in the selected warehouse for one of the selected variants."
      ]
    }
  }
  ```

---

### B. Update Sale Metadata
Updates client contact remarks without altering financial prices or quantities.

- **HTTP Method:** `PUT`
- **Route:** `/sales/{sale}`
- **Required Role:** `ADMIN`, `SALES`
- **Form Request:** `App\Http\Requests\Order\UpdateSaleRequest`

#### Request Body
```json
{
  "customer_name": "Modern Facades Contracting LLC",
  "notes": "Gate access code updated: #4921"
}
```

---

### C. Void Sales Order
Cancels an order, restocks goods to the warehouse (`SALE_RETURN`), and reverses recognized COGS entries.

- **HTTP Method:** `POST`
- **Route:** `/sales/{sale}/void`
- **Required Role:** `ADMIN`, `SALES`
- **Form Request:** `App\Http\Requests\Order\VoidTransactionRequest`

#### Request Body
```json
{
  "reason": "Client cancelled installation contract before delivery dispatch",
  "void_date": "2026-04-29"
}
```

---

### D. Process Customer Return
Records a partial return of goods from a client, restocks items (`SALE_RETURN`), reduces sale revenue, and restores COGS proportionally.

- **HTTP Method:** `POST`
- **Route:** `/sales/{sale}/returns`
- **Required Role:** `ADMIN`, `SALES`
- **Form Request:** `App\Http\Requests\Order\CreateSaleReturnRequest`

#### Request Body
```json
{
  "warehouse_id": "9bb68cf8-84cf-4d9d-83b4-5c91f9b31d42",
  "return_date": "2026-04-30",
  "notes": "5 units returned due to site specification adjustment",
  "items": [
    {
      "variant_id": "9bb68cf8-858d-4cb0-a540-349f7e8b6b21",
      "quantity": 5.0
    }
  ]
}
```
