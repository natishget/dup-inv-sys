# 📋 Form Requests & Validation Rules

## 📌 Architectural Purpose

In this application, incoming HTTP request validation is completely decoupled from controllers using dedicated **Laravel Form Request classes**.

Form Requests act as **strictly typed Data Transfer Objects (DTOs) and Validation Gatekeepers**:
- They validate primitive types, UUID formats, database foreign key existence, and numeric bounds (`gt:0`, `gte:0`) before any controller code executes.
- If validation fails, Laravel automatically halts execution and returns either:
  - An HTTP `422 Unprocessable Entity` JSON response for API endpoints.
  - An HTTP `302 Redirect Back` with validation error flashes for Inertia web pages.

---

## 🗂️ Complete Form Request Catalog

The request classes are organized into 4 domain namespaces under `app/Http/Requests/`:

```
app/Http/Requests/
  ├── Order/
  │    ├── StorePurchaseRequest.php
  │    ├── StoreSaleRequest.php
  │    ├── UpdatePurchaseRequest.php
  │    ├── UpdateSaleRequest.php
  │    ├── CreatePurchaseReturnRequest.php
  │    ├── CreateSaleReturnRequest.php
  │    └── VoidTransactionRequest.php
  ├── Product/
  │    ├── StoreProductRequest.php
  │    ├── StoreProductVariantRequest.php
  │    ├── StoreProductImportRequest.php
  │    └── UpdateProductRequest.php
  ├── Warehouse/
  │    ├── StoreWarehouseRequest.php
  │    └── UpdateWarehouseRequest.php
  └── User/
       ├── StoreUserRequest.php
       └── UpdateUserRequest.php
```

---

## 1. 📦 Order & Invoicing Requests (`App\Http\Requests\Order`)

### A. `StorePurchaseRequest`
Enforces incoming supplier invoice structure and line item constraints.

```php
public function rules(): array
{
    return [
        'supplier_name'      => ['nullable', 'string', 'max:255'],
        'invoice_number'     => ['nullable', 'string', 'max:100'],
        'notes'              => ['nullable', 'string', 'max:1000'],
        'purchase_date'      => ['nullable', 'date'],
        'warehouse_id'       => ['required', 'uuid', Rule::exists('warehouses', 'id')],
        'items'              => ['required', 'array', 'min:1'],
        'items.*.variant_id' => ['required', 'uuid', Rule::exists('product_variants', 'id')],
        'items.*.quantity'   => ['required', 'numeric', 'gt:0'],
        'items.*.unit_cost'  => ['required', 'numeric', 'gte:0'],
    ];
}
```
- **Key Guards:**
  - `warehouse_id`: Must exist in `warehouses.id`.
  - `items`: Requires at least one line item (`min:1`).
  - `quantity`: Must be strictly greater than zero (`gt:0`), blocking zero or negative inputs.
  - `unit_cost`: Must be zero or positive (`gte:0`).

---

### B. `StoreSaleRequest`
Enforces customer checkout structure.

```php
public function rules(): array
{
    return [
        'customer_name'        => ['nullable', 'string', 'max:255'],
        'notes'                => ['nullable', 'string', 'max:1000'],
        'sale_date'            => ['nullable', 'date'],
        'warehouse_id'         => ['required', 'uuid', Rule::exists('warehouses', 'id')],
        'items'                => ['required', 'array', 'min:1'],
        'items.*.variant_id'   => ['required', 'uuid', Rule::exists('product_variants', 'id')],
        'items.*.quantity'     => ['required', 'numeric', 'gt:0'],
        'items.*.selling_price'=> ['required', 'numeric', 'gte:0'],
    ];
}
```

---

### C. `UpdatePurchaseRequest` & `UpdateSaleRequest`
Safe metadata editing rules protecting posted financial data.

```php
// UpdatePurchaseRequest
public function rules(): array
{
    return [
        'supplier_name' => ['nullable', 'string', 'max:255'],
        'notes'         => ['nullable', 'string', 'max:1000'],
    ];
}

// UpdateSaleRequest
public function rules(): array
{
    return [
        'customer_name' => ['nullable', 'string', 'max:255'],
        'notes'         => ['nullable', 'string', 'max:1000'],
    ];
}
```
- **Financial Immutability Rule:** Notice that `warehouse_id`, `items`, `quantity`, and `prices` are **absent**. Operators cannot mutate financial line items after creation.

