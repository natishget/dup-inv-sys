# 🌐 API Overview & Authentication

## 📌 Introduction

The system exposes two complementary HTTP interface patterns:
1. **JSON REST API Endpoints:** Used for asynchronous dashboard visualizations, real-time warehouse stock queries, and dynamic COGS simulations.
2. **Inertia SPA Controller Endpoints:** Used by the React frontend for form submissions, data mutations, and page navigation.

Both interfaces share identical authentication sessions, validation rules, and authorization middleware.

---

## 🔒 Authentication & Session Standards

All requests (except public login and password reset routes) require an authenticated session.

### Authentication Mechanisms:
- **Web Session Cookie:** State-based session authentication using Laravel's encrypted session cookie (`laravel_session`).
- **CSRF Protection:** All state-modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`) must include an `X-XSRF-TOKEN` header containing the decrypted value of the `XSRF-TOKEN` cookie automatically managed by Axios and Inertia.
- **Request Headers:**
  ```http
  Accept: application/json
  Content-Type: application/json
  X-XSRF-TOKEN: <token>
  ```

---

## 🚦 Standard HTTP Status Codes

The API uses standard HTTP response codes to communicate success, failure, and permission errors:

| Status Code | Meaning | Typical Trigger |
| :---: | :--- | :--- |
| **`200 OK`** | Request succeeded | Successful `GET` fetch or JSON resource update. |
| **`201 Created`** | Resource created | Successful entity creation (`POST /api/warehouses`). |
| **`302 Found`** | Redirect | Inertia form submission redirecting back (`back()->with(...)`). |
| **`401 Unauthorized`** | Authentication required | Unauthenticated user accessing a protected endpoint. |
| **`403 Forbidden`** | Insufficient permissions | Role violation (e.g. `SALES` attempting to access `/cogs` or `/users`). |
| **`404 Not Found`** | Resource missing | Requesting a UUID that does not exist in the database. |
| **`422 Unprocessable`** | Validation failure | Invalid datatypes, missing required fields, or stock shortage. |

---

## ⚠️ Standard Validation Error Response Format

When validation fails (HTTP `422`), Laravel returns a standardized JSON payload detailing which field caused the rejection:

```json
{
  "message": "The items.0.quantity field must be greater than 0. (and 1 more error)",
  "errors": {
    "items.0.quantity": [
      "The items.0.quantity field must be greater than 0."
    ],
    "warehouse_id": [
      "The selected warehouse_id is invalid."
    ]
  }
}
```

### Business Validation Exceptions:
Business rule violations (such as warehouse stock shortages or deleting warehouses with transactions) are also returned as HTTP `422` with contextual keys:
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

## 👥 Role Protection Summary

Every API route is guarded by one of three middleware aliases defined in `bootstrap/app.php`:

| Middleware Guard | Allowed Roles | Description |
| :--- | :--- | :--- |
| **`auth`** | `ADMIN`, `SALES`, `AUDITOR` | Basic authentication required. |
| **`role:ADMIN,SALES`** | `ADMIN`, `SALES` | Operational trading permissions (purchases, sales, returns). |
| **`role:ADMIN,AUDITOR`** | `ADMIN`, `AUDITOR` | Auditing & reporting permissions (COGS, catalogs). |
| **`admin`** | `ADMIN` only | Platform configuration (users, product master catalog, warehouse deletion). |
