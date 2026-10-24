'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { AuthGuard } from '@/components/auth-guard';
import {
  StockManagementBrandLogo,
  LayoutGridIcon,
  PackageIcon,
  UsersIcon,
  WarehouseIcon,
  PurchasesIcon,
  ShoppingCartIcon,
  BarChart3Icon,
  SidebarTriggerIcon,
  ChevronsUpDownIcon,
  SunIcon,
  MoonIcon,
  UserIcon,
  LogOutIcon,
} from '@/components/icons';

interface AppLayoutProps {
  children: React.ReactNode;
  breadcrumb?: string;
  allowedRoles?: ('ADMIN' | 'SALES' | 'AUDITOR')[];
}

export function AppLayout({
  children,
  breadcrumb = 'Dashboard',
  allowedRoles,
}: AppLayoutProps) {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const pathname = usePathname();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  if (!user) return null;

  // Compute initials (e.g., Natnael Getachew -> NG)
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'OP';

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutGridIcon },
    { name: 'Products', href: '/products', icon: PackageIcon },
    ...(user.role === 'ADMIN'
      ? [{ name: 'Users', href: '/users', icon: UsersIcon }]
      : []),
    { name: 'Warehouses', href: '/warehouses', icon: WarehouseIcon },
    { name: 'Purchases', href: '/purchases', icon: PurchasesIcon },
    { name: 'Sales', href: '/sales', icon: ShoppingCartIcon },
    { name: 'COGS', href: '/cogs', icon: BarChart3Icon },
  ];

  return (
    <AuthGuard allowedRoles={allowedRoles}>
      <div className="min-h-screen flex bg-[#f8fafc] dark:bg-[#070708] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
        {/* Left Sidebar */}
        <aside className="w-60 flex-shrink-0 flex flex-col justify-between border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#0a0a0c] z-20">
          <div>
            {/* Brand Header */}
            <div className="h-14 flex items-center gap-2.5 px-4 border-b border-zinc-100 dark:border-zinc-900/60">
              <StockManagementBrandLogo className="w-6 h-6 shrink-0" />
              <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
                Stock Management
              </span>
            </div>

            {/* Nav List */}
            <div className="px-3 py-4">
              <div className="px-3 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Platform
              </div>
              <nav className="space-y-0.5">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-white font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Bottom User Profile Section */}
          <div className="p-3 border-t border-zinc-100 dark:border-zinc-900/80 relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-xs flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <div className="truncate">
                  <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {user.name}
                  </div>
                </div>
              </div>
              <ChevronsUpDownIcon className="w-4 h-4 text-zinc-400 shrink-0" />
            </button>

            {/* Popup Menu */}
            {isUserMenuOpen && (
              <div className="absolute bottom-16 left-3 right-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-2 z-50 text-xs animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {user.name}
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono truncate">
                    {user.email}
                  </div>
                  <div className="mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      {user.role}
                    </span>
                  </div>
                </div>

                <Link
                  href="/settings"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Profile settings</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer"
                >
                  {resolvedTheme === 'dark' ? (
                    <>
                      <SunIcon className="w-3.5 h-3.5 text-amber-400" />
                      <span>Switch to Light Mode</span>
                    </>
                  ) : (
                    <>
                      <MoonIcon className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Switch to Dark Mode</span>
                    </>
                  )}
                </button>

                <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium cursor-pointer"
                >
                  <LogOutIcon className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Bar matching screenshot */}
          <header className="h-14 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#0a0a0c] sticky top-0 z-10">
            <div className="flex items-center gap-3 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              <SidebarTriggerIcon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span>{breadcrumb}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                }
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} mode`}
              >
                {resolvedTheme === 'dark' ? (
                  <SunIcon className="w-4 h-4" />
                ) : (
                  <MoonIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          </header>

          {/* Page Body */}
          <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