---

### D. `CreateSaleReturnRequest` & `CreatePurchaseReturnRequest`
Validates returns of physical items back to or from warehouses.

```php
public function rules(): array
{
    return [
        'warehouse_id'       => ['required', 'uuid', Rule::exists('warehouses', 'id')],
        'return_date'        => ['nullable', 'date'],
        'notes'              => ['nullable', 'string', 'max:1000'],
        'items'              => ['required', 'array', 'min:1'],
        'items.*.variant_id' => ['required', 'uuid', Rule::exists('product_variants', 'id')],
        'items.*.quantity'   => ['required', 'numeric', 'gt:0'],
    ];
}
```

---

### E. `VoidTransactionRequest`
Captures audit reasons when voiding an invoice.

```php
public function rules(): array
{
    return [
        'reason'    => ['nullable', 'string', 'max:1000'],
        'void_date' => ['nullable', 'date'],
    ];
}
```

---

## 2. 🏷️ Product Catalog Requests (`App\Http\Requests\Product`)

### A. `StoreProductRequest`
Creates master product definitions.
```php
public function rules(): array
{
    return [
        'name'      => ['required', 'string', 'max:255', 'unique:products,name'],
        'base_unit' => ['nullable', 'string', 'max:50'],
    ];
}
```

---

### B. `StoreProductVariantRequest`
Creates specific sellable SKUs linked to a master product.
```php
public function rules(): array
{
    return [
        'product_id' => ['required', 'uuid', Rule::exists('products', 'id')],
        'color'      => ['nullable', 'string', 'max:50'],
        'origin'     => ['nullable', 'string', Rule::in(['LOCAL', 'IMPORTED'])],
        'sku'        => ['nullable', 'string', 'max:100', 'unique:product_variants,sku'],
        'thickness'  => ['nullable', 'numeric', 'gte:0', 'lte:999.99'],
        'size'       => ['nullable', 'string', 'max:100'],
    ];
}
```

---

### C. `StoreProductImportRequest` (Deep JSON Validation)
Handles bulk JSON import payloads with extensive format sanitization.

```php
public function rules(): array
{
    return [
        'products_json' => ['required', 'string', 'max:50000'],
    ];
}
```

#### Custom Validation Logic inside `products()` Method:
1. **JSON Syntax Guard:** Uses `json_decode(..., flags: JSON_THROW_ON_ERROR)`. Catches `JsonException` and throws a friendly validation message.
2. **List Validation:** Enforces `array_is_list($decoded)`.
3. **Payload Size Guard:** Enforces `count($decoded) <= 250` products per import batch.
4. **Strict Key Whitelist:** Compares object keys against `['name', 'unit']`. Rejects any payload with extraneous keys.
5. **In-Payload Deduplication:** Checks for duplicate product names within the uploaded JSON file itself.
6. **Database Duplicate Pre-Check:** Controllers check if any product name already exists in `products.name` before initiating the bulk insert.

---

## 3. 🏪 Warehouse Requests (`App\Http\Requests\Warehouse`)

### `StoreWarehouseRequest` & `UpdateWarehouseRequest`
```php
// StoreWarehouseRequest
public function rules(): array
{
    return [
        'name'     => ['required', 'string', 'max:100', 'unique:warehouses,name'],
        'location' => ['nullable', 'string'],
    ];
}

// UpdateWarehouseRequest
public function rules(): array
{
    return [
        'name'     => ['required', 'string', 'max:100', Rule::unique('warehouses', 'name')->ignore($this->warehouse)],
        'location' => ['nullable', 'string'],
    ];
}
```

---

## 4. 👤 User Management Requests (`App\Http\Requests\User`)

### `StoreUserRequest` & `UpdateUserRequest`
```php
// StoreUserRequest
public function rules(): array
{
    return [
        'name'  => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', 'max:255', 'unique:users,email'],
        'phone' => ['required', 'string', 'max:255', 'unique:users,phone'],
        'role'  => ['required', 'string', Rule::in(User::roles())],
    ];
}
```
- **Phone & Email Uniqueness:** Enforces distinct identities for both login credentials and operational communication.
- **Role Verification:** Constrains assignment to valid defined roles: `['ADMIN', 'SALES', 'AUDITOR']`.
