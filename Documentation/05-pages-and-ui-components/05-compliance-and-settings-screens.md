# ⚖️ Compliance & Settings Screens

## 📌 Overview

This document specifies the interface components governing regulatory compliance, cost auditing, user management, and operator preferences:
1. **COGS & Valuation Audit Screen (`resources/js/pages/cogs/index.tsx`)**
2. **User Administration Screen (`resources/js/pages/users/index.tsx`)**
3. **Account & Appearance Settings Screens (`resources/js/pages/settings/*`)**

---

## 📊 1. COGS & Valuation Audit Screen (`cogs/index.tsx`)

The COGS screen empowers financial controllers and auditors to inspect historical Cost of Goods Sold and evaluate alternative costing scenarios without touching the underlying database ledger.

### Interface Layout:
```
+-----------------------------------------------------------------------------------------+
| [Header] Cost of Goods Sold (COGS) Report               [Active Method: FIFO] [Export]  |
+-----------------------------------------------------------------------------------------+
| Date Range: [2026-01-01] to [2026-04-30]       Costing Model: [LIFO (Simulated) ▼]      |
+-----------------------------------------------------------------------------------------+
| ⚠️ Warning: You are viewing simulated LIFO metrics. System active costing is FIFO.       |
| Historical recorded entries remain unchanged.                                          |
+-----------------------------------------------------------------------------------------+
| Product Name         Finish   Origin   Qty Sold    Revenue      COGS         Gross Profit |
| Profile Series 20    Bronze   IMPORTED 450.00 pcs  $38,250.00   $22,500.00   $15,750.00   |
| Square Tube 40x40    Silver   LOCAL    300.00 pcs  $27,000.00   $18,000.00   $ 9,000.00   |
+-----------------------------------------------------------------------------------------+
| [Pagination: < Prev  1  2  3  Next >]                         [Showing 1 to 10 of 42]   |
+-----------------------------------------------------------------------------------------+
```

### Key Technical Mechanisms:

#### 1. 300ms Filter Debounce & Client Cache:
Rapid adjustments to the date picker or method dropdown are debounced by 300ms. Results are stored in a memory cache (`requestCache = new Map<string, CogsResponse>()`), ensuring that paging back and forth requires zero duplicate network traffic.

#### 2. Simulation Alert Banner:
If `costingMethod !== activeMethod`, the UI renders a warning banner explaining that an in-memory simulation has been executed and stored transaction records remain completely untouched.

#### 3. Native Chunked CSV Streaming:
Clicking the **Export CSV** button initiates a direct browser download from `/cogs/export-csv`, allowing multi-year tax reports to be exported without server timeout.

---

## 👥 2. User Administration Screen (`users/index.tsx`)

Restricted exclusively to system `ADMIN` users.

### Interface Features:
- **User Accounts Table:** Displays Operator Name, Email, Telephone Number, Role Badge (`ADMIN`, `SALES`, `AUDITOR`), and account creation timestamp.
- **Search & Role Filters:** Real-time search across names, emails, and phone numbers.

### Critical Safety Protections:
1. **Self-Deletion Barrier:** If an admin clicks Delete on their own row, the server halts the action and the UI displays: *"You cannot delete your own account from this page."*
2. **Last-Admin Barrier:** The system blocks deleting the sole remaining administrator, ensuring the company is never locked out of platform governance.
3. **Default Credential Provisioning:** Newly provisioned accounts are initialized with a standard temporary password (`System@Pass`), prompting the operator to update their password upon first login.

---

## ⚙️ 3. Settings Screens (`settings/*`)

Accessible by all authenticated users to manage individual preferences:

### A. Profile Information (`settings/profile.tsx`):
- Updates operator display name, email address, and phone number.
- Triggers re-verification if email addresses are updated.

### B. Password Management (`settings/password.tsx`):
- Requires current password authentication before applying a new password.
- Enforces modern security standards (minimum length, mixed characters).

### C. Appearance & Theme (`settings/appearance.tsx`):
- Provides visual preview cards for **Light**, **Dark**, and **System** color themes.
- Applies theme tokens instantly via CSS classes on the document root without reloading the page.
