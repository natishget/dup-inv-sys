# 🎨 Frontend & UI Technology Stack

## 📌 Technology Overview

The frontend architecture is a state-of-the-art Single Page Application (SPA) driven by **React 19**, **TypeScript 5.7**, **Inertia.js v2**, and **Tailwind CSS v4**.

It combines the snappy, fluid interaction of client-side React rendering with the server-side productivity, security, and routing simplicity of Laravel.

```
+-----------------------------------------------------------------------------------+
|                               FRONTEND TECHNOLOGY STACK                           |
+-----------------------------------------------------------------------------------+
|  Core Framework     --> React 19 (^19.0.0)                                        |
|  Type System        --> TypeScript 5.7 (^5.7.2) with strict typing                |
|  SPA Client Bridge  --> Inertia.js React v2 (^2.0.0)                              |
|  CSS Framework      --> Tailwind CSS v4 (^4.0.0) via @tailwindcss/vite           |
|  UI Primitives      --> Radix UI Unstyled Accessible Primitives                  |
|  Icons              --> Lucide React (^0.475.0)                                   |
|  Client PDF Export  --> jsPDF (^4.2.1) + jsPDF-AutoTable (^5.0.7)                 |
+-----------------------------------------------------------------------------------+
```

---

## ⚛️ 1. React 19 & TypeScript 5.7

- **React 19 Standard:** Utilizes native React 19 compiler optimizations, modern hooks (`useMemo`, `useRef`, `useState`, `useEffect`), and strict functional components.
- **Path Aliasing:** Configured in `tsconfig.json` to allow clean root imports via `@/*`:
  ```json
  "paths": {
      "@/*": ["./resources/js/*"]
  }
  ```
- **Type Interfaces:** Comprehensive data definitions for invoices, variants, line items, and costing reports housed in `resources/js/types/index.d.ts`.

---

## ⚡ 2. Inertia.js v2 Client Engine

Inertia eliminates the complexity of separate client-side REST routers, state stores, and JWT refresh tokens:
1. **Server-Driven Routing:** Clicking a link or submitting a form calls `router.get()` or `post()` directly to Laravel named routes.
2. **Form Helper (`useForm`):** Manages form data, validation errors, dirty state, and processing indicators seamlessly:
   ```typescript
   const { data, setData, post, processing, errors, reset } = useForm<SaleFormData>({...});
   ```
3. **Partial Reloads & State Preservation:**
   Search inputs and filter controls use `router.get(..., { preserveState: true, preserveScroll: true })`, refreshing only the table payload without tearing down the DOM tree.

---

## 🎨 3. Tailwind CSS v4 Engine

The styling layer uses the high-performance **Tailwind CSS v4** engine powered by `@tailwindcss/vite` and `@tailwindcss/oxide` (native Rust/LightningCSS binary):
- **Zero Config Utility CSS:** Near-instant hot module replacement (HMR) times under 50ms.
- **Component Styling Utilities:**
  - `clsx`: Dynamic class composition.
  - `tailwind-merge`: Resolves conflicting Tailwind utility classes cleanly.
  - `class-variance-authority` (`cva`): Manages component visual variants (e.g., Button sizes `sm`, `md`, `lg` and intents `default`, `destructive`, `outline`, `ghost`).

---

## 🧩 4. Radix UI Primitives & Accessible Design

Interactive components are wrapped around unstyled, keyboard-accessible **Radix UI** primitives:

| Component Category | Underlying Radix Primitive | File Path |
| :--- | :--- | :--- |
| **Modal Dialogs** | `@radix-ui/react-dialog` | `components/ui/dialog.tsx` |
| **Slide-over Drawers**| `@radix-ui/react-sheet` | `components/ui/sheet.tsx` |
| **Form Selects** | `@radix-ui/react-select` | `components/ui/select.tsx` |
| **Action Dropdowns** | `@radix-ui/react-dropdown-menu` | `components/ui/dropdown-menu.tsx` |
| **Tooltips** | `@radix-ui/react-tooltip` | `components/ui/tooltip.tsx` |
| **Checkboxes** | `@radix-ui/react-checkbox` | `components/ui/checkbox.tsx` |

All dialogs support keyboard accessibility (`Escape` to close, `Tab` focus trapping, and `aria-expanded` screen reader attributes).

---

## 📄 5. Client-Side PDF Generation (`jsPDF`)

Commercial customer sales invoices are rendered directly in the user's browser using `jspdf` and `jspdf-autotable`:
- **Module:** `resources/js/lib/sales-pdf.ts`
- **Output:** High-resolution branded vector PDF containing company header, invoice dates, formatted tabular line items, subtotal, and grand total.
- **Performance:** Zero server CPU load; PDF compilation is executed entirely on client hardware.
