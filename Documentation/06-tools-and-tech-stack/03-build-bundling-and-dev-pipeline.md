# 🛠️ Build, Bundling & Developer Pipeline

## 📌 Overview

The application features an integrated local developer environment and production asset compilation pipeline powered by **Vite 6** and **Composer Scripts**.

Developers can launch the entire stack (web server, asynchronous queue listener, and Vite hot-module replacement) with a single command.

---

## ⚡ 1. The Unified Development Runner

Configured in `composer.json` under `"scripts": { "dev": [...] }`:

```bash
composer run dev
```

### What Happens Behind the Scenes:
Composer executes `npx concurrently` with distinct terminal color highlights to orchestrate **three parallel processes**:

```
+-----------------------------------------------------------------------------------------+
|                              COMPOSER RUN DEV PIPELINE                                  |
+-----------------------------------------------------------------------------------------+
|  [server] ──► php artisan serve                     (Port 8000: Web Application Server) |
|  [queue]  ──► php artisan queue:listen --tries=1    (Background Task & Export Processor)|
|  [vite]   ──► npm run dev                           (Port 5173: Fast HMR Bundler)       |
+-----------------------------------------------------------------------------------------+
```

1. **`server` (Blue):** Boots the local PHP built-in web server at `http://127.0.0.1:8000`.
2. **`queue` (Purple):** Listens to database job queues for asynchronous reporting tasks.
3. **`vite` (Orange):** Starts the Vite dev server with instant TypeScript/Tailwind HMR at `http://localhost:5173`.

---

## ⚙️ 2. Vite 6 Configuration (`vite.config.js`)

```javascript
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.jsx',
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    esbuild: {
        jsx: 'automatic',
    },
});
```

### Key Plugin Roles:
- **`laravel-vite-plugin`:** Injects Vite `@viteReactRefresh` and asset tags into the Blade root template (`resources/views/app.blade.php`), enabling hot reloads on PHP file edits.
- **`@vitejs/plugin-react`:** Enables Fast Refresh for React 19 components without resetting component state.
- **`@tailwindcss/vite`:** Vite-native integration with Tailwind CSS v4, parsing utility classes on the fly.
- **Automatic JSX:** Configures `esbuild.jsx = 'automatic'` to eliminate explicit `import React from 'react'` requirements across JSX files.

---

## 📦 3. Production Bundling & Deployment

When deploying to a staging or production server:

### A. Client Asset Compilation:
```bash
npm run build
```
- Compiles, tree-shakes, minifies, and hashes all React components and CSS files into `public/build/`.
- Generates a production `manifest.json` mapping logical asset paths to cache-busted filenames (e.g. `app-Bx93a2.js`).

### B. Troubleshooting the "Vite Manifest" Exception:
If Laravel throws:
> `Illuminate\Foundation\ViteException: Unable to locate file in Vite manifest`
This indicates that either:
1. The developer server (`npm run dev` or `composer run dev`) is not running locally.
2. In production, `npm run build` has not yet been executed to generate `public/build/manifest.json`.
Running `npm run build` resolves the issue immediately.

---

## 📜 4. Developer Command Reference

| Action | Command | Purpose |
| :--- | :--- | :--- |
| **Start Full Dev Stack** | `composer run dev` | Launches PHP web server, queue worker, and Vite HMR concurrently. |
| **Start Vite Only** | `npm run dev` | Launches frontend Hot Module Replacement server. |
| **Compile for Production**| `npm run build` | Compiles minified bundle into `public/build/`. |
| **Run Migrations** | `php artisan migrate` | Executes pending database schema migrations. |
| **Seed Default Admin** | `php artisan db:seed` | Provisions initial administrator account (`natishget@gmail.com`). |
| **Interactive REPL** | `php artisan tinker` | Interactive PHP shell with full Eloquent model access. |
| **Clear Application Cache**| `php artisan optimize:clear` | Clears route, config, and view caches. |
