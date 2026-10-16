# 🎨 Layout, Navigation & Theme Architecture

## 📌 Overview

The application frontend is built with **React 19**, **Inertia.js v2**, and **Tailwind CSS**, utilizing modern accessible UI primitives adapted from Radix UI.

Every authenticated screen is wrapped within a unified application shell that guarantees consistent responsive navigation, dynamic breadcrumbs, role-tailored sidebar links, and seamless Dark/Light/System theme toggling.

---

## 🏛️ Layout Component Tree

```
AppLayout (layouts/app-layout.tsx)
  └── AppSidebarLayout (layouts/app/app-sidebar-layout.tsx)
        ├── AppSidebar (components/app-sidebar.tsx)
        │     ├── SidebarHeader ──► AppLogo (components/app-logo.tsx)
        │     ├── SidebarContent ─► NavMain (components/nav-main.tsx) [Role-filtered links]
        │     └── SidebarFooter ──► NavUser (components/nav-user.tsx) [User avatar & logout]
        └── SidebarInset
              ├── AppHeader (components/app-header.tsx)
              │     ├── SidebarTrigger (Mobile & Desktop collapse toggle)
              │     ├── Breadcrumbs (components/breadcrumbs.tsx)
              │     └── AppearanceDropdown (Light/Dark/System theme switcher)
              └── AppContent (components/app-content.tsx) ──► Page Component Content
```

---

## 🧭 Dynamic Role-Based Sidebar Navigation

Navigation items in `AppSidebar` are evaluated dynamically against `auth.user.role` extracted from Inertia's global shared props:

```typescript
const { auth } = usePage<SharedData>().props;
const role = auth.user.role;

const canViewOperationalModules = role === 'ADMIN' || role === 'SALES' || role === 'AUDITOR';
const canViewProducts = role === 'ADMIN' || role === 'AUDITOR';
const canViewCogs = role === 'ADMIN' || role === 'AUDITOR';
```

### Nav Items Visibility Matrix:

| Sidebar Item | URL | Required Role | Icon | Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | `/dashboard` | All Authenticated | `LayoutGrid` | Financial analytics and top products. |
| **Products** | `/products` | `ADMIN`, `AUDITOR` | `Package` | Product catalog and variant management. |
| **Users** | `/users` | `ADMIN` (sidebar checks `ADMIN/AUDITOR` guard) | `Users` | User accounts and credential provisioning. |
| **Warehouses** | `/warehouses` | `ADMIN`, `AUDITOR` | `Warehouse` | Physical depots and live warehouse stock. |
| **Purchases** | `/purchases` | `ADMIN`, `SALES`, `AUDITOR` | `ReceiptText`| Inbound supplier orders and returns. |
| **Sales** | `/sales` | `ADMIN`, `SALES`, `AUDITOR` | `ShoppingCart`| Customer sales checkout and billing. |
| **COGS** | `/cogs` | `ADMIN`, `AUDITOR` | `BarChart3` | Financial COGS audit and CSV streaming. |

---

## 🌗 Theme & Appearance Engine

The application features full **Dark Mode** support:
- Controlled via `components/appearance-dropdown.tsx` and `components/appearance-tabs.tsx`.
- Supports three modes:
  1. **Light:** High-contrast crisp white background with clean slate borders.
  2. **Dark:** Deep zinc background (`#09090b`), reduced eye strain, and accessible pastel accents.
  3. **System:** Automatically synchronizes with OS-level `prefers-color-scheme`.
- Persisted client-side and dynamically synchronized across browser tabs.

---

## 📱 Responsive & Mobile Behavior

- **Desktop (>= 1024px):** Inset sidebar layout with collapsible icon mode (`collapsible="icon"`). Operators can collapse the sidebar to maximize data table width for wide invoice grids.
- **Mobile (< 1024px):** Sidebar automatically collapses into a touch-friendly slide-over drawer triggered by the hamburger icon in `AppHeader`.
